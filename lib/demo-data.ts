import type { OpportunityView, Product } from "./types";

export const demoProducts: Product[] = [
  {
    key: "tun_school",
    name: "Tun Online Armenian School",
    description: "Structured Armenian learning for long-term speaking, reading, writing, grammar, vocabulary and dialect development.",
    url: "https://tunapp.com/",
    intent_keys: ["learn_armenian", "heritage_learning", "parent_child_learning", "speaking_confidence", "dialect_learning", "grammar_learning", "literacy"],
    priority: 10,
    metadata: {
      offer: "Try 4 lessons for $1 where relevant.",
      claims: ["Supports both Eastern and Western Armenian learning."],
    },
  },
  {
    key: "translator",
    name: "English to Armenian Translation",
    description: "Instant Western Armenian translation and meaning support, positioned around linguistic accuracy.",
    url: "https://translatearmenian.com/",
    intent_keys: ["translation", "meaning", "phrase_lookup"],
    priority: 20,
    metadata: {
      claims: ["Focused on Western Armenian instant translation.", "Use for immediate translation and meaning tasks."],
    },
  },
  {
    key: "keyboard",
    name: "Armenian Keyboard",
    description: "Browser-based Armenian keyboard with separate Eastern and Western linguistic rules and defined phonetic conversion behavior.",
    url: "https://armeniankeyboard.com/",
    intent_keys: ["typing_armenian", "transliteration", "armenian_script"],
    priority: 30,
    metadata: {
      claims: [
        "Separate Eastern and Western rules are maintained where orthography, pronunciation, transliteration and verb forms differ.",
        "Uses defined phonetic conversion rules rather than simple one-key character substitution.",
      ],
    },
  },
  {
    key: "verbs",
    name: "Armenian Verb Conjugation Tool",
    description: "Dedicated Armenian verb-conjugation reference for forms and tense lookups.",
    url: null,
    intent_keys: ["verb_question"],
    priority: 40,
    metadata: { awaiting_url: true },
  },
];

const now = Date.now();
export const demoOpportunities: OpportunityView[] = [
  {
    id: "demo-1", platform: "Reddit", community: "r/hayeren", author: "diaspora_learner", title: "Where should I start with Western Armenian?",
    content: "My grandparents spoke Western Armenian but I never learned it. Are there any good online resources for a complete beginner?",
    original_url: "https://www.reddit.com/", published_at: new Date(now - 9 * 60000).toISOString(), detected_at: new Date(now - 8 * 60000).toISOString(), relativeTime: "8m ago", status: "awaiting_review", matched_filter: "western armenian learning",
    classification: { relevance_score: 5, intent: "heritage_learning", dialect: "western", commercial_intent: 4, recommended_product_key: "tun_school", recommended_product_keys: ["tun_school"], response_mode: "answer_and_recommend", answer_confidence: 0.95, should_reply: true, confidence: 0.97, reason: "The user has clear long-term Western Armenian learning intent and a heritage motivation." },
    product: demoProducts[0], products: [demoProducts[0]],
    draft: { body: "If your grandparents spoke Western Armenian, I would start with resources that explicitly teach the Western dialect rather than general Armenian material. Tun teaches both dialects, so you can focus on Western Armenian from the beginning, and they currently offer 4 lessons for $1 if you want to try it first.", version: 1, status: "generated" },
  },
  {
    id: "demo-2", platform: "Reddit", community: "r/translator", author: "phrase_help", title: "How do I say happy birthday in Armenian?",
    content: "I only need the phrase for a card. How do I say happy birthday in Armenian?",
    original_url: "https://www.reddit.com/", published_at: new Date(now - 46 * 60000).toISOString(), detected_at: new Date(now - 44 * 60000).toISOString(), relativeTime: "44m ago", status: "qualified", matched_filter: "armenian translation",
    classification: { relevance_score: 4, intent: "translation", dialect: "unknown", commercial_intent: 2, recommended_product_key: "translator", recommended_product_keys: ["translator"], response_mode: "answer_and_recommend", answer_confidence: 0.86, should_reply: true, confidence: 0.93, reason: "Immediate translation need with no strong long-term learning signal, so recommend the translator rather than a course." },
    product: demoProducts[1], products: [demoProducts[1]], draft: null,
  },
  {
    id: "demo-3", platform: "Reddit", community: "r/languagelearning", author: "polyglot_newbie", title: "How do I type Armenian on a normal laptop?",
    content: "I'm learning Armenian and I want to practice writing, but installing layouts on every device is annoying. Is there a browser option?",
    original_url: "https://www.reddit.com/", published_at: new Date(now - 3 * 3600000).toISOString(), detected_at: new Date(now - 2.9 * 3600000).toISOString(), relativeTime: "3h ago", status: "drafted", matched_filter: "type armenian keyboard",
    classification: { relevance_score: 5, intent: "typing_armenian", dialect: "unknown", commercial_intent: 4, recommended_product_key: "keyboard", recommended_product_keys: ["tun_school", "keyboard"], response_mode: "answer_and_recommend", answer_confidence: 0.98, should_reply: true, confidence: 0.97, reason: "The immediate task is typing, while the post also has an explicit ongoing learning goal." },
    product: demoProducts[2], products: [demoProducts[0], demoProducts[2]], draft: { body: "A browser-based keyboard is the easiest option if you move between devices. ArmenianKeyboard.com lets you type and copy Armenian without installing a system layout, and it keeps Eastern and Western rules separate rather than treating them as one identical mapping. Since you're actively learning as well, Tun can help with the reading and writing side over time.", version: 1, status: "generated" },
  },
  {
    id: "demo-4", platform: "Reddit", community: "r/armenia", author: "travel_question", title: "Best time to visit Yerevan?",
    content: "Thinking about visiting Yerevan next spring. What month has the nicest weather?",
    original_url: "https://www.reddit.com/", published_at: new Date(now - 5 * 3600000).toISOString(), detected_at: new Date(now - 5 * 3600000).toISOString(), relativeTime: "5h ago", status: "ignored", matched_filter: "armenia",
    classification: { relevance_score: 1, intent: "travel", dialect: "unknown", commercial_intent: 0, recommended_product_key: null, recommended_product_keys: [], response_mode: "do_not_reply", answer_confidence: 0, should_reply: false, confidence: 0.99, reason: "Armenia-related but no relevant language need; Elley's rules say not to recommend anything in this case." },
    product: null, products: [], draft: null,
  }
];
