export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

// paper_sessions
export type PaperSessionRow = {
  id: string;
  user_id: string;
  paper_id: number | null;
  paper_name: string;
  paper_variant: string;
  session_name: string;
  question_start: number | null;
  question_end: number | null;
  selected_sections: string[] | null;
  selected_part_ids: string[] | null;
  question_order: number[] | null;
  time_limit_minutes: number;
  started_at: string | null;
  ended_at: string | null;
  deadline_at: string | null;
  per_question_seconds: number[] | null;
  answers: Json | null;
  correct_flags: Json | null;
  guessed_flags: Json | null;
  mistake_tags: Json | null;
  notes: string | null;
  score: Json | null;
  predicted_score: number | null;
  section_percentiles: Json | null;
  pinned_insights: Json | null;
  created_at: string;
  updated_at: string;
};
export type PaperSessionInsert = {
  id?: string;
  user_id: string;
  paper_id?: number | null;
  paper_name?: string;
  paper_variant?: string;
  session_name?: string;
  question_start?: number | null;
  question_end?: number | null;
  selected_sections?: string[] | null;
  selected_part_ids?: string[] | null;
  question_order?: number[] | null;
  time_limit_minutes?: number;
  started_at?: string | null;
  ended_at?: string | null;
  deadline_at?: string | null;
  per_question_seconds?: number[] | null;
  answers?: Json | null;
  correct_flags?: Json | null;
  guessed_flags?: Json | null;
  mistake_tags?: Json | null;
  notes?: string | null;
  score?: Json | null;
  predicted_score?: number | null;
  section_percentiles?: Json | null;
  pinned_insights?: Json | null;
};
export type PaperSessionUpdate = Partial<PaperSessionRow>;

// drill_items
export type DrillItemRow = {
  id: string;
  user_id: string;
  paper_id: number | null;
  paper_name: string;
  question_number: number;
  correct_choice: string | null;
  explanation: string | null;
  origin_session_id: string | null;
  question_id: number | null;
  last_wrong_at: string | null;
  last_reviewed_at: string | null;
  last_outcome: string | null;
  last_time_sec: number | null;
  review_count: number;
  created_at: string;
  updated_at: string;
};
export type DrillItemInsert = {
  id?: string;
  user_id: string;
  paper_id?: number | null;
  paper_name: string;
  question_number: number;
  correct_choice?: string | null;
  explanation?: string | null;
  origin_session_id?: string | null;
  question_id?: number | null;
  last_wrong_at?: string | null;
  last_reviewed_at?: string | null;
  last_outcome?: string | null;
  last_time_sec?: number | null;
  review_count?: number;
};
export type DrillItemUpdate = Partial<DrillItemRow>;

// drill_sessions
export type DrillSessionRow = {
  id: string;
  user_id: string;
  topic_id: string;
  builder_session_id: string | null;
  level: number;
  question_count: number | null;
  started_at: string | null;
  completed_at: string | null;
  accuracy: number | null;
  average_time_ms: number | null;
  summary: Json | null;
  created_at: string;
  updated_at: string;
};
export type DrillSessionInsert = {
  id?: string;
  user_id: string;
  topic_id?: string;
  builder_session_id?: string | null;
  level?: number;
  question_count?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
  accuracy?: number | null;
  average_time_ms?: number | null;
  summary?: Json | null;
};
export type DrillSessionUpdate = Partial<DrillSessionRow>;

// drill_session_attempts
export type DrillSessionAttemptRow = {
  id: number;
  session_id: string;
  user_id: string;
  question_id: string | null;
  prompt: string | null;
  correct_answer: string | null;
  user_answer: string | null;
  is_correct: boolean | null;
  time_spent_ms: number | null;
  order_index: number;
  attempted_at: string;
};
export type DrillSessionAttemptInsert = {
  id?: number;
  session_id: string;
  user_id: string;
  question_id?: string | null;
  prompt?: string | null;
  correct_answer?: string | null;
  user_answer?: string | null;
  is_correct?: boolean | null;
  time_spent_ms?: number | null;
  order_index: number;
  attempted_at?: string;
};
export type DrillSessionAttemptUpdate = Partial<DrillSessionAttemptRow>;

