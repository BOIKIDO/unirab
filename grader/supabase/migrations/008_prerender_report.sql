-- Store pre-rendered AI content so the report page loads instantly.
-- Description + insights are generated during the scan phase, not on report load.

alter table research_jobs
  add column if not exists description_text text default null,
  add column if not exists description_category text default null,
  add column if not exists insights_summary text default null,
  add column if not exists insights_data jsonb default null;
