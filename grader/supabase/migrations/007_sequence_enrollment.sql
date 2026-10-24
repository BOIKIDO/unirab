-- Add sequence enrollment tracking to leads table
-- sequence_stage: 1-5 (which email they're on), null = not enrolled
-- sequence_enrolled: boolean flag for quick filtering
-- sequence_enrolled_at: timestamp for calculating when to send next email

alter table leads
  add column if not exists sequence_enrolled boolean default false,
  add column if not exists sequence_stage int default null,
  add column if not exists sequence_enrolled_at timestamptz default null;

create index if not exists leads_sequence_stage_idx on leads(sequence_stage) where sequence_enrolled = true;
