-- ============================================================
-- Google OAuth - Database Migration
-- Adds Google Sign-In support for students and admins
-- Run: mysql -u root -p atlas_career < migrations/google_oauth.sql
-- ============================================================

-- Add google_id column and make password nullable for OAuth users
ALTER TABLE aicp_users
  ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE AFTER password,
  MODIFY COLUMN password VARCHAR(255) NULL;
