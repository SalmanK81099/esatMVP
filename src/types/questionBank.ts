/**
 * Question Bank Types
 */

import type { TMUAGraphSpecV2 as TMUAGraphSpec } from "@/components/shared/TMUAGraph";

export type TestTypeFilter = 'ESAT' | 'TMUA' | 'All';
export type SubjectFilter = 'Math 1' | 'Math 2' | 'Physics' | 'Chemistry' | 'Biology' | 'Paper 1' | 'Paper 2' | 'All';
export type DifficultyFilter = 'Easy' | 'Medium' | 'Hard' | 'All';
export type AttemptedFilter = 'New' | 'Attempted' | 'Mix';
export type AttemptResultFilter = 'Mixed Results' | 'Unseen' | 'Incorrect Before';
export type ReviewStatusFilter = 'All' | 'Pending' | 'Approved' | 'Deleted';

export interface QuestionBankQuestion {
  id: string;
  generation_id: string;
  schema_id: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  question_stem: string;
  options: Record<string, string>; // e.g., { "A": "option text", "B": "...", ... }
  correct_option: string;
  solution_reasoning: string | null;
  solution_key_insight: string | null;
  distractor_map: Record<string, string> | null;
  subjects: string;
  test_type?: 'ESAT' | 'TMUA' | null;
  primary_tag: string | null;
  secondary_tags: string[] | null;
  status: 'pending' | 'approved' | 'deleted';
  created_at: string;
  graph_spec?: TMUAGraphSpec | null; // Optional graph specification for questions with graphs (deprecated, use graph_specs)
  graph_specs?: Record<string, TMUAGraphSpec> | null; // Map of graph ID to graph spec for questions/solutions with multiple graphs
  idea_plan?: any | null; // JSONB field containing generation metadata, including variation_mode (FAR/SIBLINGS)
}

export interface QuestionAttempt {
  id?: string;
  user_id: string;
  question_id: string;
  user_answer: string;
  is_correct: boolean;
  time_spent_ms: number | null;
  viewed_solution: boolean;
  attempted_at: string;
  was_revealed?: boolean;
  used_hint?: boolean;
  wrong_answers_before?: string[];
  time_until_correct_ms?: number | null;
}

export interface QuestionBankFilters {
  testType: TestTypeFilter; // First level filter: ESAT or TMUA
  subject: SubjectFilter | SubjectFilter[]; // Support both single and multi-select - depends on testType
  difficulty: DifficultyFilter | DifficultyFilter[]; // Support both single and multi-select
  searchTag: string;
  attemptedStatus: AttemptedFilter;
  attemptResult: AttemptResultFilter | AttemptResultFilter[]; // Support both single and multi-select
  reviewStatus?: ReviewStatusFilter; // Added for review status filtering
}

export interface QuestionBankStats {
  totalAttempts: number;
  correctAttempts: number;
  averageTime: number;
}

/** Response from GET /api/question-bank/questions/[id]/rating */
export interface QuestionRatingResponse {
  average: number;
  count: number;
  userRating?: number;
}

/** Response from GET /api/question-bank/questions/[id]/feedback */
export interface QuestionFeedbackResponse {
  dislikeCount: number;
  userDisliked?: boolean;
}




