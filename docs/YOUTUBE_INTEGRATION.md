# YouTube Integration

The YouTube foundation is designed to reuse the existing Conversation Engine workflow.

## Flow

1. Syften discovers a relevant YouTube video.
2. `ingest-syften` stores the video as a hidden source record with `suppression_reason = youtube_video_source`.
3. `ingest-youtube-comments` extracts the video ID and requests the newest top-level public comments from the YouTube Data API v3.
4. Each YouTube comment is stored as a normal `opportunities` row with `platform = youtube`.
5. The existing AI classifier, product routing, drafting, review, dismiss/next and audit flow processes the comment.
6. Posting is manual for the first release: approve -> copy/open YouTube -> post -> mark as posted.

## Required secret

Set in Supabase Edge Function secrets when available:

```
YOUTUBE_API_KEY=
YOUTUBE_COMMENTS_MAX_RESULTS=100
```

The API key is read only by the Edge Function. Do not expose it through a NEXT_PUBLIC variable.

## Deployment

After the API key is available:

```powershell
supabase secrets set YOUTUBE_API_KEY=YOUR_KEY
supabase secrets set YOUTUBE_COMMENTS_MAX_RESULTS=100
supabase db push
supabase functions deploy ingest-syften
supabase functions deploy ingest-youtube-comments
supabase functions deploy classify-opportunity
supabase functions deploy generate-draft
```

## First test

Once Syften has produced a YouTube video match, invoke the YouTube comment ingestion function for that source/video. The function also supports a direct `video_id` in its request body for testing.

Expected result:

- hidden Syften YouTube video discovery record
- one opportunity per top-level YouTube comment
- YouTube author/avatar shown in the dashboard
- classification and product routing run through the existing pipeline
- platform-aware review controls say YouTube rather than Reddit

## Posting

Direct posting is intentionally not implemented yet. The current flow is manual. A future OAuth-based posting adapter can use the approved YouTube channel account after the client provides Google authorization.
