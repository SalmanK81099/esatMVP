import { NextResponse } from "next/server";
import { requireRouteUser, getOptionalSession } from "@/lib/supabase/auth";
import { createRouteClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SessionPayload = {
  id: string;
  paperId?: number | null;
  paperName: string;
  paperVariant: string;
  sessionName: string;
  questionRange: { start: number; end: number };
  selectedSections?: string[];
  selectedPartIds?: string[]; // Part IDs for granular tracking
  questionOrder?: number[];
  timeLimitMinutes: number;
  startedAt: number;
  endedAt?: number | null;
  deadlineAt?: number | null;
  perQuestionSec: number[];
  answers: any[];
  correctFlags: (boolean | null)[];
  guessedFlags: boolean[];
  mistakeTags: string[];
  notes?: string;
  score?: { correct: number; total: number } | null;
  predictedScore?: number | null;
  sectionPercentiles?: Record<string, { percentile: number | null; score: number | null; table: string | null; label: string }> | null;
  pinnedInsights?: any;
};

function toIso(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value).toISOString()
    : null;
}

export async function POST(request: Request) {
  const session = await getOptionalSession();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required", code: "AUTH_REQUIRED" },
      { status: 401 }
    );
  }

  const supabase = createRouteClient();

  let payload: SessionPayload;
  try {
    payload = (await request.json()) as SessionPayload;
  } catch (parseError) {
    console.error("[papers:POST] Failed to parse request body", parseError);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!payload?.id || !payload.paperName || !payload.sessionName) {
    console.error("[papers:POST] Missing required fields", {
      hasId: !!payload?.id,
      hasPaperName: !!payload?.paperName,
      hasSessionName: !!payload?.sessionName,
      payload: payload
    });
    return NextResponse.json({ error: "Missing required fields", details: "id, paperName, and sessionName are required" }, { status: 400 });
  }

  // Validate questionRange since question_start and question_end are NOT NULL in database
  if (!payload.questionRange || typeof payload.questionRange.start !== 'number' || typeof payload.questionRange.end !== 'number') {
    console.error("[papers:POST] Invalid questionRange", {
      questionRange: payload.questionRange,
      payload: payload
    });
    return NextResponse.json({ error: "Invalid questionRange", details: "questionRange with start and end numbers is required" }, { status: 400 });
  }

  // Validate questionRange values are valid (end >= start, both positive)
  if (payload.questionRange.start < 1 || payload.questionRange.end < payload.questionRange.start) {
    console.error("[papers:POST] Invalid questionRange values", {
      start: payload.questionRange.start,
      end: payload.questionRange.end
    });
    return NextResponse.json({ error: "Invalid questionRange", details: "questionRange start must be >= 1 and end must be >= start" }, { status: 400 });
  }

  try {
    const { data, error } = await (supabase as any)
      .from("paper_sessions")
      .insert({
        id: payload.id,
        user_id: session.user.id,
        paper_id: payload.paperId ?? null,
        paper_name: payload.paperName,
        paper_variant: payload.paperVariant,
        session_name: payload.sessionName,
        question_start: payload.questionRange.start,
        question_end: payload.questionRange.end,
        selected_sections: payload.selectedSections ?? [],
        selected_part_ids: payload.selectedPartIds ?? [],
        question_order: payload.questionOrder ?? [],
        time_limit_minutes: payload.timeLimitMinutes,
        started_at: toIso(payload.startedAt),
        ended_at: toIso(payload.endedAt),
        deadline_at: toIso(payload.deadlineAt),
        per_question_seconds: payload.perQuestionSec ?? [],
        answers: payload.answers ?? [],
        correct_flags: payload.correctFlags ?? [],
        guessed_flags: payload.guessedFlags ?? [],
        mistake_tags: payload.mistakeTags ?? [],
        notes: payload.notes ?? null,
        score: payload.score ?? null,
        predicted_score: payload.predictedScore ?? null,
        section_percentiles: payload.sectionPercentiles ?? null,
        pinned_insights: payload.pinnedInsights ?? null,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[papers:POST] failed creating session", {
        error,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
        sessionId: payload.id,
        userId: session.user.id,
        paperName: payload.paperName,
        payloadKeys: Object.keys(payload),
        payloadSizes: {
          answers: payload.answers?.length,
          correctFlags: payload.correctFlags?.length,
          guessedFlags: payload.guessedFlags?.length,
          mistakeTags: payload.mistakeTags?.length,
          perQuestionSec: payload.perQuestionSec?.length,
        }
      });
      return NextResponse.json({ 
        error: "Failed to create session", 
        details: error.message,
        code: error.code,
        hint: error.hint,
        // Include more debugging info in development
        ...(process.env.NODE_ENV === 'development' && {
          errorDetails: error.details,
          errorFull: JSON.stringify(error, null, 2)
        })
      }, { status: 500 });
    }

    return NextResponse.json({ session: data });
  } catch (insertError: any) {
    console.error("[papers:POST] Exception during session creation", {
      error: insertError,
      errorMessage: insertError?.message,
      errorStack: insertError?.stack,
      errorName: insertError?.name,
      sessionId: payload.id,
      userId: session.user.id,
      paperName: payload.paperName
    });
    return NextResponse.json({ 
      error: "Failed to create session", 
      details: insertError?.message || "Unknown error",
      // Include more debugging info in development
      ...(process.env.NODE_ENV === 'development' && {
        errorName: insertError?.name,
        errorStack: insertError?.stack
      })
    }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getOptionalSession();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required", code: "AUTH_REQUIRED" },
      { status: 401 }
    );
  }

  const supabase = createRouteClient();

  const payload = (await request.json()) as SessionPayload;
  if (!payload?.id) {
    return NextResponse.json({ error: "Missing session id" }, { status: 400 });
  }

  // Build partial update - only include fields that are explicitly provided.
  // This ensures "quit session" (which sends only { id, endedAt }) updates only ended_at,
  // avoiding overwriting NOT NULL columns (paper_name, question_start, etc.) with null.
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (payload.paperId !== undefined) updates.paper_id = payload.paperId ?? null;
  if (payload.paperName !== undefined) updates.paper_name = payload.paperName;
  if (payload.paperVariant !== undefined) updates.paper_variant = payload.paperVariant;
  if (payload.sessionName !== undefined) updates.session_name = payload.sessionName;
  if (payload.questionRange !== undefined) {
    updates.question_start = payload.questionRange.start ?? null;
    updates.question_end = payload.questionRange.end ?? null;
  }
  if (payload.selectedSections !== undefined) updates.selected_sections = payload.selectedSections ?? [];
  if (payload.selectedPartIds !== undefined) updates.selected_part_ids = payload.selectedPartIds ?? [];
  if (payload.questionOrder !== undefined) updates.question_order = payload.questionOrder ?? [];
  if (payload.timeLimitMinutes !== undefined) updates.time_limit_minutes = payload.timeLimitMinutes;
  if (payload.startedAt !== undefined) updates.started_at = toIso(payload.startedAt);
  if (payload.endedAt !== undefined) updates.ended_at = toIso(payload.endedAt);
  if (payload.deadlineAt !== undefined) updates.deadline_at = toIso(payload.deadlineAt);
  if (payload.perQuestionSec !== undefined) updates.per_question_seconds = payload.perQuestionSec ?? [];
  if (payload.answers !== undefined) updates.answers = payload.answers ?? [];
  if (payload.correctFlags !== undefined) updates.correct_flags = payload.correctFlags ?? [];
  if (payload.guessedFlags !== undefined) updates.guessed_flags = payload.guessedFlags ?? [];
  if (payload.mistakeTags !== undefined) updates.mistake_tags = payload.mistakeTags ?? [];
  if (payload.notes !== undefined) updates.notes = payload.notes ?? null;
  if (payload.score !== undefined) updates.score = payload.score ?? null;
  if (payload.predictedScore !== undefined) updates.predicted_score = payload.predictedScore ?? null;
  if (payload.sectionPercentiles !== undefined) updates.section_percentiles = payload.sectionPercentiles ?? null;
  if (payload.pinnedInsights !== undefined) updates.pinned_insights = payload.pinnedInsights ?? null;

  const { data, error } = await (supabase as any)
    .from("paper_sessions")
    .update(updates)
    .eq("id", payload.id)
    .eq("user_id", session.user.id)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[papers:PATCH] failed updating session", {
      error,
      errorCode: error.code,
      errorMessage: error.message,
      errorDetails: error.details,
      sessionId: payload.id,
      userId: session.user.id
    });
    return NextResponse.json({ error: "Failed to update session", details: error.message }, { status: 500 });
  }

  return NextResponse.json({ session: data ?? null });
}

