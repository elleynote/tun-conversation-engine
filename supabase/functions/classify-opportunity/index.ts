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
- Verb conjugation, tense, verb-form or verb-choice lookup -> Armenian Verb Conjugation Tool.
- IMPORTANT MIXED-INTENT RULE: if a question asks how to say/translate a phrase AND also asks which verb, tense, conjugation or verb form to use, recommend BOTH the Verb Conjugation Tool and Translator. Do NOT replace the Translator with Tun Online Armenian School unless the user also expresses a genuine long-term learning goal.
- Example: Ã¢â‚¬Å“How to say Ã¢â‚¬ËœWe agreedÃ¢â‚¬â„¢ in Western Armenian? IÃ¢â‚¬â„¢m not sure which verb to use.Ã¢â‚¬Â -> recommended_product_keys must be ["verbs","translator"].
- General grammar/pronunciation/vocabulary nuance/dialect/literacy -> Tun only when the request is broader than a one-off translation/verb lookup.
- Simple one-off translation requests should not be turned into a course recommendation.
- Recommend multiple tools only when the problem truly crosses multiple jobs; never dump a catalogue.
- Do not recommend in culture-only, sensitive, grieving, political, forced-promotion, human/native-speaker-only, or recent-duplicate recommendation scenarios.
- IMPORTANT: "already answered" is NOT, by itself, a reason to ignore a relevant thread. If Tun or an approved tool can add distinct, genuinely useful value for the original poster or later readers, should_reply may still be true. Do not merely repeat the answer already present; add a complementary explanation, practical next step, or the most relevant resource.
- Default to ONE Tun reply per Reddit thread. Do not try to reply to every comment. Individual comments are only separate reply opportunities when a human reviewer explicitly promotes them in the dashboard.
- If the thread is relevant but an exact language answer is uncertain, use recommend_only rather than guessing.
- Tun may mention 4 lessons for $1 where genuinely relevant.

Response modes:
answer_and_recommend = answer briefly then naturally recommend approved resources.
recommend_only = do not guess the exact language answer; recommend the right resource.
answer_only = answer helpfully with no promotion.
do_not_reply = irrelevant/inappropriate/sensitive/forced-promotion or no meaningful value to add.
`;

function detectMixedVerbTranslation(opportunity: any, parsed: any) {
  const text = [
    opportunity?.title || "",
    opportunity?.content || "",
    parsed?.intent || "",
  ].join("\n").toLowerCase();

  const translationPattern = /(how\s+(?:do|would|can|should)\s+(?:i|you|we)\s+say|how\s+to\s+say|translate|translation|meaning|what\s+does|phrase)/i;
  const verbPattern = /(verb|conjugat|tense|verb[ -]?form|verb[ -]?choice|inflect)/i;

  return translationPattern.test(text) && verbPattern.test(text);
}

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
      instructions: `Classify public conversations for Tun's Armenian-language ecosystem. Be useful, selective and non-spammy. Use only listed product keys. Preserve the client rules exactly.\n\n${rules}\nProducts:\n${productList}`,
      input: `Community: ${opportunity.community || "unknown"}\nTitle: ${opportunity.title || ""}\nPrimary conversation: ${opportunity.content}\n\nFull thread context:\n${threadContext || "(no additional thread context)"}`,
      text: { format: { type: "json_schema", name: "tun_opportunity_classification", strict: true, schema } },
    });

    const parsed = JSON.parse(outputText(result));

    // Client-approved deterministic routing guard:
    // A question that asks how to say/translate something AND is about a verb,
    // tense, conjugation or verb choice should route to BOTH the verb tool and
    // the translation tool. This prevents the model from choosing only one.
    const routingText = `${opportunity.title || ""}\n${opportunity.content || ""}`.toLowerCase();
    const hasTranslationTask =
      /\bhow\s+(?:do|would|can|should)\s+(?:i|you|we|they)\s+say\b/i.test(routingText) ||
      /\bhow\s+to\s+say\b/i.test(routingText) ||
      /\btranslate|translation|what\s+does\b.*\bmean|meaning\b/i.test(routingText);
    const hasVerbTask =
      /\bverb|conjugat|tense|inflect|verb\s+form|which\s+verb\b/i.test(routingText);

    if (hasTranslationTask && hasVerbTask) {
      parsed.recommended_product_key = "verbs";
      parsed.recommended_product_keys = ["verbs", "translator"];
      parsed.should_reply = true;
      if (parsed.response_mode === "do_not_reply" || parsed.response_mode === "answer_only") {
        parsed.response_mode = "answer_and_recommend";
      }
      parsed.reason = `${parsed.reason} Client routing rule: this is both a verb/conjugation task and an immediate translation/how-to-say task, so use the verb tool plus the translation tool.`;
    }
    const noReply = parsed.response_mode === "do_not_reply" || !parsed.should_reply;
    const mixedVerbTranslation = !noReply && detectMixedVerbTranslation(opportunity, parsed);

    let keys = Array.isArray(parsed.recommended_product_keys)
      ? parsed.recommended_product_keys.slice(0, 3)
      : [];

    if (noReply) {
      keys = [];
    } else if (mixedVerbTranslation) {
      // Deterministic client-approved safety rail:
      // mixed phrase translation + verb lookup must route to verbs + translator.
      keys = ["verbs", "translator"];
    }

    const primaryKey = noReply
      ? null
      : mixedVerbTranslation
        ? "verbs"
        : (parsed.recommended_product_key || keys[0] || null);

    const reason = mixedVerbTranslation
      ? `${parsed.reason} Client routing rule applied: this combines phrase translation/meaning with verb choice/conjugation, so the approved route is Armenian Verb Conjugation Tool + English to Armenian Translation.`
      : parsed.reason;

    const row = {
      opportunity_id,
      relevance_score: parsed.relevance_score,
      intent: parsed.intent,
      dialect: parsed.dialect,
      commercial_intent: parsed.commercial_intent,
      recommended_product_key: primaryKey,
      recommended_product_keys: keys,
      response_mode: parsed.response_mode,
      answer_confidence: parsed.answer_confidence,
      should_reply: parsed.should_reply,
      confidence: parsed.confidence,
      reason,
      model: Deno.env.get("OPENAI_CLASSIFIER_MODEL") || "gpt-5.6-luna",
      prompt_version: "v5-verb-translation-routing",
      raw_output: result,
    };

    await supabase.from("classifications").upsert(row, { onConflict: "opportunity_id" });
    const threshold = 3;
    const status = parsed.should_reply && parsed.response_mode !== "do_not_reply" && parsed.relevance_score >= threshold ? "qualified" : "ignored";
    await supabase.from("opportunities").update({ status, updated_at: new Date().toISOString() }).eq("id", opportunity_id);
    return json({ ok: true, status, classification: row });
  } catch (error) { return json({ error: error instanceof Error ? error.message : String(error) }, 500); }
});
