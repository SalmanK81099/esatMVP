import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { QuestionBankCommunityStats } from "@/types/questionBank";

export const dynamic = "force-dynamic";

const MIN_ATTEMPTS_THRESHOLD = 5;
const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function normalizeOption(s: string): string {
  const u = (s || "").trim().toUpperCase();
  return LETTERS.includes(u) ? u : u.slice(0, 1);
}

/**
 * GET /api/question-bank/questions/[id]/community-stats
 * Returns aggregated community stats for a question (attempts, avg time, answer distribution).
 * Uses service role when available so stats include all users; otherwise RLS may limit to current user.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const questionId = params.id;
    if (!questionId) {
      return NextResponse.json({ error: "Missing question id" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = serviceKey && supabaseUrl
      ? createClient<Database>(supabaseUrl, serviceKey)
      : null;

    if (!supabase) {
      return NextResponse.json(
        { error: "Server not configured for community stats" },
        { status: 503 }
      );
    }

    const { data: rows, error } = await supabase
      .from("question_bank_attempts")
      .select("user_answer, time_spent_ms, is_correct")
      .eq("question_id", questionId);

    if (error) {
      console.error("[Community-stats API] Error:", error);
      return NextResponse.json(
        { error: "Failed to fetch community stats" },
        { status: 500 }
      );
    }

    const attempts = (rows ?? []).length;
    const optionCounts: Record<string, number> = {};
    LETTERS.forEach((l) => (optionCounts[l] = 0));
    let timeSumMs = 0;
    let correctCount = 0;

    for (const row of rows ?? []) {
      const letter = normalizeOption(row.user_answer ?? "");
      if (LETTERS.includes(letter)) optionCounts[letter] = (optionCounts[letter] ?? 0) + 1;
      if (row.time_spent_ms != null) timeSumMs += row.time_spent_ms;
      if (row.is_correct) correctCount += 1;
    }

    const avgTimeSeconds = attempts > 0 ? timeSumMs / 1000 / attempts : 0;
    const correctPercentage = attempts > 0 ? (correctCount / attempts) * 100 : 0;
    const optionPercentages: Record<string, number> = {};
    for (const [letter, count] of Object.entries(optionCounts)) {
      optionPercentages[letter] = attempts > 0 ? (count / attempts) * 100 : 0;
    }

    const stats: QuestionBankCommunityStats = {
      questionId,
      attempts,
      avgTimeSeconds,
      correctPercentage,
      optionCounts,
      optionPercentages,
      hasSufficientData: attempts >= MIN_ATTEMPTS_THRESHOLD,
    };
    return NextResponse.json(stats);
  } catch (err) {
    console.error("[Community-stats API] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
