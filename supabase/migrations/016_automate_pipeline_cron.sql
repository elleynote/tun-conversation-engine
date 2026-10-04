-- Automate the Tun Conversation Engine pipeline with Supabase Cron.
-- The Edge Function calls configure_tun_pipeline_cron once after deployment.
-- That stores the existing CRON_SECRET in Vault and schedules process-pipeline.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault with schema vault;

create or replace function public.configure_tun_pipeline_cron(
  p_cron_secret text,
  p_schedule text default '*/5 * * * *'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cron_secret_id uuid;
  v_project_url_id uuid;
  v_job_id bigint;
  v_project_url constant text := 'https://sxzicctnaptznbonjzhv.supabase.co';
begin
  if p_cron_secret is null or length(trim(p_cron_secret)) < 16 then
    raise exception 'A valid cron secret is required';
  end if;

  if p_schedule is null or length(trim(p_schedule)) = 0 then
    raise exception 'A cron schedule is required';
  end if;

  select id
    into v_cron_secret_id
    from vault.secrets
   where name = 'tun_pipeline_cron_secret'
   limit 1;

  if v_cron_secret_id is null then
    perform vault.create_secret(
      p_cron_secret,
      'tun_pipeline_cron_secret',
      'Tun Conversation Engine scheduled pipeline authentication secret'
    );
  else
    perform vault.update_secret(
      v_cron_secret_id,
      p_cron_secret,
      'tun_pipeline_cron_secret',
      'Tun Conversation Engine scheduled pipeline authentication secret'
    );
  end if;

  select id
    into v_project_url_id
    from vault.secrets
   where name = 'tun_pipeline_project_url'
   limit 1;

  if v_project_url_id is null then
    perform vault.create_secret(
      v_project_url,
      'tun_pipeline_project_url',
      'Tun Conversation Engine Supabase project URL'
    );
  else
    perform vault.update_secret(
      v_project_url_id,
      v_project_url,
      'tun_pipeline_project_url',
      'Tun Conversation Engine Supabase project URL'
    );
  end if;

  select cron.schedule(
    'tun-conversation-pipeline',
    p_schedule,
    $job$
      select net.http_post(
        url := (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'tun_pipeline_project_url'
          limit 1
        ) || '/functions/v1/process-pipeline',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'tun_pipeline_cron_secret'
            limit 1
          )
        ),
        body := '{"limit":5,"ingest":true}'::jsonb,
        timeout_milliseconds := 120000
      ) as request_id;
    $job$
  )
  into v_job_id;

  return jsonb_build_object(
    'ok', true,
    'job_id', v_job_id,
    'job_name', 'tun-conversation-pipeline',
    'schedule', p_schedule,
    'queue_limit', 5
  );
end;
$$;

revoke all on function public.configure_tun_pipeline_cron(text, text) from public;
revoke all on function public.configure_tun_pipeline_cron(text, text) from anon;
revoke all on function public.configure_tun_pipeline_cron(text, text) from authenticated;
grant execute on function public.configure_tun_pipeline_cron(text, text) to service_role;
