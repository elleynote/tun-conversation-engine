# YouTube Integration

The YouTube integration reuses the existing Tun Conversation Engine workflow and is now wired into the main pipeline.

## Production flow

1. `process-pipeline` calls `ingest-syften`.
2. Syften discovers relevant Reddit conversations and YouTube videos.
3. YouTube video discoveries are stored as hidden source records with `suppression_reason = youtube_video_source`.
4. `process-pipeline` calls `ingest-youtube-comments`.
5. `ingest-youtube-comments` uses YouTube Data API v3 to fetch the newest public top-level comments for eligible discovered videos.
6. New YouTube comments are stored as normal `opportunities` rows with `platform = youtube`.
7. The same pipeline classifies new Reddit and YouTube opportunities, routes the appropriate Tun product(s), and generates drafts for qualified opportunities.
8. A human reviews the draft in the dashboard.
9. YouTube posting remains manual in this release. OAuth posting can be added later with the client's YouTube channel authorization.

## Required Supabase Edge Function secrets

```
YOUTUBE_API_KEY=
YOUTUBE_COMMENTS_MAX_RESULTS=100
YOUTUBE_REFRESH_MINUTES=15
```

`YOUTUBE_API_KEY` is read only by Supabase Edge Functions. Never expose it through a `NEXT_PUBLIC_*` variable or Netlify client-side environment variable.

`YOUTUBE_REFRESH_MINUTES` prevents every pipeline run from repeatedly requesting the same videos. Explicit manual requests using `video_id` or `source_opportunity_id` still run immediately.

## Deployment

After pulling the latest `main` branch:

```powershell
supabase functions deploy ingest-syften
supabase functions deploy ingest-youtube-comments
supabase functions deploy process-pipeline
supabase functions deploy classify-opportunity
supabase functions deploy generate-draft
```

No database migration is required for this pipeline update.

## Running the pipeline

A normal call to `process-pipeline` now performs discovery and processing in one run:

```
Syften ingestion
-> YouTube comment ingestion
-> classify new opportunities
-> generate drafts for qualified opportunities
```

The pipeline isolates source failures. For example, if Syften is temporarily unavailable, existing queued opportunities can still be classified and drafted.

The request body may optionally contain:

```json
{
  "limit": 10,
  "ingest": true
}
```

- `limit` controls how many queued opportunities are processed in one run (1-50).
- `ingest: false` skips Syften/YouTube ingestion and processes only the existing queue.

If `CRON_SECRET` is configured, the outer request must include the existing `x-cron-secret` header. Internal pipeline calls forward that secret automatically.

## YouTube ingestion behavior

- Public top-level comments are fetched with YouTube Data API v3.
- Existing comments are detected by the database uniqueness constraint and counted as duplicates instead of being reset to `new`.
- A default run checks up to 20 eligible recent YouTube video discoveries.
- Each discovery is refreshed only after `YOUTUBE_REFRESH_MINUTES` unless an explicit manual/forced request is made.
- `youtube_last_run` records whether the API call succeeded, videos checked, comments fetched, new comments inserted, duplicate comments, and any errors.
- The dashboard reports YouTube as connected only after a successful ingestion run.

## Posting

Direct YouTube posting is intentionally not implemented yet. The current workflow is:

```
approve -> copy/open YouTube -> post -> mark as posted
```

A future posting adapter should use Google OAuth for the actual Tun YouTube channel account.


## Production scheduler

Migration `016_automate_pipeline_cron.sql` adds a secure one-time scheduler setup RPC.

After the migration and updated `process-pipeline` function are deployed, call `process-pipeline` once with:

```json
{
  "configure_schedule": true,
  "schedule": "*/5 * * * *"
}
```

The Edge Function passes its existing `CRON_SECRET` to the service-role-only RPC. The RPC stores the secret and project URL encrypted in Supabase Vault, then creates/updates the `tun-conversation-pipeline` Supabase Cron job.

The scheduled job runs every five minutes and calls `process-pipeline` with:

```json
{
  "limit": 5,
  "ingest": true
}
```

This keeps the production path automatic:

```
Supabase Cron
-> process-pipeline
-> Syften ingestion
-> YouTube comment ingestion
-> AI classification
-> draft generation
-> dashboard review
```

The Cron request uses Vault at runtime; no cron secret is hardcoded in the migration or source control.
