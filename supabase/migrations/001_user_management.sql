-- Run this in the Supabase Dashboard → SQL Editor before deploying
-- Or call POST /api/admin/migrate (admin-only) after deploying.

CREATE TABLE IF NOT EXISTS users (
  email       TEXT PRIMARY KEY,
  name        TEXT,
  last_login  TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS granted_by TEXT,
  ADD COLUMN IF NOT EXISTS granted_at TIMESTAMPTZ DEFAULT NOW();