// topic_progress
export type TopicProgressRow = {
  user_id: string;
  topic_id: string;
  current_level: number;
  questions_attempted: number;
  questions_correct: number;
  average_time_ms: number;
  last_practiced: string | null;
  created_at: string;
  updated_at: string;
};
export type TopicProgressInsert = {
  user_id: string;
  topic_id: string;
  current_level?: number;
  questions_attempted?: number;
  questions_correct?: number;
  average_time_ms?: number;
  last_practiced?: string | null;
};
export type TopicProgressUpdate = Partial<TopicProgressRow>;

// session_presets
export type SessionPresetRow = {
  id: string;
  user_id: string;
  name: string;
  topic_ids: string[];
  topic_labels: string[] | null;
  question_count: number;
  duration_min: number;
  topic_levels: Json | null;
  created_at: string;
  updated_at: string;
};
export type SessionPresetInsert = {
  id?: string;
  user_id: string;
  name: string;
  topic_ids: string[];
  topic_labels?: string[] | null;
  question_count: number;
  duration_min: number;
  topic_levels?: Json | null;
};
export type SessionPresetUpdate = Partial<SessionPresetRow>;

// builder_sessions
export type BuilderSessionRow = {
  id: string;
  user_id: string;
  started_at: string | null;
  ended_at: string | null;
  attempts: number | null;
  settings: Json | null;
  created_at: string;
  updated_at: string;
};
export type BuilderSessionInsert = {
  id?: string;
  user_id: string;
  started_at?: string | null;
  ended_at?: string | null;
  attempts?: number | null;
  settings?: Json | null;
};
export type BuilderSessionUpdate = Partial<BuilderSessionRow>;

// builder_session_questions
export type BuilderSessionQuestionRow = {
  id: number;
  session_id: string;
  user_id: string;
  order_index: number;
  question_id: string | null;
  topic_id: string | null;
  difficulty: number | null;
  prompt: string | null;
  answer: string | null;
  payload: Json | null;
};
export type BuilderSessionQuestionInsert = {
  id?: number;
  session_id: string;
  user_id: string;
  order_index: number;
  question_id?: string | null;
  topic_id?: string | null;
  difficulty?: number | null;
  prompt?: string | null;
  answer?: string | null;
  payload?: Json | null;
};
export type BuilderSessionQuestionUpdate = Partial<BuilderSessionQuestionRow>;

// builder_attempts
export type BuilderAttemptRow = {
  id: number;
  session_id: string;
  user_id: string;
  question_id: string | null;
  user_answer: string | null;
  is_correct: boolean | null;
  time_spent_ms: number | null;
  attempted_at: string;
  order_index: number | null;
};
export type BuilderAttemptInsert = {
  id?: number;
  session_id: string;
  user_id: string;
  question_id?: string | null;
  user_answer?: string | null;
  is_correct?: boolean | null;
  time_spent_ms?: number | null;
  attempted_at?: string;
  order_index?: number | null;
};
export type BuilderAttemptUpdate = Partial<BuilderAttemptRow>;

// ai_generated_questions
export type AiGeneratedQuestionRow = {
  id: string;
  generation_id: string;
  schema_id: string;
  difficulty: string;
  status: 'pending' | 'approved' | 'deleted';
  question_stem: string;
  options: Json;
  correct_option: string;
  solution_reasoning: string | null;
  solution_key_insight: string | null;
  distractor_map: Json | null;
  idea_plan: Json | null;
  verifier_report: Json | null;
  style_report: Json | null;
  models_used: Json | null;
  generation_attempts: number;
  token_usage: Json | null;
  run_id: string | null;
  test_type: string | null;
  subjects: string; // Required: 'Math 1' | 'Math 2' | 'Physics' | 'Chemistry' | 'Biology' | 'Paper 1' | 'Paper 2'
  primary_tag: string | null;
  secondary_tags: string[] | null;
  tags_confidence: Json | null;
  tags_labeled_at: string | null;
  tags_labeled_by: string | null;
  created_at: string;
  updated_at: string;
};
export type AiGeneratedQuestionInsert = {
  id?: string;
  generation_id: string;
  schema_id: string;
  difficulty: string;
  status?: 'pending' | 'approved' | 'deleted';
  question_stem: string;
  options: Json;
  correct_option: string;
  solution_reasoning?: string | null;
  solution_key_insight?: string | null;
  distractor_map?: Json | null;
  idea_plan?: Json | null;
  verifier_report?: Json | null;
  style_report?: Json | null;
  models_used?: Json | null;
  generation_attempts?: number;
  token_usage?: Json | null;
  run_id?: string | null;
  test_type?: string | null;
  subjects: string; // Required
  primary_tag?: string | null;
  secondary_tags?: string[] | null;
  tags_confidence?: Json | null;
  tags_labeled_at?: string | null;
  tags_labeled_by?: string | null;
  created_at?: string;
  updated_at?: string;
};
export type AiGeneratedQuestionUpdate = Partial<AiGeneratedQuestionRow>;

