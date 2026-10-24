-- Prevent duplicate lead submissions for the same job+email
-- If someone submits the form twice, the second insert silently becomes a no-op
-- rather than creating a duplicate row.

create unique index if not exists leads_job_email_unique
  on leads (job_id, email);
