import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { computeQuestionStats, MIN_ATTEMPTS_THRESHOLD } from "@/types/questionStats";
import type { QuestionChoiceStatsRow } from "@/lib/supabase/types";
import type { QuestionStats } from "@/types/questionStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ZERO_OPTIONS: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0 };

function stubStats(questionId: number): QuestionStats {
  return {
    questionId,
    attempts: 0,
    avgTimeSeconds: 0,
    correctPercentage: 0,
    optionCounts: { ...ZERO_OPTIONS },
    optionPercentages: { ...ZERO_OPTIONS },
    hasSufficientData: false,
  };
}

/**
 * POST /api/past-papers/questions/stats
 * Fetches community statistics for multiple questions
 * 
 * Body: { questionIds: number[] }
 * Returns: { stats: QuestionStats[] }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { questionIds } = body;

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return NextResponse.json(
        { error: "questionIds must be a non-empty array" },
        { status: 400 }
      );
    }

    // Validate all questionIds are numbers
    if (!questionIds.every((id) => typeof id === "number" && id > 0)) {
      return NextResponse.json(
        { error: "All questionIds must be positive numbers" },
        { status: 400 }
      );
    }

    const supabase = createRouteClient();

    // Fetch stats for all question IDs
    const { data, error } = await supabase
      .from("question_choice_stats")
      .select("*")
      .in("question_id", questionIds);

    if (error) {
      console.error("Error fetching question stats:", error);
      return NextResponse.json(
        { error: "Failed to fetch statistics" },
        { status: 500 }
      );
    }

    // Create a map for quick lookup
    const statsMap = new Map<number, QuestionChoiceStatsRow>();
    (data as QuestionChoiceStatsRow[] | null)?.forEach((row) => {
      statsMap.set(row.question_id, row);
    });

    // Real data only: computeQuestionStats when row exists, else stub
    const result = questionIds.map((questionId: number) => {
      const row = statsMap.get(questionId) || null;
      if (!row) return stubStats(questionId);
      return computeQuestionStats(row, MIN_ATTEMPTS_THRESHOLD);
    });

    return NextResponse.json({ stats: result });
  } catch (error) {
    console.error("Unexpected error fetching question stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}