// profiles
export type UserProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  nickname: string | null; // Keep for backward compatibility
  username: string | null;
  last_username_change: string | null;
  exam_preference: 'ESAT' | 'TMUA' | null;
  esat_subjects: string[] | null;
  is_early_applicant: boolean | null;
  has_extra_time: boolean | null;
  extra_time_percentage: number | null;
  has_rest_breaks: boolean | null;
  font_size: 'small' | 'medium' | 'large' | null;
  reduced_motion: boolean | null;
  dark_mode: boolean | null;
  created_at: string;
  updated_at: string;
};
export type UserProfileInsert = {
  id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  nickname?: string | null; // Keep for backward compatibility
  username?: string | null;
  last_username_change?: string | null;
  exam_preference?: 'ESAT' | 'TMUA' | null;
  esat_subjects?: string[] | null;
  is_early_applicant?: boolean | null;
  has_extra_time?: boolean | null;
  extra_time_percentage?: number | null;
  has_rest_breaks?: boolean | null;
  font_size?: 'small' | 'medium' | 'large' | null;
  reduced_motion?: boolean | null;
  dark_mode?: boolean | null;
};
export type UserProfileUpdate = Partial<UserProfileRow>;

// user_daily_metrics
export type UserDailyMetricRow = {
  id: number;
  user_id: string;
  metric_date: string;
  total_questions: number;
  correct_answers: number;
  total_time_ms: number;
  sessions_count: number;
  created_at: string;
  updated_at: string;
};
export type UserDailyMetricInsert = {
  id?: number;
  user_id: string;
  metric_date: string;
  total_questions?: number;
  correct_answers?: number;
  total_time_ms?: number;
  sessions_count?: number;
};
export type UserDailyMetricUpdate = Partial<UserDailyMetricRow>;

// question_bank_attempts
export type QuestionBankAttemptRow = {
  id: string;
  user_id: string;
  question_id: string;
  user_answer: string;
  is_correct: boolean;
  time_spent_ms: number | null;
  viewed_solution: boolean;
  attempted_at: string;
  created_at: string;
};
export type QuestionBankAttemptInsert = {
  id?: string;
  user_id: string;
  question_id: string;
  user_answer: string;
  is_correct: boolean;
  time_spent_ms?: number | null;
  viewed_solution?: boolean;
  attempted_at?: string;
};
export type QuestionBankAttemptUpdate = Partial<QuestionBankAttemptRow>;

// paper_session_responses
export type PaperSessionResponseRow = {
  id: string;
  session_id: string;
  user_id: string;
  question_id: number;
  paper_id: number | null;
  section_code: string | null;
  choice: string | null;
  is_correct: boolean | null;
  time_spent_seconds: number | null;
  created_at: string;
};
export type PaperSessionResponseInsert = {
  id?: string;
  session_id: string;
  user_id: string;
  question_id: number;
  paper_id?: number | null;
  section_code?: string | null;
  choice?: string | null;
  is_correct?: boolean | null;
  time_spent_seconds?: number | null;
  created_at?: string;
};
export type PaperSessionResponseUpdate = Partial<PaperSessionResponseRow>;

