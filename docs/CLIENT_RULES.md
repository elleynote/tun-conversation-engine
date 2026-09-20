# Client-approved recommendation rules

This file captures Elley's current product and response rules and should be treated as product/business logic, not merely prompt copy.

## Notification preference

Dashboard only. No email or Slack notifications are required for Phase 1.

## Current products

### Tun Online Armenian School
- URL: https://tunapp.com/
- Primary job: long-term Armenian learning.
- Use for: learning/relearning, heritage reconnection, speaking confidence, children/family learning, Eastern/Western lessons, grammar, vocabulary, pronunciation and literacy.
- Offer: mention "4 lessons for $1" only where relevant and natural.

### English to Armenian Translation
- URL: https://translatearmenian.com/
- Primary job: immediate translation/meaning.
- Positioning: Western Armenian instant translation, with emphasis on accuracy.
- Use for: word/phrase/sentence meaning and translation requests.

### Armenian Keyboard
- URL: https://armeniankeyboard.com/
- Primary job: typing Armenian / transliteration / producing Armenian script.
- Approved detail: separate Eastern and Western rules are maintained where orthography, pronunciation, transliteration and verb forms differ.
- Approved detail: defined phonetic conversion rules are used rather than simple one-key substitution.

### Armenian Verb Conjugation Tool
- Primary job: immediate verb-form and tense lookup.
- Public URL: pending confirmation.

## Priority decision rule

1. Long-term learning intent -> Tun.
2. Immediate translation/meaning -> Translator; add Tun only if there is also a genuine learning problem/desire.
3. Immediate typing/transliteration -> Keyboard; add Tun when the person is also learning or wants literacy improvement.
4. Verb lookup -> Verb tool; add Tun for broader learning intent.
5. General grammar/pronunciation/vocabulary/dialect/literacy -> Tun.

Do not recommend every product. Multiple tools are allowed only when the person's problem genuinely crosses multiple jobs.

## Response modes

- `answer_and_recommend`: answer the immediate question briefly, then naturally recommend the relevant product(s).
- `recommend_only`: recommendation is useful, but the exact language answer should not be guessed or confidence is too low.
- `answer_only`: useful answer is appropriate but a recommendation would feel forced.
- `do_not_reply`: irrelevant, sensitive, political, grieving, inappropriate, duplicate/recent recommendation, culture-only with no language need, or human/native-speaker request that the product cannot meet.

## Accuracy guardrail

The system must not invent Armenian translations, pronunciation, dialect facts or grammar when uncertain. If confidence is low, it should recommend the appropriate tool rather than hallucinate a language answer.
