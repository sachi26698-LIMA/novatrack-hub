-- Phase 2 migration: announcements table
-- Run this in your Supabase SQL Editor:
-- Dashboard → SQL Editor → New query → paste & run

CREATE TABLE IF NOT EXISTS announcements (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  content     TEXT,
  category    TEXT        NOT NULL DEFAULT 'General',
  pinned      BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Owners can do everything
CREATE POLICY "announcements_owner_all"
  ON announcements FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- All authenticated users can read
CREATE POLICY "announcements_read_all"
  ON announcements FOR SELECT
  USING (auth.role() = 'authenticated');