// question_choice_stats
export type QuestionChoiceStatsRow = {
  question_id: number;
  paper_id: number | null;
  section_code: string | null;
  attempts: number;
  correct: number;
  time_sum_seconds: number;
  a_count: number;
  b_count: number;
  c_count: number;
  d_count: number;
  e_count: number;
  f_count: number;
  g_count: number;
  h_count: number;
  updated_at: string;
};
export type QuestionChoiceStatsInsert = {
  question_id: number;
  paper_id?: number | null;
  section_code?: string | null;
  attempts?: number;
  correct?: number;
  time_sum_seconds?: number;
  a_count?: number;
  b_count?: number;
  c_count?: number;
  d_count?: number;
  e_count?: number;
  f_count?: number;
  g_count?: number;
  h_count?: number;
  updated_at?: string;
};
export type QuestionChoiceStatsUpdate = Partial<QuestionChoiceStatsRow>;

// question_bank_ratings
export type QuestionBankRatingRow = {
  id: string;
  question_id: string;
  user_id: string;
  rating: number;
  created_at: string;
  updated_at: string;
};
export type QuestionBankRatingInsert = {
  id?: string;
  question_id: string;
  user_id: string;
  rating: number;
  created_at?: string;
  updated_at?: string;
};
export type QuestionBankRatingUpdate = Partial<QuestionBankRatingRow>;

// question_bank_dislikes
export type QuestionBankDislikeRow = {
  id: string;
  question_id: string;
  user_id: string;
  created_at: string;
};
export type QuestionBankDislikeInsert = {
  id?: string;
  question_id: string;
  user_id: string;
  created_at?: string;
};
export type QuestionBankDislikeUpdate = Partial<QuestionBankDislikeRow>;

export type Database = {
  public: {
    Tables: {
      paper_sessions: {
        Row: PaperSessionRow;
        Insert: PaperSessionInsert;
        Update: PaperSessionUpdate;
      };
      drill_items: {
        Row: DrillItemRow;
        Insert: DrillItemInsert;
        Update: DrillItemUpdate;
      };
      drill_sessions: {
        Row: DrillSessionRow;
        Insert: DrillSessionInsert;
        Update: DrillSessionUpdate;
      };
      drill_session_attempts: {
        Row: DrillSessionAttemptRow;
        Insert: DrillSessionAttemptInsert;
        Update: DrillSessionAttemptUpdate;
      };
      topic_progress: {
        Row: TopicProgressRow;
        Insert: TopicProgressInsert;
        Update: TopicProgressUpdate;
      };
      session_presets: {
        Row: SessionPresetRow;
        Insert: SessionPresetInsert;
        Update: SessionPresetUpdate;
      };
      builder_sessions: {
        Row: BuilderSessionRow;
        Insert: BuilderSessionInsert;
        Update: BuilderSessionUpdate;
      };
      builder_session_questions: {
        Row: BuilderSessionQuestionRow;
        Insert: BuilderSessionQuestionInsert;
        Update: BuilderSessionQuestionUpdate;
      };
      builder_attempts: {
        Row: BuilderAttemptRow;
        Insert: BuilderAttemptInsert;
        Update: BuilderAttemptUpdate;
      };
      ai_generated_questions: {
        Row: AiGeneratedQuestionRow;
        Insert: AiGeneratedQuestionInsert;
        Update: AiGeneratedQuestionUpdate;
      };
      profiles: {
        Row: UserProfileRow;
        Insert: UserProfileInsert;
        Update: UserProfileUpdate;
      };
      user_daily_metrics: {
        Row: UserDailyMetricRow;
        Insert: UserDailyMetricInsert;
        Update: UserDailyMetricUpdate;
      };
      question_bank_attempts: {
        Row: QuestionBankAttemptRow;
        Insert: QuestionBankAttemptInsert;
        Update: QuestionBankAttemptUpdate;
      };
      paper_session_responses: {
        Row: PaperSessionResponseRow;
        Insert: PaperSessionResponseInsert;
        Update: PaperSessionResponseUpdate;
      };
      question_choice_stats: {
        Row: QuestionChoiceStatsRow;
        Insert: QuestionChoiceStatsInsert;
        Update: QuestionChoiceStatsUpdate;
      };
      question_bank_ratings: {
        Row: QuestionBankRatingRow;
        Insert: QuestionBankRatingInsert;
        Update: QuestionBankRatingUpdate;
      };
      question_bank_dislikes: {
        Row: QuestionBankDislikeRow;
        Insert: QuestionBankDislikeInsert;
        Update: QuestionBankDislikeUpdate;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

