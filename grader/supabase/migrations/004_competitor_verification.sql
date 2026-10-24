-- Add verification status to competitors
-- verified = true  → confirmed real business via Google Places
-- verified = false → not found in Google Places, likely AI-hallucinated
-- verified = null  → not yet checked

alter table competitors
  add column if not exists verified boolean default null,
  add column if not exists verified_place_id text default null,
  add column if not exists verified_at timestamptz default null;

create index if not exists competitors_verified_idx on competitors(verified);
