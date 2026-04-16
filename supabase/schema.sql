create table sessions (
  id          uuid primary key default gen_random_uuid(),
  token       text unique not null,
  pin         text not null,
  client_name  text not null,
  client_phone text not null,
  created_by  text not null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  status      text default 'pending',
  created_at  timestamptz default now()
);

create table uploads (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid references sessions(id),
  panel        text not null,
  storage_path text not null,
  uploaded_at  timestamptz default now()
);

create table estimates (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid references sessions(id),
  vehicle_type     text,
  panels           jsonb,
  total_sqft       numeric,
  sqft_low         numeric,
  sqft_high        numeric,
  confidence       text,
  confidence_note  text,
  raw_response     text,
  created_at       timestamptz default now()
);
