-- Migration: Fix user_daily_metrics missing sessions_count column
-- Root cause: Trigger expects sessions_count, but some DBs have schema drift

ALTER TABLE user_daily_metrics ADD COLUMN IF NOT EXISTS sessions_count integer DEFAULT 0;
