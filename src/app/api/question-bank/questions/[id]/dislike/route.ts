import { NextRequest, NextResponse } from 'next/server';
import { requireRouteUser } from '@/lib/supabase/auth';
import type { QuestionFeedbackResponse } from '@/types/questionBank';

export const dynamic = 'force-dynamic';

/**
 * POST /api/question-bank/questions/[id]/dislike
 * Toggle dislike for the current user. Requires auth. Returns updated dislikeCount and userDisliked.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, supabase, error: authError } = await requireRouteUser(_request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const questionId = params.id;
    if (!questionId) {
      return NextResponse.json({ error: 'Missing question id' }, { status: 400 });
    }

    const { data: existing } = await (supabase as any)
      .from('question_bank_dislikes')
      .select('id')
      .eq('question_id', questionId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      const { error: delError } = await (supabase as any)
        .from('question_bank_dislikes')
        .delete()
        .eq('question_id', questionId)
        .eq('user_id', user.id);
      if (delError) {
        console.error('[Dislike API] DELETE error:', delError);
        return NextResponse.json({ error: 'Failed to remove dislike' }, { status: 500 });
      }
    } else {
      const { error: insError } = await (supabase as any)
        .from('question_bank_dislikes')
        .insert({ question_id: questionId, user_id: user.id });
      if (insError) {
        console.error('[Dislike API] INSERT error:', insError);
        return NextResponse.json({ error: 'Failed to add dislike' }, { status: 500 });
      }
    }

    const userDisliked = !existing;
    const { count } = await (supabase as any)
      .from('question_bank_dislikes')
      .select('*', { count: 'exact', head: true })
      .eq('question_id', questionId);

    const body: QuestionFeedbackResponse = {
      dislikeCount: count ?? 0,
      userDisliked,
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error('[Dislike API] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
