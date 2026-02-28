-- Migration: Fix "column reference metric_date is ambiguous" in update_daily_metrics_on_qb_attempt
-- Root cause: Trigger declared variable "metric_date" conflicting with table column

CREATE OR REPLACE FUNCTION update_daily_metrics_on_qb_attempt()
RETURNS TRIGGER AS $$
DECLARE
  v_metric_date date;
  v_time_ms bigint;
BEGIN
  v_metric_date := DATE(NEW.attempted_at);
  v_time_ms := COALESCE(NEW.time_spent_ms, 0);

  INSERT INTO user_daily_metrics (
    user_id,
    metric_date,
    total_questions,
    correct_answers,
    total_time_ms,
    sessions_count
  ) VALUES (
    NEW.user_id,
    v_metric_date,
    1,
    CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
    v_time_ms,
    0
  )
  ON CONFLICT (user_id, metric_date)
  DO UPDATE SET
    total_questions = user_daily_metrics.total_questions + 1,
    correct_answers = user_daily_metrics.correct_answers + CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
    total_time_ms = user_daily_metrics.total_time_ms + v_time_ms,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
