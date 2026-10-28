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
    id: "demo-1", platform: "reddit", community: "r/hayeren", author: "diaspora_learner", title: "Where should I start with Western Armenian?",
    content: "My grandparents spoke Western Armenian but I never learned it. Are there any good online resources for a complete beginner?",
    original_url: "https://www.reddit.com/", published_at: new Date(now - 9 * 60000).toISOString(), detected_at: new Date(now - 8 * 60000).toISOString(), relativeTime: "8m ago", status: "awaiting_review", matched_filter: "western armenian learning",
    classification: { relevance_score: 5, intent: "heritage_learning", dialect: "western", commercial_intent: 4, recommended_product_key: "tun_school", recommended_product_keys: ["tun_school"], response_mode: "answer_and_recommend", answer_confidence: 0.95, should_reply: true, confidence: 0.97, reason: "The user has clear long-term Western Armenian learning intent and a heritage motivation." },
    product: demoProducts[0], products: [demoProducts[0]],
    draft: { body: "If your grandparents spoke Western Armenian, I would start with resources that explicitly teach the Western dialect rather than general Armenian material. Tun teaches both dialects, so you can focus on Western Armenian from the beginning, and they currently offer 4 lessons for $1 if you want to try it first.", version: 1, status: "generated" },
  },
  {
    id: "demo-2", platform: "instagram", community: "#learnarmenian", author: "diaspora_polyglot", title: "Question about Western Armenian verbs",
    content: "I started learning Western Armenian but conjugation is so confusing! Any online tools for verbs and lessons?",
    original_url: "https://www.instagram.com/p/DfCiCLMnLTL/", published_at: new Date(now - 25 * 60000).toISOString(), detected_at: new Date(now - 20 * 60000).toISOString(), relativeTime: "20m ago", status: "awaiting_review", matched_filter: "#learnarmenian",
    classification: { relevance_score: 5, intent: "verb_question", dialect: "western", commercial_intent: 4, recommended_product_key: "tun_school", recommended_product_keys: ["tun_school", "verbs"], response_mode: "answer_and_recommend", answer_confidence: 0.96, should_reply: true, confidence: 0.98, reason: "Clear Western Armenian learning intent and verb question on Instagram." },
    product: demoProducts[0], products: [demoProducts[0], demoProducts[3]],
    draft: { body: "Western Armenian verbs differ from Eastern Armenian in several tense forms! Tun (tunapp.com) teaches Western Armenian grammar with structured lessons (they have a 4 lessons for $1 trial), and armenianverbs.com is a dedicated reference tool to look up verb conjugations quickly.", version: 1, status: "generated" },
  },
  {
    id: "demo-3", platform: "x", community: "x.com", author: "armenian_culture", title: "Looking for online Armenian lessons",
    content: "Does anyone know a good platform or online school to learn conversational Armenian from scratch?",
    original_url: "https://x.com/armenian/status/1234567890", published_at: new Date(now - 45 * 60000).toISOString(), detected_at: new Date(now - 40 * 60000).toISOString(), relativeTime: "40m ago", status: "awaiting_review", matched_filter: "learn armenian",
    classification: { relevance_score: 5, intent: "learn_armenian", dialect: "unknown", commercial_intent: 5, recommended_product_key: "tun_school", recommended_product_keys: ["tun_school"], response_mode: "answer_and_recommend", answer_confidence: 0.98, should_reply: true, confidence: 0.99, reason: "Direct question looking for Armenian lessons." },
    product: demoProducts[0], products: [demoProducts[0]],
    draft: { body: "Tun Online Armenian School (tunapp.com) is built specifically for conversational Armenian with 1-on-1 teachers for both Eastern and Western dialects. You can try 4 lessons for $1 to see how you like it!", version: 1, status: "generated" },
  },
  {
    id: "demo-4", platform: "facebook", community: "Armenian Diaspora Network", author: "Sarkis Sarkisian", title: "Resources for learning Western Armenian alphabet",
    content: "Want to teach my children how to read and type in Armenian. What tools or websites do you guys recommend?",
    original_url: "https://www.facebook.com/", published_at: new Date(now - 2 * 3600000).toISOString(), detected_at: new Date(now - 1.8 * 3600000).toISOString(), relativeTime: "2h ago", status: "awaiting_review", matched_filter: "learn armenian",
    classification: { relevance_score: 5, intent: "parent_child_learning", dialect: "western", commercial_intent: 4, recommended_product_key: "keyboard", recommended_product_keys: ["tun_school", "keyboard"], response_mode: "answer_and_recommend", answer_confidence: 0.95, should_reply: true, confidence: 0.96, reason: "Parent looking for typing and reading tools for kids." },
    product: demoProducts[2], products: [demoProducts[0], demoProducts[2]],
    draft: { body: "For typing in the browser without installing layouts, armeniankeyboard.com is great and supports Western rules. For full speaking, reading, and literacy for kids, Tun Online Armenian School (tunapp.com) has interactive 1-on-1 lessons designed for diaspora learners.", version: 1, status: "generated" },
  },
  {
    id: "demo-7", platform: "linkedin", community: "LinkedIn: Armenian Diaspora", author: "Aram Hovhannisyan", title: "Online resources for teaching children conversational Western Armenian",
    content: "Balancing busy work schedules in the diaspora while trying to keep our heritage language alive is tough. Does anyone have recommendations for structured online Armenian tutoring for kids?",
    original_url: "https://www.linkedin.com/feed/update/urn:li:activity:7521296424731414528/", published_at: new Date(now - 1.5 * 3600000).toISOString(), detected_at: new Date(now - 1.2 * 3600000).toISOString(), relativeTime: "1h ago", status: "awaiting_review", matched_filter: "learn armenian",
    classification: { relevance_score: 5, intent: "parent_child_learning", dialect: "western", commercial_intent: 5, recommended_product_key: "tun_school", recommended_product_keys: ["tun_school"], response_mode: "answer_and_recommend", answer_confidence: 0.98, should_reply: true, confidence: 0.99, reason: "Parent asking for online structured Armenian tutoring for diaspora kids on LinkedIn." },
    product: demoProducts[0], products: [demoProducts[0]],
    draft: { body: "Preserving conversational Armenian in the diaspora is one of the most rewarding commitments for families. Tun Online Armenian School (tunapp.com) provides structured 1-on-1 online lessons specifically designed for diaspora learners, covering speaking confidence, vocabulary, and both Western and Eastern dialects. They offer an introductory 4-lesson trial for $1 to see how your children engage with the curriculum.", version: 1, status: "generated" },
  },
  {
    id: "demo-5", platform: "reddit", community: "r/translator", author: "phrase_help", title: "How do I say happy birthday in Armenian?",
    content: "I only need the phrase for a card. How do I say happy birthday in Armenian?",
    original_url: "https://www.reddit.com/", published_at: new Date(now - 46 * 60000).toISOString(), detected_at: new Date(now - 44 * 60000).toISOString(), relativeTime: "44m ago", status: "qualified", matched_filter: "armenian translation",
    classification: { relevance_score: 4, intent: "translation", dialect: "unknown", commercial_intent: 2, recommended_product_key: "translator", recommended_product_keys: ["translator"], response_mode: "answer_and_recommend", answer_confidence: 0.86, should_reply: true, confidence: 0.93, reason: "Immediate translation need with no strong long-term learning signal, so recommend the translator rather than a course." },
    product: demoProducts[1], products: [demoProducts[1]], draft: null,
  },
  {
    id: "demo-6", platform: "reddit", community: "r/armenia", author: "travel_question", title: "Best time to visit Yerevan?",
    content: "Thinking about visiting Yerevan next spring. What month has the nicest weather?",
    original_url: "https://www.reddit.com/", published_at: new Date(now - 5 * 3600000).toISOString(), detected_at: new Date(now - 5 * 3600000).toISOString(), relativeTime: "5h ago", status: "ignored", matched_filter: "armenia",
    classification: { relevance_score: 1, intent: "travel", dialect: "unknown", commercial_intent: 0, recommended_product_key: null, recommended_product_keys: [], response_mode: "do_not_reply", answer_confidence: 0, should_reply: false, confidence: 0.99, reason: "Armenia-related but no relevant language need; Elley's rules say not to recommend anything in this case." },
    product: null, products: [], draft: null,
  }
];
