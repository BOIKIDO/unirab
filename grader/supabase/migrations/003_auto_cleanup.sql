-- Auto-delete research jobs older than 3 hours
-- Requires pg_cron extension (enabled on Supabase Pro / paid plans).
-- query_results, competitors, leads all CASCADE DELETE from research_jobs.

create extension if not exists pg_cron;

-- Run every 30 minutes, delete jobs older than 3 hours
select cron.schedule(
  'delete-expired-research-jobs',
  '*/30 * * * *',
  $$
    delete from research_jobs
    where created_at < now() - interval '3 hours';
  $$
);
