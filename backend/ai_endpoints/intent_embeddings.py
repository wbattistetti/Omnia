from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from numpy import dot
from numpy.linalg import norm

# Try import sentence-transformers (locale)
try:
    from sentence_transformers import SentenceTransformer
    _sentence_transformer_available = True
    _local_model = None  # Lazy load
except ImportError:
    _sentence_transformer_available = False
    print("[Embeddings][WARN] sentence-transformers not installed. Install with: pip install sentence-transformers")

router = APIRouter()

# In-memory storage per embeddings (in futuro MongoDB)
_embeddings_cache: Dict[str, Dict] = {}
_model_ready: Dict[str, bool] = {}

# Model locale per training e runtime (multilingua)
LOCAL_MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"  # Multilingua, open-source

def _get_local_model():
    """Lazy load del modello sentence-transformers (solo quando serve)"""
    global _local_model
    print(f"[Embeddings][MODEL] Checking local model availability...", flush=True)

    if not _sentence_transformer_available:
        print(f"[Embeddings][ERROR] sentence-transformers not installed!", flush=True)
        raise ValueError("sentence-transformers not installed. Install with: pip install sentence-transformers")

    if _local_model is None:
        print(f"[Embeddings][INIT] Loading local model: {LOCAL_MODEL_NAME}", flush=True)
        try:
            _local_model = SentenceTransformer(LOCAL_MODEL_NAME)
            print(f"[Embeddings][INIT] Model loaded successfully", flush=True)
        except Exception as e:
            print(f"[Embeddings][ERROR] Failed to load model: {str(e)}", flush=True)
            import traceback
            print(f"[Embeddings][ERROR] Traceback: {traceback.format_exc()}", flush=True)
            raise

    return _local_model

class TrainBody(BaseModel):
    phrases: List[Dict[str, Any]]  # {id, text, type: 'matching'|'not-matching'}
    intentId: str

class ClassifyBody(BaseModel):
    text: str
    intentIds: Optional[List[str]] = None

def compute_embedding_local(text: str) -> List[float]:
    """
    Calcola embedding usando sentence-transformers LOCALE (gratuito, zero costi).
    Usato sempre per training e runtime.
    """
    print(f"[Embeddings][LOCAL] Computing embedding for text: '{text[:50]}...'", flush=True)
    try:
        model = _get_local_model()
        print(f"[Embeddings][LOCAL] Model obtained, encoding...", flush=True)
        embedding = model.encode(text, normalize_embeddings=True).tolist()
        print(f"[Embeddings][LOCAL] Encoding completed, embedding length: {len(embedding)}", flush=True)
        return embedding
    except Exception as e:
        print(f"[Embeddings][LOCAL][ERROR] Failed to compute embedding: {str(e)}", flush=True)
        import traceback
        print(f"[Embeddings][LOCAL][ERROR] Traceback: {traceback.format_exc()}", flush=True)
        raise

