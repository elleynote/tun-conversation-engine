import { adminClient, json } from "../_shared/client.ts";

Deno.serve(async () => {
  try {
    const token = Deno.env.get("SYFTEN_API_TOKEN");
    if (!token) return json({ error: "SYFTEN_API_TOKEN missing" }, 500);
    const supabase = adminClient();
    const { data: source, error: sourceError } = await supabase.from("sources").upsert({ key: "syften", name: "Syften", source_type: "monitoring", enabled: true }, { onConflict: "key" }).select().single();
    if (sourceError) throw sourceError;

    const { data: cursor } = await supabase.from("settings").select("value").eq("key", "syften_cursor").maybeSingle();
    const after = cursor?.value?.matched_on;
    const res = await fetch("https://syften.com/api/0.1/items/get", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ limit: 100, show: "all", ...(after ? { after } : {}) }),
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload?.error || `Syften error ${res.status}`);
    const matches = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
    let newest = after;
    let inserted = 0;
    for (const m of matches) {
      if (!newest || new Date(m.matched_on) > new Date(newest)) newest = m.matched_on;
      const { error } = await supabase.from("opportunities").upsert({
        source_id: source.id,
        external_id: m.id,
        platform: m.item?.backend || "unknown",
        community: m.item?.backend_sub || null,
        author: m.item?.author || null,
        title: m.item?.title || null,
        content: m.item?.text || "",
        original_url: m.item?.item_url || null,
        published_at: m.item?.timestamp || null,
        detected_at: m.matched_on,
        matched_filter: m.filter,
        status: "new",
        source_analysis: m.item?.analysis || {},
        raw_payload: m,
      }, { onConflict: "source_id,external_id", ignoreDuplicates: true });
      if (!error) inserted++;
    }
    if (newest) await supabase.from("settings").upsert({ key: "syften_cursor", value: { matched_on: newest } }, { onConflict: "key" });
    return json({ ok: true, fetched: matches.length, processed: inserted, cursor: newest });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
