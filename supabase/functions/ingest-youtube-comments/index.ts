import { adminClient, json } from "../_shared/client.ts";
import { cronRequestAuthorized } from "../_shared/cron-auth.ts";

type YouTubeSourceRow = {
  id: string;
  title: string | null;
  community: string | null;
  matched_filter: string | null;
  original_url: string | null;
  source_analysis: Record<string, unknown> | null;
};

type IngestionError = {
  video_id: string;
  comment_id?: string;
  error: string;
};

function youtubeVideoId(url?: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "youtu.be") return parsed.pathname.split("/").filter(Boolean)[0] || null;
    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      const watchId = parsed.searchParams.get("v");
      if (watchId) return watchId;
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (["shorts", "live", "embed"].includes(parts[0] || "")) return parts[1] || null;
    }
  } catch {
    return null;
  }
  return null;
}

function commentUrl(videoId: string, commentId: string) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&lc=${encodeURIComponent(commentId)}`;
}

function shouldRefresh(discovery: YouTubeSourceRow, refreshMinutes: number) {
  if (refreshMinutes <= 0) return true;
  const lastFetched = discovery.source_analysis?.youtube_comments_last_fetched_at;
  if (typeof lastFetched !== "string" || !lastFetched) return true;
  const timestamp = Date.parse(lastFetched);
  if (!Number.isFinite(timestamp)) return true;
  return Date.now() - timestamp >= refreshMinutes * 60_000;
}

async function fetchTopLevelComments(apiKey: string, videoId: string, maxResults: number) {
  const url = new URL("https://www.googleapis.com/youtube/v3/commentThreads");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("videoId", videoId);
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("order", "time");
  url.searchParams.set("textFormat", "plainText");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) {
    const reason = data?.error?.errors?.[0]?.reason || data?.error?.message || `YouTube API error ${res.status}`;
    throw new Error(String(reason));
  }
  return Array.isArray(data?.items) ? data.items : [];
}

Deno.serve(async (req: Request) => {
  if (!cronRequestAuthorized(req)) return json({ error: "Unauthorized" }, 401);

  try {
    const apiKey = Deno.env.get("YOUTUBE_API_KEY");
    if (!apiKey) return json({ error: "YOUTUBE_API_KEY missing" }, 500);

    const supabase = adminClient();
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const requestedVideoId = typeof body?.video_id === "string" ? body.video_id.trim() : "";
    const requestedSourceId = typeof body?.source_opportunity_id === "string" ? body.source_opportunity_id.trim() : "";
    const force = body?.force === true;

    const configuredMax = Number(Deno.env.get("YOUTUBE_COMMENTS_MAX_RESULTS") || "100");
    const requestedMax = Number(body?.max_results || configuredMax || 100);
    const maxResults = Number.isFinite(requestedMax)
      ? Math.min(100, Math.max(1, Math.floor(requestedMax)))
      : 100;

    const configuredRefresh = Number(Deno.env.get("YOUTUBE_REFRESH_MINUTES") || "15");
    const refreshMinutes = Number.isFinite(configuredRefresh)
      ? Math.max(0, configuredRefresh)
      : 15;

    const { data: youtubeSource, error: sourceError } = await supabase.from("sources").upsert(
      { key: "youtube_api", name: "YouTube Data API", source_type: "monitoring", enabled: true },
      { onConflict: "key" },
    ).select().single();
    if (sourceError) throw sourceError;

    let discoveries: YouTubeSourceRow[] = [];
    let videosConsidered = 0;
    let videosSkippedRecent = 0;

    if (requestedSourceId) {
      const { data, error } = await supabase
        .from("opportunities")
        .select("id,title,community,matched_filter,original_url,source_analysis")
        .eq("id", requestedSourceId)
        .single();
      if (error) throw error;
      discoveries = data ? [data as YouTubeSourceRow] : [];
      videosConsidered = discoveries.length;
    } else if (requestedVideoId) {
      discoveries = [{
        id: "manual",
        title: null,
        community: null,
        matched_filter: null,
        original_url: `https://www.youtube.com/watch?v=${requestedVideoId}`,
        source_analysis: { youtube_video_id: requestedVideoId },
      }];
      videosConsidered = 1;
    } else {
      const { data, error } = await supabase
        .from("opportunities")
        .select("id,title,community,matched_filter,original_url,source_analysis")
        .eq("platform", "youtube")
        .eq("suppression_reason", "youtube_video_source")
        .order("detected_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      const candidates = (data ?? []) as YouTubeSourceRow[];
      videosConsidered = candidates.length;
      const eligible = candidates.filter((discovery) => force || shouldRefresh(discovery, refreshMinutes));
      videosSkippedRecent = candidates.length - eligible.length;
      discoveries = eligible.slice(0, 20);
    }

    let videosChecked = 0;
    let videosMissingId = 0;
    let commentsFetched = 0;
    let inserted = 0;
    let duplicates = 0;
    const errors: IngestionError[] = [];

    for (const discovery of discoveries) {
      const videoId =
        (typeof discovery.source_analysis?.youtube_video_id === "string" && discovery.source_analysis.youtube_video_id)
        || youtubeVideoId(discovery.original_url);

      if (!videoId) {
        videosMissingId++;
        continue;
      }
      videosChecked++;

      try {
        const items = await fetchTopLevelComments(apiKey, videoId, maxResults);
        commentsFetched += items.length;
        let videoInserted = 0;
        let videoDuplicates = 0;

        for (const thread of items) {
          const top = thread?.snippet?.topLevelComment;
          const snippet = top?.snippet;
          const commentId = String(top?.id || thread?.id || "").trim();
          const text = String(snippet?.textOriginal || snippet?.textDisplay || "").trim();
          if (!commentId || !text) continue;

          const author = snippet?.authorDisplayName || null;
          const avatar = snippet?.authorProfileImageUrl || null;
          const externalId = `youtube-comment:${commentId}`;

          const { error } = await supabase.from("opportunities").insert({
            source_id: youtubeSource.id,
            external_id: externalId,
            platform: "youtube",
            community: discovery.community || `video:${videoId}`,
            author,
            title: discovery.title ? `Comment on: ${discovery.title}` : "YouTube comment",
            content: text,
            original_url: commentUrl(videoId, commentId),
            published_at: snippet?.publishedAt || null,
            detected_at: new Date().toISOString(),
            matched_filter: discovery.matched_filter,
            status: "new",
            source_analysis: {
              avatar,
              youtube_video_id: videoId,
              youtube_comment_id: commentId,
              youtube_channel_id: snippet?.authorChannelId?.value || null,
              source_opportunity_id: discovery.id === "manual" ? null : discovery.id,
            },
            raw_payload: {
              item: {
                backend: "youtube",
                backend_sub: discovery.community || null,
                type: "comment",
                item_url: commentUrl(videoId, commentId),
                author,
                author_avatar: avatar,
                text,
                title: discovery.title || null,
                timestamp: snippet?.publishedAt || null,
              },
              youtube: thread,
            },
            thread_key: `youtube:${videoId}:${commentId}`,
            is_thread_root: true,
            suppression_reason: null,
          });

          if (!error) {
            inserted++;
            videoInserted++;
            continue;
          }

          if (error.code === "23505") {
            duplicates++;
            videoDuplicates++;
            continue;
          }

          errors.push({
            video_id: videoId,
            comment_id: commentId,
            error: error.message || String(error),
          });
        }

        if (discovery.id !== "manual") {
          await supabase.from("opportunities").update({
            source_analysis: {
              ...(discovery.source_analysis || {}),
              youtube_video_id: videoId,
              youtube_discovery: true,
              youtube_comments_last_fetched_at: new Date().toISOString(),
              youtube_comments_last_result: {
                fetched: items.length,
                inserted: videoInserted,
                duplicates: videoDuplicates,
              },
            },
            updated_at: new Date().toISOString(),
          }).eq("id", discovery.id);
        }
      } catch (error) {
        errors.push({
          video_id: videoId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const run = {
      at: new Date().toISOString(),
      ok: errors.length === 0,
      videos_considered: videosConsidered,
      videos_checked: videosChecked,
      videos_skipped_recent: videosSkippedRecent,
      videos_missing_id: videosMissingId,
      comments_fetched: commentsFetched,
      inserted,
      duplicates,
      refresh_minutes: refreshMinutes,
      errors,
    };

    await supabase.from("settings").upsert(
      { key: "youtube_last_run", value: run },
      { onConflict: "key" },
    );

    return json(run);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
