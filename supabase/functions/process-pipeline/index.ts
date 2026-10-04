import { adminClient, json } from "../_shared/client.ts";
import { cronRequestAuthorized } from "../_shared/cron-auth.ts";

async function invoke(name: string, body: unknown) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase environment variables missing");

  const headers: Record<string, string> = {
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
  };
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret) headers["x-cron-secret"] = cronSecret;

  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `${name} failed with HTTP ${res.status}`);
  return data;
}

async function safeInvoke(name: string, body: unknown) {
  try {
    return await invoke(name, body);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

Deno.serve(async (req: Request) => {
  if (!cronRequestAuthorized(req)) return json({ error: "Unauthorized" }, 401);

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const requestedLimit = Number(body?.limit ?? 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(50, Math.max(1, Math.floor(requestedLimit)))
      : 10;
    const shouldIngest = body?.ingest !== false;
    const forceYouTube = body?.force_youtube === true;
    const youtubeMaxResults = Number.isFinite(Number(body?.youtube_max_results))
      ? Math.min(100, Math.max(1, Math.floor(Number(body.youtube_max_results))))
      : undefined;

    const ingestion: Record<string, unknown> = {};
    if (shouldIngest) {
      // One pipeline run now performs the complete discovery flow:
      // Syften -> YouTube public comments -> AI classification/drafting.
      // Failures are isolated so an unavailable source does not prevent the
      // existing queue from being processed.
      ingestion.syften = await safeInvoke("ingest-syften", {});
      ingestion.youtube = await safeInvoke("ingest-youtube-comments", {
        force: forceYouTube,
        ...(youtubeMaxResults ? { max_results: youtubeMaxResults } : {}),
      });
    }

    const supabase = adminClient();
    const { data: fresh, error } = await supabase
      .from("opportunities")
      .select("id,status")
      .in("status", ["new", "qualified"])
      .order("detected_at")
      .limit(limit);
    if (error) throw error;

    const results: Array<Record<string, unknown>> = [];
    let failures = 0;

    for (const row of fresh ?? []) {
      try {
        if (row.status === "new") {
          const classified = await invoke("classify-opportunity", { opportunity_id: row.id });
          results.push({ id: row.id, classified });

          if (classified?.status === "qualified") {
            const drafted = await invoke("generate-draft", { opportunity_id: row.id });
            results.push({ id: row.id, drafted });
          }
        } else if (row.status === "qualified") {
          const drafted = await invoke("generate-draft", { opportunity_id: row.id });
          results.push({ id: row.id, drafted });
        }
      } catch (error) {
        failures++;
        results.push({
          id: row.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const run = {
      at: new Date().toISOString(),
      queue_limit: limit,
      opportunities_considered: (fresh ?? []).length,
      processed_count: results.length,
      failures,
      ingestion,
    };

    await supabase.from("settings").upsert(
      { key: "pipeline_last_run", value: run },
      { onConflict: "key" },
    );

    return json({
      ok: failures === 0,
      ingestion,
      opportunities_considered: (fresh ?? []).length,
      failures,
      processed: results,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
