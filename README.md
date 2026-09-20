# Tun Conversation Engine

Starter implementation for Tun's AI-assisted social listening and commenting system.

## What is already implemented

- Next.js 16 App Router dashboard
- Demo mode that works without any external credentials
- Opportunity list and detail/review UI
- Approve / reject / edit draft workflow
- Supabase production schema + seed migration
- Server-side Supabase repository adapter
- OpenAI Responses API classifier using GPT-5.6 Luna
- OpenAI Responses API drafting using GPT-5.6 Terra
- Tun product routing
- Syften API client based on the current `POST /api/0.1/items/get` endpoint
- Supabase Edge Function stubs for Syften ingestion, pipeline processing, classification, drafting and Reddit publishing
- Netlify configuration
- Health/status endpoint showing which integrations are configured

## Current project rule

Phase 1 publishing is:

**conversation detected -> AI classifies -> AI drafts -> human reviews/edits -> internal approval -> approved Reddit publishing flow (final action depends on Reddit's confirmed access route)**

The system must not silently auto-post from AI during the initial rollout.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

The default `APP_MODE=demo` requires no Supabase, Syften, OpenAI or Reddit credentials. It uses realistic sample data so the interface and workflow can be reviewed immediately.

## Connect Supabase

1. Create/open the Supabase project.
2. Run the SQL files in `supabase/migrations` in order (or use the Supabase CLI).
3. Add these values to `.env.local`:

```env
APP_MODE=live
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

4. Add the same environment variables in Netlify.
5. Never expose `SUPABASE_SERVICE_ROLE_KEY` in browser/client code.

## Connect OpenAI

Add:

```env
OPENAI_API_KEY=...
OPENAI_CLASSIFIER_MODEL=gpt-5.6-luna
OPENAI_DRAFT_MODEL=gpt-5.6-terra
```

The implementation uses the Responses API and JSON Schema structured output for classification.

## Connect Syften later

When Riezal provides the Syften token:

```env
SYFTEN_API_TOKEN=...
SYFTEN_API_BASE_URL=https://syften.com
```

The source adapter is already prepared in `lib/syften/client.ts`, and the production Supabase function is in `supabase/functions/ingest-syften`.

Current Syften ingestion uses `POST /api/0.1/items/get` with bearer-token auth, normalizes each match, and deduplicates it by `(source_id, external_id)`.

## Reddit publishing

The repository deliberately contains an interface/stub rather than assuming credentials or approval that have not yet been confirmed. Once the correct Reddit developer/commercial publishing route is approved, implement the real request in:

`supabase/functions/publish-reddit/index.ts`

The UI already models the required explicit human approval step.

## Netlify

Push the repository to GitHub and connect it in Netlify. Netlify supports modern Next.js App Router projects through its OpenNext adapter. Add the same environment variables in the Netlify project settings.

## Project folders

```text
app/                    Next.js pages and API routes
components/             Dashboard/review UI
lib/                    data, AI, routing, Syften and Supabase adapters
supabase/migrations/    production database schema and seeds
supabase/functions/     production Edge Function integrations
docs/                   architecture/setup/handoff notes
```

## Development sequence

1. Run and review demo UI.
2. Connect Supabase and apply migrations.
3. Verify database-backed dashboard.
4. Add OpenAI key and test classification/drafting.
5. Add Syften token and ingest real Reddit opportunities.
6. Refine filters, product mapping, brand voice and community rules with Riezal.
7. Complete approved Reddit publishing integration.
8. Add tracking/notifications.
9. Add other source adapters later.

See `docs/SETUP_CHECKLIST.md` and `docs/ARCHITECTURE.md` for the full handoff.


## v0.2 client rules now encoded

The starter now reflects Elley's September 20 requirements:

- Dashboard-only notifications.
- Tun Online Armenian School: https://tunapp.com/ and the 4 lessons for $1 offer where relevant.
- Armenian Keyboard: https://armeniankeyboard.com/ with approved Eastern/Western and phonetic-conversion positioning.
- Translation tool: https://translatearmenian.com/ focused on Western Armenian instant translation.
- Recommendation rules distinguish long-term learning from immediate translation/typing/verb tasks.
- Drafting supports four response modes: answer + recommend, recommend only, answer only, or do not reply.
- Low-confidence language answers should not be invented.
- Reddit discovery remains separate from Devvit publishing; Reddit publishing stays disabled until approved access is connected.

See `docs/CLIENT_RULES.md` and `docs/TEST_CASES.md`.