export async function GET(request: Request) {
  const session = await getOptionalSession();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required", code: "AUTH_REQUIRED" },
      { status: 401 }
    );
  }

  const supabase = createRouteClient();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const inProgress = searchParams.get("in_progress") === "true";

  if (id) {
    const { data, error } = await (supabase as any)
      .from("paper_sessions")
      .select("*")
      .eq("id", id)
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error) {
      console.error("[papers] failed retrieving session", error);
      return NextResponse.json({ error: "Failed to load session" }, { status: 500 });
    }

    return NextResponse.json({ session: data ?? null });
  }

  // Build query
  let query = (supabase as any)
    .from("paper_sessions")
    .select("*")
    .eq("user_id", session.user.id);

  // Filter for in-progress sessions (ended_at IS NULL)
  if (inProgress) {
    query = query.is("ended_at", null);
  }

  query = query.order("started_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error("[papers:GET] failed listing sessions", {
      error,
      errorCode: error.code,
      errorMessage: error.message,
      userId: session.user.id,
      inProgress
    });
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }

  return NextResponse.json({ sessions: data });
}

export async function DELETE(request: Request) {
  const session = await getOptionalSession();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required", code: "AUTH_REQUIRED" },
      { status: 401 }
    );
  }

  const supabase = createRouteClient();

  // Delete all sessions for this user
  const { error } = await (supabase as any)
    .from("paper_sessions")
    .delete()
    .eq("user_id", session.user.id);

  if (error) {
    console.error("[papers] failed deleting all sessions", error);
    return NextResponse.json({ error: "Failed to delete sessions" }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "All sessions deleted" });
}

