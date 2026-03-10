import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import type { QuestionFeedbackResponse } from '@/types/questionBank';

export const dynamic = 'force-dynamic';

/**
 * GET /api/question-bank/questions/[id]/feedback
 * Returns dislike count and whether the current user has disliked. No auth required for read.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const questionId = params.id;
    if (!questionId) {
      return NextResponse.json({ error: 'Missing question id' }, { status: 400 });
    }

    const { count, error: countError } = await (supabase as any)
      .from('question_bank_dislikes')
      .select('*', { count: 'exact', head: true })
      .eq('question_id', questionId);

    if (countError) {
      console.error('[Feedback API] GET count error:', countError);
      return NextResponse.json({ error: 'Failed to load feedback' }, { status: 500 });
    }

    const dislikeCount = count ?? 0;
    const { data: { session } } = await supabase.auth.getSession();
    let userDisliked: boolean | undefined;
    if (session?.user?.id) {
      const { data: userRow } = await (supabase as any)
        .from('question_bank_dislikes')
        .select('id')
        .eq('question_id', questionId)
        .eq('user_id', session.user.id)
        .maybeSingle();
      userDisliked = !!userRow;
    }

    const body: QuestionFeedbackResponse = {
      dislikeCount,
      ...(userDisliked !== undefined && { userDisliked }),
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error('[Feedback API] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
