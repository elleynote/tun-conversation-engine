import type { Classification, Product } from "../types";
import { clamp } from "../utils";
import { extractResponseText, openAIResponse } from "./openai";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    relevance_score: { type: "integer", minimum: 0, maximum: 5 },
    intent: { type: "string" },
    dialect: { type: "string", enum: ["western", "eastern", "unknown"] },
    commercial_intent: { type: "integer", minimum: 0, maximum: 5 },
    recommended_product_key: { anyOf: [{ type: "string" }, { type: "null" }] },
    recommended_product_keys: { type: "array", items: { type: "string" }, maxItems: 3 },
    response_mode: { type: "string", enum: ["answer_and_recommend", "recommend_only", "answer_only", "do_not_reply"] },
    answer_confidence: { type: "number", minimum: 0, maximum: 1 },
    should_reply: { type: "boolean" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reason: { type: "string" }
  },
  required: ["relevance_score", "intent", "dialect", "commercial_intent", "recommended_product_key", "recommended_product_keys", "response_mode", "answer_confidence", "should_reply", "confidence", "reason"]
};

const recommendationRules = `
Client-approved recommendation policy (highest priority):
- LEARN / relearn / reconnect / improve speaking-reading-writing-grammar-vocabulary / family learning / dialect learning -> Tun Online Armenian School.
- UNDERSTAND / TRANSLATE / meaning / phrase lookup -> Translator for the immediate task. Add Tun only when the post also expresses a long-term learning problem or desire.
- TYPE / WRITE / transliteration / Armenian script -> Keyboard for the immediate task. Add Tun when the post also expresses learning/literacy intent.
- VERB CONJUGATION lookup -> Verb tool for the immediate lookup and Tun when broader learning is also present.
- General grammar, pronunciation, vocabulary nuance, dialect or literacy learning -> Tun.
- Recommend multiple tools only when the user's problem genuinely crosses multiple jobs. Never dump a catalogue of products.
- Do not recommend anything when the post is only about Armenia/culture, language preservation/revitalization policy, institutional support, media/literature, or another discussion without a direct Armenian learning/use need; when promotion would feel forced; in sensitive, grieving, political or otherwise inappropriate discussions; when the user specifically asks for a human/native speaker and the product does not meet that request; or when the account has already recommended Tun in that person/thread recently. Relevant discussions may still be answer_only.
- For a simple one-off translation request such as 'How do you say happy birthday in Armenian?', prefer the Translator only, not a course.
- For long-term learning, Tun takes priority. Where relevant, Tun can mention the 4 lessons for $1 trial.

Response behavior:
- answer_and_recommend: answer the immediate question briefly, then naturally recommend only the relevant resource(s).
- recommend_only: use when a recommendation is useful but the exact language answer should not be invented or confidence is low.
- answer_only: answer helpfully when no product recommendation is appropriate.
- do_not_reply: irrelevant, inappropriate, duplicate/recent recommendation, sensitive, or forced-promotion scenario.
`;

export async function classifyConversation(input: { title?: string | null; content: string; community?: string | null; products: Product[] }): Promise<Classification> {
  if (!process.env.OPENAI_API_KEY) return mockClassify(input.content, input.products);
  const productKeys = input.products.map((p) => `${p.key}: ${p.name} -> ${p.intent_keys.join(", ")}`).join("\n");
  const data = await openAIResponse({
    model: process.env.OPENAI_CLASSIFIER_MODEL || "gpt-5.6-luna",
    reasoning: { effort: "low" },
    instructions: `You classify public conversations for Tun's Armenian-language ecosystem. Be conservative and useful. A high score means the ecosystem can genuinely help the person's actual question. Never force a commercial intervention. Use only provided product keys. Preserve the client's decision rules exactly.\n\n${recommendationRules}\nProducts:\n${productKeys}`,
    input: `Community: ${input.community ?? "unknown"}\nTitle: ${input.title ?? ""}\nConversation: ${input.content}`,
    text: { format: { type: "json_schema", name: "tun_opportunity_classification", strict: true, schema } },
  });
  const parsed = JSON.parse(extractResponseText(data));
  const keys = Array.isArray(parsed.recommended_product_keys) ? parsed.recommended_product_keys.map(String).slice(0, 3) : [];
  return {
    relevance_score: clamp(Number(parsed.relevance_score), 0, 5),
    intent: String(parsed.intent || "unknown"),
    dialect: ["western", "eastern"].includes(parsed.dialect) ? parsed.dialect : "unknown",
    commercial_intent: clamp(Number(parsed.commercial_intent), 0, 5),
    recommended_product_key: parsed.recommended_product_key || keys[0] || null,
    recommended_product_keys: keys,
    response_mode: ["answer_and_recommend", "recommend_only", "answer_only", "do_not_reply"].includes(parsed.response_mode) ? parsed.response_mode : "recommend_only",
    answer_confidence: clamp(Number(parsed.answer_confidence), 0, 1),
    should_reply: Boolean(parsed.should_reply),
    confidence: clamp(Number(parsed.confidence), 0, 1),
    reason: String(parsed.reason || ""),
  };
}

