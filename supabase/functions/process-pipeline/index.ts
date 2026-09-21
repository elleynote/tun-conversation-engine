import { adminClient, json } from "../_shared/client.ts";
import { cronRequestAuthorized } from "../_shared/cron-auth.ts";

async function invoke(name: string, body: unknown) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${url}/functions/v1/${name}`, { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `${name} failed`);
  return data;
}

Deno.serve(async (req: Request) => {
  if (!cronRequestAuthorized(req)) return json({ error: "Unauthorized" }, 401);
  try {
    const supabase = adminClient();
    const { data: fresh, error } = await supabase.from("opportunities").select("id,status").in("status", ["new","qualified"]).order("detected_at").limit(10);
    if (error) throw error;
    const results = [];
    for (const row of fresh ?? []) {
      if (row.status === "new") {
        const classified = await invoke("classify-opportunity", { opportunity_id: row.id });
        results.push({ id: row.id, classified });
        if (classified.status === "qualified") results.push({ id: row.id, drafted: await invoke("generate-draft", { opportunity_id: row.id }) });
      } else if (row.status === "qualified") {
        results.push({ id: row.id, drafted: await invoke("generate-draft", { opportunity_id: row.id }) });
      }
    }
    await supabase.from("settings").upsert({
      key: "pipeline_last_run",
      value: { at: new Date().toISOString(), processed_count: results.length }
    }, { onConflict: "key" });
    return json({ ok: true, processed: results });
  } catch (error) { return json({ error: error instanceof Error ? error.message : String(error) }, 500); }
});
