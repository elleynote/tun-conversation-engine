import { adminClient, json } from "../_shared/client.ts";
import { outputText, responses } from "../_shared/openai.ts";

const schema = {
  type: "object", additionalProperties: false,
  properties: {
    relevance_score: { type: "integer", minimum: 0, maximum: 5 },
    intent: { type: "string" },
    dialect: { type: "string", enum: ["western","eastern","unknown"] },
    commercial_intent: { type: "integer", minimum: 0, maximum: 5 },
    recommended_product_key: { anyOf: [{ type: "string" }, { type: "null" }] },
    recommended_product_keys: { type: "array", items: { type: "string" }, maxItems: 3 },
    response_mode: { type: "string", enum: ["answer_and_recommend","recommend_only","answer_only","do_not_reply"] },
    answer_confidence: { type: "number", minimum: 0, maximum: 1 },
    should_reply: { type: "boolean" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reason: { type: "string" }
  },
  required: ["relevance_score","intent","dialect","commercial_intent","recommended_product_key","recommended_product_keys","response_mode","answer_confidence","should_reply","confidence","reason"]
};

const rules = `
Client-approved rules:
- Long-term learning/relearning/reconnection/speaking confidence/family learning/dialect/grammar/vocabulary/literacy -> Tun Online Armenian School.
- Immediate translation/meaning -> Translator. Add Tun only when there is genuine longer-term learning intent.
- Immediate typing/transliteration/script -> Keyboard. Add Tun when there is learning/literacy intent.
- Verb conjugation lookup -> Verb tool. Add Tun when there is broader learning intent.
- General grammar/pronunciation/vocabulary nuance/dialect/literacy -> Tun.
- Simple one-off translation requests should not be turned into a course recommendation.
- Recommend multiple tools only when the problem truly crosses multiple jobs; never dump a catalogue.
- Do not recommend in culture-only, sensitive, grieving, political, forced-promotion, human/native-speaker-only, or recent-duplicate recommendation scenarios.
- If the thread already contains a clear and sufficient answer, use do_not_reply unless Tun can add substantial new value. Do not reply merely to insert a product mention.
- Tun may mention 4 lessons for $1 where genuinely relevant.

Response modes:
answer_and_recommend = answer briefly then naturally recommend approved resources.
recommend_only = do not guess the exact language answer; recommend the right resource.
answer_only = answer helpfully with no promotion.
do_not_reply = irrelevant/inappropriate/sensitive/duplicate/forced-promotion.
`;

Deno.serve(async (req: Request) => {
  try {
    const { opportunity_id } = await req.json();
    if (!opportunity_id) return json({ error: "opportunity_id required" }, 400);
    const supabase = adminClient();
    const [{ data: opportunity, error: oppError }, { data: products, error: productError }] = await Promise.all([
      supabase.from("opportunities").select("*").eq("id", opportunity_id).single(),
      supabase.from("products").select("*").eq("active", true).order("priority"),
    ]);
    if (oppError) throw oppError; if (productError) throw productError;

    let threadContext = "";
    if (opportunity.thread_key) {
      const { data: threadRows, error: threadError } = await supabase
        .from("opportunities")
        .select("id,title,content,original_url,is_thread_root,detected_at")
        .eq("thread_key", opportunity.thread_key)
        .order("is_thread_root", { ascending: false })
        .order("detected_at", { ascending: true });
      if (threadError) throw threadError;
      threadContext = (threadRows ?? []).map((r: any, i: number) =>
        `${r.is_thread_root ? "ROOT POST" : `COMMENT ${i}`}: ${r.content || ""}`
      ).join("\n\n");
    }

    const productList = (products ?? []).map((p: any) => `${p.key}: ${p.name} -> ${(p.intent_keys || []).join(", ")}`).join("\n");
    const result = await responses({
      model: Deno.env.get("OPENAI_CLASSIFIER_MODEL") || "gpt-5.6-luna",
      reasoning: { effort: "low" },
      instructions: `Classify public conversations for Tun's Armenian-language ecosystem. Be conservative, useful and non-spammy. Use only listed product keys. Preserve the business rules exactly.\n\n${rules}\nProducts:\n${productList}`,
      input: `Community: ${opportunity.community || "unknown"}\nTitle: ${opportunity.title || ""}\nPrimary conversation: ${opportunity.content}\n\nFull thread context:\n${threadContext || "(no additional thread context)"}`,
      text: { format: { type: "json_schema", name: "tun_opportunity_classification", strict: true, schema } },
    });
    const parsed = JSON.parse(outputText(result));
    const keys = Array.isArray(parsed.recommended_product_keys) ? parsed.recommended_product_keys.slice(0, 3) : [];
    const row = {
      opportunity_id,
      relevance_score: parsed.relevance_score,
      intent: parsed.intent,
      dialect: parsed.dialect,
      commercial_intent: parsed.commercial_intent,
      recommended_product_key: parsed.recommended_product_key || keys[0] || null,
      recommended_product_keys: keys,
      response_mode: parsed.response_mode,
      answer_confidence: parsed.answer_confidence,
      should_reply: parsed.should_reply,
      confidence: parsed.confidence,
      reason: parsed.reason,
      model: Deno.env.get("OPENAI_CLASSIFIER_MODEL") || "gpt-5.6-luna",
      prompt_version: "v2-client-rules",
      raw_output: result,
    };
    await supabase.from("classifications").upsert(row, { onConflict: "opportunity_id" });
    const threshold = 3;
    const status = parsed.should_reply && parsed.response_mode !== "do_not_reply" && parsed.relevance_score >= threshold ? "qualified" : "ignored";
    await supabase.from("opportunities").update({ status, updated_at: new Date().toISOString() }).eq("id", opportunity_id);
    return json({ ok: true, status, classification: row });
  } catch (error) { return json({ error: error instanceof Error ? error.message : String(error) }, 500); }
});