function mockClassify(text: string, products: Product[]): Classification {
  const s = text.toLowerCase();
  const has = (key: string) => products.some((p) => p.key === key && p.active !== false);
  const sensitive = /grief|funeral|death|genocide|politic|war|election|mourning/.test(s);
  if (sensitive) return { relevance_score: 0, intent: "sensitive", dialect: "unknown", commercial_intent: 0, recommended_product_key: null, recommended_product_keys: [], response_mode: "do_not_reply", answer_confidence: 0, should_reply: false, confidence: 0.9, reason: "Sensitive context: do not use the conversation for promotion." };

  const longTermLearning = /learn|course|lessons|fluent|improve|practice|relearn|reconnect|heritage|can't speak|cannot speak|kids|children|grammar|vocabulary|read|write/.test(s);
  const translation = /translate|translation|what does .* mean|how do you say|armenian word for/.test(s);
  const verb = /verb|conjugat|past tense|future tense|present tense/.test(s);
  const keyboard = /keyboard|type armenian|typing armenian|transliterat|armenian letters|armenian script/.test(s);
  const languageNeed = longTermLearning || translation || verb || keyboard || /western armenian|eastern armenian|pronounc|suffix|prefix|sentence structure/.test(s);
  const preservationDiscussion = /revitali[sz]|endanger|language death|dead language|dying language|preserv|institutional|governance|state-building|compulsory school|language policy|literature|media/.test(s);
  const directLanguageNeed = /\b(i|we|my|our)\b.{0,40}\b(want|need|wish|trying|learn|learning|relearn|improve|practice|speak|read|write|study)\b/.test(s)
    || /where can i learn|armenian course|lesson|tutor|learning resource|how do i|how to say|translate|translation|what does .* mean|pronounc|grammar|vocab|verb|conjugat|keyboard|type armenian|typing armenian|transliterat|spell|correct my/.test(s);

  if (preservationDiscussion && !directLanguageNeed) {
    return { relevance_score: 3, intent: "language_preservation_discussion", dialect: s.includes("western armenian") ? "western" : s.includes("eastern armenian") ? "eastern" : "unknown", commercial_intent: 0, recommended_product_key: null, recommended_product_keys: [], response_mode: "answer_only", answer_confidence: 0.8, should_reply: true, confidence: 0.9, reason: "Relevant language-preservation discussion, but the client rules say not to force a product recommendation without a direct learning/use need." };
  }

  if (!languageNeed) return { relevance_score: 1, intent: "other", dialect: "unknown", commercial_intent: 0, recommended_product_key: null, recommended_product_keys: [], response_mode: "do_not_reply", answer_confidence: 0, should_reply: false, confidence: 0.8, reason: "No strong Armenian-language need detected." };

  const keys: string[] = [];
  let intent = "learn_armenian";
  if (translation) { intent = "translation"; if (has("translator")) keys.push("translator"); }
  if (keyboard) { intent = "typing_armenian"; if (has("keyboard")) keys.push("keyboard"); }
  if (verb) { intent = "verb_question"; if (has("verbs")) keys.push("verbs"); }
  if (longTermLearning && has("tun_school")) keys.unshift("tun_school");
  if (!keys.length && has("tun_school")) keys.push("tun_school");

  const unique = [...new Set(keys)].slice(0, 3);
  return {
    relevance_score: 5,
    intent,
    dialect: s.includes("western armenian") ? "western" : s.includes("eastern armenian") ? "eastern" : "unknown",
    commercial_intent: longTermLearning ? 4 : 2,
    recommended_product_key: unique[0] ?? null,
    recommended_product_keys: unique,
    response_mode: "answer_and_recommend",
    answer_confidence: translation ? 0.75 : 0.95,
    should_reply: true,
    confidence: 0.9,
    reason: "Demo classifier matched the client-approved Armenian language recommendation policy.",
  };
}
