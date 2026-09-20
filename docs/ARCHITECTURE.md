# Architecture

## Core principle

Tun owns the opportunity data, AI decisions, product routing, drafts, approvals and action history. Listening providers are replaceable source adapters.

```text
Syften / future sources
        |
        v
Normalization + deduplication
        |
        v
Supabase Postgres
        |
        v
GPT-5.6 Luna classification
  |                 |
ignore            qualified
                    |
                    v
              Product router
                    |
                    v
            GPT-5.6 Terra draft
                    |
                    v
             Review dashboard
                    |
          Approve / Edit / Reject
                    |
                    v
            Publishing adapter
                    |
                    v
             Audit + tracking
```

## State machine

`new -> classified -> qualified -> drafted -> awaiting_review -> approved -> posted`

Terminal/alternate states:

- `ignored`
- `rejected`
- `failed`

## Why the code has demo and live modes

External access is arriving at different times. Demo mode allows the application, review workflow and UI to be developed and tested immediately. Live mode switches repositories and integrations to Supabase/OpenAI/Syften without changing the user interface.

## Source adapter rule

Every source should normalize into the same opportunity model:

- platform
- community
- author
- title
- content
- original URL
- source timestamp
- external ID
- matched filter
- raw payload

No source-specific fields should leak into core business logic unless stored in `raw_payload` or source metadata.

## AI split

### Classification

Cost-sensitive model: `gpt-5.6-luna` by default.

Output:

- relevance score 0-5
- intent
- dialect
- commercial intent 0-5
- recommended product key
- should reply
- confidence
- reason

### Drafting

Higher-quality model: `gpt-5.6-terra` by default.

Inputs include:

- original conversation
- classification
- routed product
- community rules
- Tun brand voice

The reply should answer the user first, avoid pretending to be an ordinary unaffiliated person, avoid aggressive promotion, and only mention a Tun product when relevant.

## Publishing rule

During Phase 1, the dashboard requires explicit human approval. The final Reddit submission mechanism is intentionally not assumed until Reddit confirms the approved route. If the approved route is Devvit user actions, Reddit requires a separate explicit user action for the comment submission; if Reddit approves another commercial API route, its conditions will control the final publishing step.


## Reddit publishing status (September 2026)

Discovery and publishing are intentionally separate. Syften is the planned discovery layer because Devvit is not a Reddit-wide social-listening crawler. The dashboard can approve/edit/reject a draft, but publishing remains disabled until Reddit confirms the commercial/developer route. If the final route is Devvit user actions, Reddit requires a separate explicit user action before posting as the logged-in user; internal dashboard approval must not silently become a Reddit comment.
