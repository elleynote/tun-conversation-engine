# Setup checklist

## Already available
- GitHub
- Netlify
- Supabase
- OpenAI API key

## Next step: connect Supabase + OpenAI before Syften arrives

1. Create/use the Supabase project.
2. Run migrations in order:
   - `001_initial_schema.sql`
   - `002_seed_products.sql`
   - `004_client_recommendation_rules.sql`
   - `003_cron_examples.sql` is optional and should wait until Edge Functions/Syften are ready.
3. For development only, optionally run `supabase/seed.sql` to create one synthetic Reddit opportunity.
4. Add these values to `.env.local` and Netlify:
   - `APP_MODE=live`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
   - `OPENAI_CLASSIFIER_MODEL=gpt-5.6-luna`
   - `OPENAI_DRAFT_MODEL=gpt-5.6-terra`
   - `CRON_SECRET` (random strong value)
5. Deploy these Supabase Edge Functions:
   - `classify-opportunity`
   - `generate-draft`
   - `process-pipeline`
   - `ingest-syften` (can be deployed now but will wait for Syften token)
   - `publish-reddit` (stub only; do not enable posting yet)
6. Set Supabase function secrets:
   - `OPENAI_API_KEY`
   - `OPENAI_CLASSIFIER_MODEL`
   - `OPENAI_DRAFT_MODEL`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SYFTEN_API_TOKEN` later
7. Invoke `process-pipeline` against the seeded opportunity and verify:
   - status goes `new -> qualified -> awaiting_review`
   - classification contains response mode and product keys
   - a draft is generated
   - the dashboard shows it under Needs review
8. Do not enable Reddit publishing until Reddit confirms the approved route.

## Still waiting from client/Riezal
- Syften API token/account setup
- Reddit commercial/developer decision/approval
- Final public URL for Armenian Verb Conjugation Tool
- Community/subreddit rules and brand-voice refinements from Riezal
