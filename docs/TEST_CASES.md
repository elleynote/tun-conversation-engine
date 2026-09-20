# Recommendation logic test cases

Use these before connecting live Syften data.

| Conversation | Expected routing | Expected mode |
| --- | --- | --- |
| "I wish I spoke Armenian. Where should I start?" | Tun | answer_and_recommend |
| "I spoke Armenian as a child and forgot most of it." | Tun | answer_and_recommend |
| "How do I say happy birthday in Armenian?" | Translator | answer_and_recommend |
| "My grandmother sends Armenian messages and I wish I could understand them." | Tun + Translator | answer_and_recommend |
| "How do I type Armenian on my laptop?" | Keyboard (plus Tun only if learning intent exists) | answer_and_recommend |
| "I'm learning Armenian but can't type the alphabet." | Tun + Keyboard | answer_and_recommend |
| "How do I conjugate this Armenian verb?" | Verb tool (+ Tun if broader learning intent exists) | answer_and_recommend |
| "Best restaurants in Yerevan?" | None | do_not_reply |
| Sensitive/political/grieving thread | None | do_not_reply |
| "I need a native Armenian speaker to interpret live for me." | None unless a matching human service is added | do_not_reply |
| Exact language question where model confidence is low | Relevant utility | recommend_only |

The classifier should never turn every Armenian-related post into a sales opportunity.
