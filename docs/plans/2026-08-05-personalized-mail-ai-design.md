# Personalized Mail AI Design

## Understanding

- Learn each signed-in user's preferred and unwanted mail patterns.
- Keep all deletion decisions under explicit user control.
- Use Cloudflare D1, Vectorize, and Workers AI in the primary deployment.
- Mask personal data, verification codes, payment identifiers, and secret-bearing URLs before AI processing.
- Never persist Gmail originals or Workers AI request/response bodies.
- Provide recommendation confidence, reasons, correction controls, consent withdrawal, and learning-data deletion.
- Publish a privacy policy before enabling AI analysis.

## Assumptions

- Initial scale is the owner and designated test users.
- Gmail remains the source of truth; D1 stores only consent, derived features, feedback, and recommendation metadata.
- Masked AI payloads are discarded after each request. Content-free error logs are retained for 30 days.
- Learned data is retained until Gmail disconnect, consent withdrawal, or explicit deletion.
- AI is optional. Existing Gmail browsing and manual deletion continue if AI, D1, or Vectorize is unavailable.

## Architecture

`packages/preference` owns deterministic masking, feature extraction, fallback scoring, and validation of structured model output. D1 stores per-user consent, feedback, and recommendation audit metadata. Vectorize stores embeddings of masked examples in a namespace derived from the authenticated user. Workers AI classifies a masked message using the nearest labeled examples and returns a bounded category, preference score, confidence, and short explanation.

The UI adds privacy-policy navigation, AI opt-in settings, preference feedback controls, recommendation reasons, and a delete-data action. It never automatically deletes mail. Existing trash and permanent-delete routes remain the only deletion paths.

## Privacy and Security

- Server-side masking occurs before embedding or generation.
- User identity is represented by a one-way namespace hash outside D1.
- D1 statements are prepared and bound.
- Model output is treated as untrusted input and validated before use.
- AI consent is separate, optional, reversible, and does not gate core Gmail functionality.
- Privacy-policy language covers purpose, fields, retention, destruction, processor/overseas-transfer considerations, rights, automated recommendation logic, and contact details.
- Legal citations were checked against the current Personal Information Protection Act, including Articles 15, 21, 22, 28-8, 30, and 37-2. Final legal review remains the operator's responsibility.

## Decision Log

1. Use Cloudflare-native D1 + Vectorize + Workers AI instead of external AI infrastructure to minimize operational boundaries.
2. Use masked semantic retrieval, not only sender rules, because the user explicitly wants broader LLM involvement.
3. Store derived feedback but never Gmail originals or transient model payloads.
4. Require user confirmation for every trash or permanent-delete action.
5. Fall back to deterministic rules so AI failure never blocks Gmail use.