def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Calcola cosine similarity tra due vettori"""
    if not a or not b or len(a) != len(b):
        return 0.0
    try:
        return float(dot(a, b) / (norm(a) * norm(b)))
    except Exception:
        return 0.0

@router.post('/api/intents/{intent_id}/train')
async def train_intent(intent_id: str, body: TrainBody):
    """
    Pre-calcola embeddings per tutte le frasi di training di un intent.

    Usa sempre sentence-transformers locale (zero costi, multilingua).
    Salva embeddings in cache e marca il modello come ready.
    """
    print(f"[IntentTrain][START] ========== TRAINING STARTED ==========", flush=True)
    print(f"[IntentTrain][START] Intent ID: {intent_id}", flush=True)
    print(f"[IntentTrain][START] Body received: {len(body.phrases) if body.phrases else 0} phrases", flush=True)

    if not body.phrases:
        print(f"[IntentTrain][ERROR] No phrases provided", flush=True)
        raise HTTPException(
            status_code=400,
            detail="No phrases provided for training"
        )

    print(f"[IntentTrain][DEBUG] Starting training for intent {intent_id}", flush=True)
    print(f"[IntentTrain][DEBUG] Phrases: {len(body.phrases)}, Method: Local (sentence-transformers)", flush=True)

    embeddings_data = {
        'matching': [],
        'not-matching': []
    }

    processed_count = 0
    failed_count = 0

    print(f"[IntentTrain][LOOP] Starting phrase processing loop...", flush=True)

    # Calcola embeddings per ogni frase
    for i, phrase in enumerate(body.phrases):
        try:
            phrase_id = phrase.get('id', f'phrase_{i}')
            phrase_text = phrase.get('text', '')
            phrase_type = phrase.get('type', 'matching')

            print(f"[IntentTrain][PHRASE {i+1}/{len(body.phrases)}] Processing: id={phrase_id}, type={phrase_type}, text={phrase_text[:50]}...", flush=True)

            if not phrase_text:
                print(f"[IntentTrain][PHRASE {i+1}] Skipping - empty text", flush=True)
                continue

            # Usa sempre modello locale
            print(f"[IntentTrain][PHRASE {i+1}] Computing with local model...", flush=True)
            embedding = compute_embedding_local(phrase_text)
            print(f"[IntentTrain][PHRASE {i+1}] Local embedding computed, length={len(embedding)}", flush=True)

            embeddings_data[phrase_type].append({
                'id': phrase_id,
                'text': phrase_text,
                'embedding': embedding
            })

            processed_count += 1
            print(f"[IntentTrain][PHRASE {i+1}] Added to embeddings_data[{phrase_type}], count={len(embeddings_data[phrase_type])}", flush=True)

            # Progress log ogni 10 frasi
            if (i + 1) % 10 == 0:
                print(f"[IntentTrain][PROGRESS] Processed {i + 1}/{len(body.phrases)} phrases", flush=True)

        except Exception as e:
            failed_count += 1
            print(f"[IntentTrain][ERROR] Failed to compute embedding for phrase {i+1}: {str(e)}", flush=True)
            import traceback
            print(f"[IntentTrain][ERROR] Traceback: {traceback.format_exc()}", flush=True)
            continue

    # Verifica che almeno una frase sia stata processata
    if processed_count == 0:
        print(f"[IntentTrain][ERROR] No phrases processed successfully", flush=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process any phrases. {failed_count} failed, {len(body.phrases)} total."
        )

    print(f"[IntentTrain][SAVE] Saving embeddings to cache...", flush=True)
    print(f"[IntentTrain][SAVE] Matching phrases: {len(embeddings_data['matching'])}, Not-matching: {len(embeddings_data['not-matching'])}", flush=True)

    # Salva in cache
    _embeddings_cache[intent_id] = embeddings_data
    _model_ready[intent_id] = True

    print(f"[IntentTrain][SAVE] Cache saved, model marked as ready", flush=True)

    matching_count = len(embeddings_data['matching'])
    not_matching_count = len(embeddings_data['not-matching'])

    print(f"[IntentTrain][SUCCESS] Training completed for intent {intent_id}", flush=True)
    print(f"[IntentTrain][STATS] Matching: {matching_count}, Not-matching: {not_matching_count}, Processed: {processed_count}, Failed: {failed_count}", flush=True)

    result = {
        'intentId': intent_id,
        'modelReady': True,
        'method': 'Local',
        'stats': {
            'matching': matching_count,
            'notMatching': not_matching_count,
            'total': matching_count + not_matching_count,
            'processed': processed_count,
            'failed': failed_count
        }
    }

    print(f"[IntentTrain][END] ========== TRAINING COMPLETED ==========", flush=True)
    print(f"[IntentTrain][END] Returning result: {result}", flush=True)

    return result

@router.get('/api/intents/{intent_id}/model-status')
async def get_model_status(intent_id: str):
    """Verifica se il modello è pronto per un intent"""
    return {
        'intentId': intent_id,
        'modelReady': _model_ready.get(intent_id, False),
        'hasEmbeddings': intent_id in _embeddings_cache
    }

@router.post('/api/intents/classify-embedding')
async def classify_with_embeddings(body: ClassifyBody):
    """
    Classifica un testo usando embeddings (solo se modello è pronto).

    A runtime usa SEMPRE sentence-transformers locale (zero costi, veloce).
    Confronta con gli embeddings del training set salvati in cache.

    Ritorna top intent con score cosine similarity.
    """
    if not body.text or not body.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")

    # Calcola embedding del testo input usando modello LOCALE (gratuito, veloce)
    try:
        text_embedding = compute_embedding_local(body.text)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to compute embedding locally: {str(e)}. Make sure sentence-transformers is installed."
        )

    # Se intentIds fornito, filtra solo quelli; altrimenti tutti quelli con embeddings
    intent_ids_to_check = body.intentIds if body.intentIds else list(_embeddings_cache.keys())

    results = []

    for intent_id in intent_ids_to_check:
        if intent_id not in _embeddings_cache:
            continue  # Skip se non ha embeddings

        embeddings_data = _embeddings_cache[intent_id]

        # Trova best match tra matching phrases
        best_match_score = 0.0
        best_match_text = ""

        for phrase_data in embeddings_data.get('matching', []):
            phrase_embedding = phrase_data.get('embedding', [])
            if not phrase_embedding:
                continue

            score = cosine_similarity(text_embedding, phrase_embedding)
            if score > best_match_score:
                best_match_score = score
                best_match_text = phrase_data.get('text', '')

        # Penalità se matcha con not-matching (evita false positive)
        penalty = 0.0
        for phrase_data in embeddings_data.get('not-matching', []):
            phrase_embedding = phrase_data.get('embedding', [])
            if not phrase_embedding:
                continue

            neg_score = cosine_similarity(text_embedding, phrase_embedding)
            if neg_score > 0.7:  # Se molto simile a un negativo
                penalty += (neg_score - 0.7) * 0.5

        final_score = max(0.0, best_match_score - penalty)

        if final_score > 0:
            results.append({
                'intentId': intent_id,
                'score': final_score,
                'bestMatchText': best_match_text
            })

    # Ordina per score decrescente
    results.sort(key=lambda x: x['score'], reverse=True)

    return {
        'text': body.text,
        'top': results[:5],  # Top 5
        'best': results[0] if results else None
    }


