import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import type { QuestionBankQuestion } from '@/types/questionBank';

export const dynamic = 'force-dynamic';

const MAX_DRILL_QUESTIONS = 100;

/**
 * Normalize a raw DB row to QuestionBankQuestion shape (options, distractor_map parsed).
 */
function normalizeQuestionRow(q: Record<string, unknown>): QuestionBankQuestion {
  return {
    ...q,
    options: typeof q.options === 'string' ? JSON.parse(q.options as string) : (q.options as QuestionBankQuestion['options']),
    distractor_map: q.distractor_map && typeof q.distractor_map === 'string'
      ? JSON.parse(q.distractor_map as string)
      : (q.distractor_map as QuestionBankQuestion['distractor_map']),
  } as QuestionBankQuestion;
}

/**
 * GET /api/question-bank/drill-questions
 * Returns questions the user has answered incorrectly at least once (approved only).
 * Auth required.
 */
export async function GET() {
  try {
    const supabase = createServerClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // 1. Get distinct question_id from attempts where is_correct = false
    const { data: attempts, error: attemptsError } = await (supabase as any)
      .from('question_bank_attempts')
      .select('question_id')
      .eq('user_id', userId)
      .eq('is_correct', false);

    if (attemptsError) {
      console.error('[Drill API] Error fetching wrong attempts:', attemptsError);
      return NextResponse.json({ error: 'Failed to load drill data' }, { status: 500 });
    }

    const wrongIds = [...new Set((attempts || []).map((a: { question_id: string }) => a.question_id))].slice(0, MAX_DRILL_QUESTIONS);

    if (wrongIds.length === 0) {
      return NextResponse.json({ questions: [], count: 0 });
    }

    // 2. Fetch full question rows (RLS controls visibility; no status filter so drill works even if status != 'approved')
    const { data: rows, error: questionsError } = await (supabase as any)
      .from('ai_generated_questions')
      .select('*')
      .in('id', wrongIds);

    if (questionsError) {
      console.error('[Drill API] Error fetching questions:', questionsError);
      return NextResponse.json({ error: 'Failed to load questions' }, { status: 500 });
    }

    const rawQuestions = (rows || []) as Record<string, unknown>[];
    const questions = rawQuestions.map((q) => {
      try {
        return normalizeQuestionRow(q);
      } catch (parseError) {
        console.error('[Drill API] Error parsing question:', parseError, q);
        return q as unknown as QuestionBankQuestion;
      }
    });

    return NextResponse.json({ questions, count: questions.length });
  } catch (error) {
    console.error('[Drill API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
