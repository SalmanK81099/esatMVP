import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { requireRouteUser } from '@/lib/supabase/auth';
import type { QuestionRatingResponse } from '@/types/questionBank';

export const dynamic = 'force-dynamic';

/**
 * GET /api/question-bank/questions/[id]/rating
 * Returns aggregate rating and optional user's rating for the question.
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

    const { data: rows } = await (supabase as any)
      .from('question_bank_ratings')
      .select('rating')
      .eq('question_id', questionId);

    const ratings = (rows ?? []) as { rating: number }[];
    const count = ratings.length;
    const average =
      count > 0
        ? Math.round((ratings.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10
        : 0;

    const { data: { session } } = await supabase.auth.getSession();
    let userRating: number | undefined;
    if (session?.user?.id) {
      const { data: userRow } = await (supabase as any)
        .from('question_bank_ratings')
        .select('rating')
        .eq('question_id', questionId)
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (userRow) userRating = (userRow as { rating: number }).rating;
    }

    const body: QuestionRatingResponse = { average, count, ...(userRating !== undefined && { userRating }) };
    return NextResponse.json(body);
  } catch (error) {
    console.error('[Rating API] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/question-bank/questions/[id]/rating
 * Set or update the current user's rating (1-5). Requires auth.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, supabase, error: authError } = await requireRouteUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const questionId = params.id;
    if (!questionId) {
      return NextResponse.json({ error: 'Missing question id' }, { status: 400 });
    }

    const body = await request.json();
    const rating = typeof body?.rating === 'number' ? body.rating : parseInt(body?.rating, 10);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be an integer from 1 to 5' }, { status: 400 });
    }

    const { error: upsertError } = await (supabase as any)
      .from('question_bank_ratings')
      .upsert(
        {
          question_id: questionId,
          user_id: user.id,
          rating,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'question_id,user_id' }
      );

    if (upsertError) {
      console.error('[Rating API] POST upsert error:', upsertError);
      return NextResponse.json({ error: 'Failed to save rating' }, { status: 500 });
    }

    const { data: rows } = await (supabase as any)
      .from('question_bank_ratings')
      .select('rating')
      .eq('question_id', questionId);

    const all = (rows ?? []) as { rating: number }[];
    const count = all.length;
    const average =
      count > 0
        ? Math.round((all.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10
        : 0;

    return NextResponse.json({
      average,
      count,
      userRating: rating,
    } as QuestionRatingResponse);
  } catch (error) {
    console.error('[Rating API] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
