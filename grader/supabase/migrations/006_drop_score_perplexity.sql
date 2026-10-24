-- Drop dead column — Perplexity was removed as a platform but the column was
-- left behind in the initial schema.
alter table research_jobs
  drop column if exists score_perplexity;
