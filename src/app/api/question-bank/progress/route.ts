import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import type { SubjectFilter } from '@/types/questionBank';

export const dynamic = 'force-dynamic';

/**
 * GET /api/question-bank/progress
 * Returns progress stats: how many questions attempted vs total available for selected subjects
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get current user (optional - we can return total for unauthenticated users)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    const isAuthenticated = !sessionError && !!session;

    const { searchParams } = new URL(request.url);
    const subjectsParam = searchParams.get('subjects');
    const testTypeParam = searchParams.get('testType');
    const testType = testTypeParam && testTypeParam !== 'All' ? testTypeParam as 'ESAT' | 'TMUA' : null;
    
    if (!subjectsParam) {
      return NextResponse.json(
        { error: 'subjects parameter required' },
        { status: 400 }
      );
    }

    const subjects = subjectsParam.split(',').map(s => s?.trim()).filter(s => s && s !== 'All') as SubjectFilter[];

    if (subjects.length === 0) {
      return NextResponse.json({
        attempted: 0,
        total: 0,
      });
    }

    // Build count query - match questions API: count ALL questions (any status) that user can see
    let countQuery = supabase
      .from('ai_generated_questions')
      .select('id', { count: 'exact', head: true });

    if (testType) {
      countQuery = countQuery.eq('test_type', testType);
    }

    if (subjects.length === 1) {
      countQuery = countQuery.eq('subjects', subjects[0]);
    } else {
      countQuery = countQuery.in('subjects', subjects);
    }

    const { count: total, error: countError } = await countQuery;

    if (countError) {
      console.error('[Progress API] Error counting questions:', countError);
      return NextResponse.json(
        { error: 'Failed to fetch questions' },
        { status: 500 }
      );
    }

    let attempted = 0;

    if (isAuthenticated) {
      // Fetch question IDs (normalize to strings for consistent comparison)
      let idQuery = supabase
        .from('ai_generated_questions')
        .select('id');

      if (testType) {
        idQuery = idQuery.eq('test_type', testType);
      }
      if (subjects.length === 1) {
        idQuery = idQuery.eq('subjects', subjects[0]);
      } else {
        idQuery = idQuery.in('subjects', subjects);
      }

      const { data: questions, error: questionsError } = await idQuery.limit(5000);

      if (!questionsError && questions && questions.length > 0) {
        const questionIds = new Set((questions as { id: string }[]).map((q) => String(q.id)));
        const questionIdArray = Array.from(questionIds);

        // Fetch attempts that match our question pool - filter in DB for reliability
        const { data: attempts, error: attemptsError } = await supabase
          .from('question_bank_attempts')
          .select('question_id')
          .eq('user_id', session!.user.id)
          .in('question_id', questionIdArray);

        if (!attemptsError && attempts) {
          // Count unique questions attempted (user may have multiple attempts per question)
          const attemptedQuestionIds = new Set(
            (attempts as { question_id: string }[]).map((a) => String(a.question_id))
          );
          attempted = attemptedQuestionIds.size;
        }
      }
    }

    console.log('[Progress API] Progress stats:', {
      subjects: subjects.join(', '),
      testType: testType || 'All',
      total: total ?? 0,
      attempted,
      isAuthenticated,
    });

    return NextResponse.json({
      attempted,
      total: total ?? 0,
    });
  } catch (error) {
    console.error('[Progress API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

