import { adminClient, json } from "../_shared/client.ts";

Deno.serve(async (req: Request) => {
  try {
    const { opportunity_id } = await req.json();
    if (!opportunity_id) return json({ error: "opportunity_id required" }, 400);
    const supabase = adminClient();
    const { data: opportunity, error } = await supabase.from("opportunities").select("*").eq("id", opportunity_id).single();
    if (error) throw error;
    if (opportunity.status !== "approved") return json({ error: "Opportunity must be explicitly approved internally before publishing" }, 409);

    // Intentionally not implemented yet.
    // Reddit's final publishing route is still awaiting approval/confirmation.
    // If Reddit requires Devvit user actions, posting as the logged-in user must be triggered
    // by a separate explicit manual action inside the approved Reddit flow; dashboard approval
    // alone must not silently submit the Reddit comment.
    // Do not replace this with scraping, browser automation, or unofficial credentials.
    await supabase.from("events").insert({
      opportunity_id,
      event_type: "reddit_publish_waiting",
      severity: "warning",
      message: "Internal approval complete; Reddit publishing route still waiting for approved access and final interaction requirements."
    });
    return json({
      ok: false,
      waiting_for_access: true,
      message: "Reddit publishing remains disabled until Reddit confirms the approved posting route."
    }, 501);
  } catch (error) { return json({ error: error instanceof Error ? error.message : String(error) }, 500); }
});
