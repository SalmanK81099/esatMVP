-- Migration: Question Bank public rating and dislike
-- Description: Community difficulty rating (1-5 stars) and "mark unhelpful" per question

-- question_bank_ratings: one rating per user per question (1-5)
CREATE TABLE IF NOT EXISTS question_bank_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES ai_generated_questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(question_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_qb_ratings_question ON question_bank_ratings(question_id);
CREATE INDEX IF NOT EXISTS idx_qb_ratings_user ON question_bank_ratings(user_id);

ALTER TABLE question_bank_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read ratings" ON question_bank_ratings;
CREATE POLICY "Anyone can read ratings"
  ON question_bank_ratings FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Users can insert own rating" ON question_bank_ratings;
CREATE POLICY "Users can insert own rating"
  ON question_bank_ratings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own rating" ON question_bank_ratings;
CREATE POLICY "Users can update own rating"
  ON question_bank_ratings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own rating" ON question_bank_ratings;
CREATE POLICY "Users can delete own rating"
  ON question_bank_ratings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE question_bank_ratings IS 'Community difficulty/quality rating (1-5 stars) per question';
COMMENT ON COLUMN question_bank_ratings.rating IS 'Rating from 1 to 5 (e.g. difficulty or quality)';

-- question_bank_dislikes: one row per user per question (mark unhelpful)
CREATE TABLE IF NOT EXISTS question_bank_dislikes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES ai_generated_questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(question_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_qb_dislikes_question ON question_bank_dislikes(question_id);
CREATE INDEX IF NOT EXISTS idx_qb_dislikes_user ON question_bank_dislikes(user_id);

ALTER TABLE question_bank_dislikes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read dislikes" ON question_bank_dislikes;
CREATE POLICY "Anyone can read dislikes"
  ON question_bank_dislikes FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Users can insert own dislike" ON question_bank_dislikes;
CREATE POLICY "Users can insert own dislike"
  ON question_bank_dislikes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own dislike" ON question_bank_dislikes;
CREATE POLICY "Users can delete own dislike"
  ON question_bank_dislikes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE question_bank_dislikes IS 'Users who marked the question as unhelpful (dislike)';
