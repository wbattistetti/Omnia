import os

# API Keys and endpoints
GROQ_KEY = os.environ.get("Groq_key") or os.environ.get("GROQ_KEY") or os.environ.get("GROQ_API_KEY")
OPENAI_KEY = os.environ.get("OPENAI_KEY")
OPENAI_URL = "https://api.openai.com/v1/chat/completions"
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.1-70b-instruct")
GROQ_FALLBACKS = [m.strip() for m in (os.environ.get("GROQ_MODEL_FALLBACKS", "").split(",") if os.environ.get("GROQ_MODEL_FALLBACKS") else []) if m.strip()]

# Express proxy settings
EXPRESS_BASE = os.environ.get("EXPRESS_BASE", "http://localhost:3100")

# Language settings
IDE_LANGUE = os.environ.get("IdeLangue", "it")

# NLP types config path
NLP_TYPES_CONFIG_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'config', 'nlp-types.json')
