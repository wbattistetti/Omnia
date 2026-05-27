/**
 * Prompt IA per analisi sovrapposizioni use case (catalogo agente).
 */

const OVERLAP_RULES = `CLASSIFICATION (semantic, not literal text match):
- duplicate: same conversational intent and script; new row adds no distinct pattern.
- variant: same core flow; only detail differs (optional exam, first visit vs follow-up, wording).
- new: materially different user goal, questions, guardrails, or outcome.

Threshold reference: scores >= THRESHOLD are overlaps worth flagging.
Consider synonyms and paraphrases.`;

const ANALYZE_ONE_SYSTEM = `You are an expert conversational designer for OMNIA use case catalogs.
Respond with a single valid JSON object only (no markdown fences).

${OVERLAP_RULES}

Output schema:
{
  "classification": "duplicate" | "variant" | "new",
  "score": number 0..1,
  "primary_intent": string,
  "related": [
    {
      "use_case_id": string,
      "relation": "duplicate_of" | "variant_of",
      "score": number,
      "reason": string
    }
  ],
  "designer_message": string (Italian, one sentence for the designer; mention catalog number if provided)
}

If classification is "new", related may be empty and score should be low (< THRESHOLD).
Pick at most 3 related use cases, best match first.`;

const CHECK_CATALOG_SYSTEM = `You are an expert conversational designer for OMNIA use case catalogs.
Respond with a single valid JSON object only (no markdown fences).

${OVERLAP_RULES}

Compare ALL pairs in the catalog semantically. Group strongly connected use cases into clusters.

Output schema:
{
  "pair_count": number,
  "clusters": [
    {
      "cluster_id": string,
      "classification": "duplicate" | "variant",
      "use_case_ids": string[],
      "headline": string (Italian, short),
      "pairs": [
        {
          "use_case_a_id": string,
          "use_case_b_id": string,
          "classification": "duplicate" | "variant",
          "score": number,
          "summary": string (Italian)
        }
      ]
    }
  ]
}

Only include pairs with score >= THRESHOLD. Omit "new" singletons.`;

module.exports = {
  ANALYZE_ONE_SYSTEM,
  CHECK_CATALOG_SYSTEM,
};
