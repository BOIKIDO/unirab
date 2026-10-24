alter table competitors
  add column if not exists above_count int not null default 0,
  add column if not exists below_count int not null default 0;
