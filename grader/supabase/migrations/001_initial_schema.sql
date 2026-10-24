-- AI Visibility Grader — Initial Schema

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────
-- research_jobs
-- ─────────────────────────────────────────
create table if not exists research_jobs (
  id               uuid primary key default gen_random_uuid(),
  business_name    text not null,
  website_url      text,
  primary_service  text,
  location_city    text,
  location_state   text,
  keywords         text[],
  status           text not null default 'pending'
                     check (status in ('pending','running','complete','failed')),
  score_overall    int,
  score_chatgpt    int,
  score_perplexity int,
  score_gemini     int,
  created_at       timestamptz not null default now()
);

create index if not exists research_jobs_status_idx on research_jobs(status);
create index if not exists research_jobs_created_at_idx on research_jobs(created_at desc);

-- ─────────────────────────────────────────
-- query_results
-- ─────────────────────────────────────────
create table if not exists query_results (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references research_jobs(id) on delete cascade,
  platform       text not null check (platform in ('chatgpt','perplexity','gemini')),
  keyword        text,
  location_type  text check (location_type in ('city','state')),
  query_text     text,
  response_text  text,
  mentioned      bool not null default false,
  mention_count  int not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists query_results_job_id_idx on query_results(job_id);

-- ─────────────────────────────────────────
-- competitors
-- ─────────────────────────────────────────
create table if not exists competitors (
  id               uuid primary key default gen_random_uuid(),
  job_id           uuid not null references research_jobs(id) on delete cascade,
  competitor_name  text not null,
  mention_count    int not null default 0,
  chatgpt_score    int,
  perplexity_score int,
  gemini_score     int
);

create index if not exists competitors_job_id_idx on competitors(job_id);

-- ─────────────────────────────────────────
-- leads
-- ─────────────────────────────────────────
create table if not exists leads (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references research_jobs(id) on delete cascade,
  first_name text,
  last_name  text,
  email      text not null,
  phone      text,
  role       text,
  created_at timestamptz not null default now()
);

create index if not exists leads_job_id_idx on leads(job_id);
create index if not exists leads_email_idx on leads(email);

-- ─────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────
alter table research_jobs  enable row level security;
alter table query_results  enable row level security;
alter table competitors    enable row level security;
alter table leads          enable row level security;

-- Service role can do everything (used by server worker)
create policy "service_role_all_jobs"    on research_jobs  for all using (true) with check (true);
create policy "service_role_all_results" on query_results  for all using (true) with check (true);
create policy "service_role_all_comps"   on competitors    for all using (true) with check (true);
create policy "service_role_all_leads"   on leads          for all using (true) with check (true);

-- Public: read completed jobs by id (report page)
create policy "public_read_complete_jobs" on research_jobs
  for select using (status = 'complete');
