/**
 * Marking Info Page Component - Combined completion summary and marking instructions with visual illustrations
 * Uses real session data: derived correctness, overview stats, predicted score, and sample question.
 */

"use client";

import { useMemo, useEffect, useState, useCallback } from "react";
import { usePaperSessionStore } from "@/store/paperSessionStore";
import { getConversionTable, getConversionRows, scaleScore } from "@/lib/supabase/questions";
import type { PaperSection } from "@/types/papers";
import { getSectionColor, PAPER_COLORS } from "@/config/colors";
import { mapPartToSection } from "@/lib/papers/sectionMapping";
import { MISTAKE_OPTIONS } from "@/types/papers";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface MarkingInfoPageProps {
  selectedSections: PaperSection[];
  onNext: () => void;
}

export function MarkingInfoPage({
  selectedSections,
  onNext,
}: MarkingInfoPageProps) {
  const {
    allSectionsQuestions,
    questions,
    answers,
    perQuestionSec,
    guessedFlags,
    correctFlags,
    questionRange,
    paperId,
    getTotalQuestions,
  } = usePaperSessionStore();

  const totalQuestions = getTotalQuestions();
  const questionNumbers = totalQuestions > 0
    ? Array.from({ length: totalQuestions }, (_, i) => questionRange.start + i)
    : [];

  // Derived correctness (same logic as mark page: compare user answer to answerLetter when correctFlags not set)
  const derivedCorrectFlags = useMemo(() => {
    return questionNumbers.map((_, i) => {
      if (correctFlags[i] !== null && correctFlags[i] !== undefined) return correctFlags[i];
      const user = (answers[i]?.choice || "").toString().toUpperCase();
      const correct = (questions[i]?.answerLetter || "").toString().toUpperCase();
      if (!correct) return null;
      if (!user) return false;
      return user === correct;
    });
  }, [questionNumbers, correctFlags, answers, questions]);

  const correctCount = useMemo(
    () => derivedCorrectFlags.filter((f) => f === true).length,
    [derivedCorrectFlags]
  );
  const scorePct = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const totalTimeSec = useMemo(
    () => (perQuestionSec || []).reduce((a, b) => a + (b || 0), 0),
    [perQuestionSec]
  );
  const avgTimeFormatted =
    totalQuestions > 0 ? formatTime(totalTimeSec / totalQuestions) : "0:00";
  const guessedCount = useMemo(
    () => (guessedFlags || []).filter(Boolean).length,
    [guessedFlags]
  );

  // Section analytics (correct/total per part) for predicted score
  const sectionAnalytics = useMemo(() => {
    const analytics: Record<string, { correct: number; total: number }> = {};
    const qs = questions || [];
    const examName = (qs[0]?.examName || "").toUpperCase();
    const isNSAA2019 = examName === "NSAA" && qs[0]?.examYear === 2019;

    for (let i = 0; i < qs.length; i++) {
      const q = qs[i];
      if (!q) continue;
      let part = (q.partLetter || "").trim();
      const partName = (q.partName || "").trim();
      if (!part || part === "—" || part === "") {
        if (partName && isNSAA2019) {
          const pl = partName.toLowerCase();
          if (pl.includes("advanced mathematics") && pl.includes("advanced physics")) part = "Part E";
          else if (pl.includes("mathematics") && !pl.includes("advanced")) part = "Part A";
          else if (pl.includes("physics") && !pl.includes("advanced")) part = "Part B";
          else if (pl.includes("chemistry") || pl.includes("biology")) continue;
        }
        if (!part || part === "—") part = "Section";
      }
      const partUpper = part.toUpperCase();
      if (partUpper === "SECTION" || partUpper.startsWith("SECTION ")) continue;
      if (isNSAA2019) {
        const valid = ["PART A", "PART B", "PART E", "A", "B", "E"];
        const ok = valid.some(
          (v) => partUpper === v || partUpper === `PART ${v}` || (partUpper.includes(v) && !partUpper.includes("SECTION"))
        );
        const isPartE = partName.toLowerCase().includes("advanced mathematics") && partName.toLowerCase().includes("advanced physics");
        if (!ok && !isPartE) continue;
      }
      const key = part || "Section";
      if (!analytics[key]) analytics[key] = { correct: 0, total: 0 };
      analytics[key].total++;
      if (derivedCorrectFlags[i] === true) analytics[key].correct++;
    }
    return analytics;
  }, [questions, derivedCorrectFlags]);

  const resolveConversionPartName = useCallback(
    (examName: string, partLetterRaw: string, partName: string | undefined, rows: any[]): { name: string } => {
      const raw = (partLetterRaw || "").toString().trim().toUpperCase();
      const letter = raw.length === 1 && /[A-Z]/.test(raw) ? raw : (raw.match(/\b([A-Z])\b/)?.[1] || "");
      const candidateNames: string[] = [];
      if (examName === "TMUA") {
        if (partName?.toLowerCase().includes("paper 1")) candidateNames.push("Paper 1");
        if (partName?.toLowerCase().includes("paper 2")) candidateNames.push("Paper 2");
        if (letter === "A" || letter === "1") candidateNames.push("Paper 1");
        if (letter === "B" || letter === "2") candidateNames.push("Paper 2");
      }
      if (examName === "ENGAA") {
        if (/A/.test(letter)) candidateNames.push("Section 1A");
        else if (/B/.test(letter)) candidateNames.push("Section 1B");
        else if (/2/.test(letter)) candidateNames.push("Section 2");
      }
      if (examName === "NSAA") {
        if (letter === "A") candidateNames.push("Part A");
        if (letter === "B") candidateNames.push("Part B");
        if (letter === "C") candidateNames.push("Part C");
        if (letter === "D") candidateNames.push("Part D");
        if (letter === "E") candidateNames.push("Part E");
        if (partName?.toLowerCase().includes("math") && !partName.includes("advanced")) candidateNames.push("Part A");
        if (partName?.toLowerCase().includes("phys") && !partName.includes("advanced")) candidateNames.push("Part B");
        if (partName?.toLowerCase().includes("chem")) candidateNames.push("Part C");
        if (partName?.toLowerCase().includes("biol")) candidateNames.push("Part D");
        if (partName?.toLowerCase().includes("advanced")) candidateNames.push("Part E");
      }
      if (letter) candidateNames.push(`Part ${letter}`);
      if (raw) candidateNames.push(raw);
      if (partName) candidateNames.push(partName);
      const rowsLower = rows.map((r: any) => (r.partName || "").toString().toLowerCase());
      const match = candidateNames.find((n) => rowsLower.includes(n.toLowerCase()));
      return { name: match || candidateNames[0] || partName || letter || "Section" };
    },
    []
  );

  const [predictedScore, setPredictedScore] = useState<number | null | "loading">("loading");
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!paperId || questions.length === 0) {
        if (mounted) setPredictedScore(null);
        return;
      }
      try {
        const table = await getConversionTable(paperId);
        if (!mounted) return;
        if (!table) {
          setPredictedScore(null);
          return;
        }
        const rows = await getConversionRows(table.id);
        if (!mounted) return;
        if (!rows || rows.length === 0) {
          setPredictedScore(null);
          return;
        }
        const examName = (questions[0]?.examName || "").toUpperCase();
        const entries = Object.entries(sectionAnalytics);
        let weightedSum = 0;
        let totalWeight = 0;
        for (const [section, data] of entries) {
          const sectionUpper = section.toUpperCase();
          if (sectionUpper === "SECTION" || sectionUpper.startsWith("SECTION ")) continue;
          const match = questions.find((q) => (q.partLetter || "").trim() === section);
          const partLetterRaw = (match?.partLetter || section).toString().toUpperCase();
          const { name: convPartName } = resolveConversionPartName(examName, partLetterRaw, match?.partName, rows);
          const scaled = scaleScore(rows as any, convPartName as any, data.correct, "nearest");
          if (typeof scaled === "number") {
            weightedSum += scaled * data.total;
            totalWeight += data.total;
          }
        }
        if (mounted) {
          setPredictedScore(totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : null);
        }
      } catch {
        if (mounted) setPredictedScore(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [paperId, questions, sectionAnalytics, resolveConversionPartName]);

  // Sample question: first incorrect, or first question
  const sampleQuestion = useMemo(() => {
    if (questions.length === 0) return null;
    const firstWrong = derivedCorrectFlags.findIndex((f) => f === false);
    const idx = firstWrong >= 0 ? firstWrong : 0;
    const q = questions[idx];
    const qNum = questionRange.start + idx;
    const userChoice = (answers[idx]?.choice || "").toString().toUpperCase() || "—";
    const correctLetter = (q?.answerLetter || "").toString().toUpperCase() || "—";
    const timeSpent = perQuestionSec[idx] || 0;
    const isCorrect = derivedCorrectFlags[idx] === true;
    const isGuessed = guessedFlags[idx] === true;
    const paperType = (q?.examName || "OTHER") as import("@/types/papers").PaperType;
    const sectionName = q
      ? (() => {
          try {
            return mapPartToSection({ partLetter: q.partLetter || "", partName: q.partName || "" }, paperType);
          } catch {
            return (selectedSections[0] as PaperSection) || "Mathematics";
          }
        })()
      : selectedSections[0];
    return {
      questionNumber: qNum,
      partLetter: (q?.partLetter || "").trim().replace(/^Part\s*/i, "") || "—",
      partName: (q?.partName || "").trim() || "—",
      sectionName,
      userAnswer: userChoice,
      correctAnswer: correctLetter,
      timeSpent: formatTime(timeSpent),
      isCorrect,
      isGuessed,
    };
  }, [questions, questionRange, derivedCorrectFlags, answers, perQuestionSec, guessedFlags, selectedSections]);

  const wrongCount = useMemo(
    () => derivedCorrectFlags.filter((f) => f === false).length,
    [derivedCorrectFlags]
  );

  // Map sections to part info
  const sectionPartInfo = useMemo(() => {
    const info: Array<{ section: PaperSection; partLetter: string; partName: string }> = [];
    
    selectedSections.forEach((section, index) => {
      // Try to get from allSectionsQuestions first (most reliable)
      let firstQuestion = null;
      if (allSectionsQuestions.length > index && allSectionsQuestions[index]?.length > 0) {
        firstQuestion = allSectionsQuestions[index][0];
      } else if (questions.length > 0) {
        // Fallback: find first question that matches this section
        // For now, just use first question as fallback
        firstQuestion = questions[0];
      }
      
      // Extract part info
      let partLetter: string = section;
      let partName: string = section;
      
      if (firstQuestion) {
        const letter = (firstQuestion.partLetter || '').toString().trim();
        const name = (firstQuestion.partName || '').toString().trim();
        if (letter) partLetter = letter;
        if (name) partName = name;
      }
      
      // Format part letter (ensure "Part " prefix if not present)
      if (!partLetter.toLowerCase().startsWith('part ')) {
        partLetter = `Part ${partLetter}`;
      }
      
      info.push({ section, partLetter, partName });
    });
    
    return info;
  }, [selectedSections, allSectionsQuestions, questions]);

  const hasData = questions.length > 0 && totalQuestions > 0;

  return (
    <div className="flex flex-col min-h-screen px-8 py-6 bg-[#0a0b0d]">
      <div className="w-full max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-100 mb-1">
              You have completed:
            </h1>
            <p className="text-sm text-neutral-400">
              Review your answers and analyze your performance
            </p>
          </div>
          <button
            onClick={onNext}
            className="px-6 py-3 text-sm font-medium rounded-lg bg-interview/40 hover:bg-interview/60 text-interview transition-all duration-200"
            style={{
              boxShadow: 'inset 0 -4px 0 rgba(0, 0, 0, 0.4), 0 6px 0 rgba(0, 0, 0, 0.6)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = 'inset 0 -4px 0 rgba(0, 0, 0, 0.4), 0 8px 0 rgba(0, 0, 0, 0.7)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'inset 0 -4px 0 rgba(0, 0, 0, 0.4), 0 6px 0 rgba(0, 0, 0, 0.6)';
            }}
          >
            Start Marking
          </button>
        </div>
        
        {/* Sections Table */}
        <div className="border border-white/10 rounded-lg overflow-hidden bg-[#0f1114]">
          <table className="w-full border-collapse">
            <tbody>
              {sectionPartInfo.map(({ section, partLetter, partName }, index) => (
                <tr key={index} className="border-b border-white/5 last:border-b-0 hover:bg-white/5 transition-colors">
                  <td 
                    className="px-4 py-3.5 text-sm font-medium text-white w-32"
                    style={{ backgroundColor: getSectionColor(section) }}
                  >
                    {partLetter}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-neutral-200">
                    {partName}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Three Card Layout with Realistic Previews */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 - Overview Section (real data) */}
          <div className="border border-white/10 rounded-lg overflow-hidden bg-[#0f1114] hover:border-white/20 transition-colors">
            <div className="relative h-64 bg-gradient-to-br from-[#0f1114] to-[#1a1d23] p-4">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-md bg-[#161a1f] border border-white/5 flex flex-col items-center justify-center min-h-[80px]">
                    <div className="text-3xl font-bold text-neutral-100 leading-tight">
                      {hasData ? `${scorePct}%` : "—"}
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-1">
                      {hasData ? `${correctCount}/${totalQuestions} correct` : "—"}
                    </div>
                  </div>
                  <div className="p-3 rounded-md bg-[#161a1f] border border-white/5 flex flex-col items-center justify-center min-h-[80px]">
                    <div className="text-3xl font-bold text-neutral-100 leading-tight">
                      {predictedScore === "loading" ? "…" : predictedScore !== null ? predictedScore : "—"}
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-1">Predicted ESAT</div>
                  </div>
                  <div className="p-3 rounded-md bg-[#161a1f] border border-white/5 flex flex-col items-center justify-center min-h-[80px]">
                    <div className="text-xs text-neutral-400 mb-1">Avg per Question</div>
                    <div className="text-lg font-semibold text-neutral-200 leading-tight">
                      {hasData ? avgTimeFormatted : "—"}
                    </div>
                  </div>
                  <div className="p-3 rounded-md bg-[#161a1f] border border-white/5 flex flex-col items-center justify-center min-h-[80px]">
                    <div className="text-xs text-neutral-400 mb-1">Guessed</div>
                    <div className="text-lg font-semibold text-neutral-200 leading-tight">
                      {hasData ? `${guessedCount}/${totalQuestions}` : "—"}
                    </div>
                  </div>
                </div>
              </div>
              {/* Title Overlay */}
              <div className="absolute bottom-0 left-0 right-0 backdrop-blur-md bg-black/60 px-4 py-3 border-t border-white/10">
                <h3 className="text-sm font-semibold text-white">Overview Section</h3>
                <p className="text-xs text-neutral-300 mt-0.5">View your score, time, and section breakdown</p>
              </div>
            </div>
            <div className="p-4 bg-[#0f1114]">
              <p className="text-xs text-neutral-400 leading-relaxed">
                Check your overall performance, time taken, and see how you did in each section with color-coded results.
              </p>
            </div>
          </div>

          {/* Card 2 - Question Review (real sample question) */}
          <div className="border border-white/10 rounded-lg overflow-hidden bg-[#0f1114] hover:border-white/20 transition-colors">
            <div className="relative h-64 bg-gradient-to-br from-[#0f1114] to-[#1a1d23] p-4">
              <div className="space-y-3">
                {sampleQuestion ? (
                  <>
                    <div className="p-2.5 rounded-md bg-[#161a1f] border border-white/5 hover:bg-[#1a1f26] transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-neutral-300 font-medium" style={{ width: "28px" }}>
                            Q{sampleQuestion.questionNumber}
                          </span>
                          <div
                            className="text-[10px] px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: getSectionColor(sampleQuestion.sectionName || "mathematics") }}
                          >
                            Part {sampleQuestion.partLetter}
                          </div>
                          {sampleQuestion.isGuessed && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: "#b89f5a" }}>
                              Guess
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-[10px] text-neutral-500">{sampleQuestion.timeSpent}</div>
                          {sampleQuestion.isCorrect ? (
                            <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: "#6c9e69" }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: PAPER_COLORS.chemistry }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2 rounded-md border border-white/10" style={{ backgroundColor: sampleQuestion.isCorrect ? "#6c9e69" : PAPER_COLORS.chemistry }}>
                        <div className="text-[9px] text-white/90">Your answer</div>
                        <div className="text-white text-xs mt-0.5 font-medium">{sampleQuestion.userAnswer}</div>
                      </div>
                      <div className="p-2 rounded-md border border-white/10" style={{ backgroundColor: "#6c9e69" }}>
                        <div className="text-[9px] text-white/90">Correct</div>
                        <div className="text-white text-xs mt-0.5 font-medium">{sampleQuestion.correctAnswer}</div>
                      </div>
                      <div className="p-2 rounded-md border border-white/10 bg-[#2b2f36]">
                        <div className="text-[9px] text-neutral-200">Time</div>
                        <div className="text-neutral-50 text-xs mt-0.5">{sampleQuestion.timeSpent}</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-32 text-neutral-500 text-sm">
                    {hasData ? "Loading…" : "Complete the paper to see a sample question"}
                  </div>
                )}
              </div>
              {/* Title Overlay */}
              <div className="absolute bottom-0 left-0 right-0 backdrop-blur-md bg-black/60 px-4 py-3 border-t border-white/10">
                <h3 className="text-sm font-semibold text-white">Question Review</h3>
                <p className="text-xs text-neutral-300 mt-0.5">Mark answers and compare with correct solutions</p>
              </div>
            </div>
            <div className="p-4 bg-[#0f1114]">
              <p className="text-xs text-neutral-400 leading-relaxed">
                Review each question, mark as correct/incorrect, add notes, and view detailed solutions.
              </p>
            </div>
          </div>

          {/* Card 3 - Mistake Analysis (real count; tags set during marking) */}
          <div className="border border-white/10 rounded-lg overflow-hidden bg-[#0f1114] hover:border-white/20 transition-colors">
            <div className="relative h-64 bg-gradient-to-br from-[#0f1114] to-[#1a1d23] p-4">
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="text-[10px] text-neutral-400 uppercase tracking-wide">Questions to review</div>
                  <div className="p-3 rounded-md bg-[#161a1f] border border-white/5 flex flex-col items-center justify-center min-h-[60px]">
                    <div className="text-2xl font-bold text-neutral-100">{hasData ? wrongCount : "—"}</div>
                    <div className="text-[10px] text-neutral-400 mt-1">
                      {hasData ? (wrongCount === 1 ? "question to review" : "questions to review") : "—"}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed pt-1">
                  You&apos;ll tag mistakes and add questions to your drill when you start marking.
                </p>
                <div className="pt-2 border-t border-white/10">
                  <div className="text-[10px] text-neutral-500 uppercase tracking-wide mb-1.5">Tag types available</div>
                  <div className="flex flex-wrap gap-1.5">
                    {MISTAKE_OPTIONS.slice(1, 5).map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-neutral-400">
                        {tag}
                      </span>
                    ))}
                    <span className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-neutral-400">…</span>
                  </div>
                </div>
              </div>
              {/* Title Overlay */}
              <div className="absolute bottom-0 left-0 right-0 backdrop-blur-md bg-black/60 px-4 py-3 border-t border-white/10">
                <h3 className="text-sm font-semibold text-white">Mistake Analysis</h3>
                <p className="text-xs text-neutral-300 mt-0.5">Tag mistakes and set up targeted practice</p>
              </div>
            </div>
            <div className="p-4 bg-[#0f1114]">
              <p className="text-xs text-neutral-400 leading-relaxed">
                Categorize mistakes with tags and add questions to your drill for focused practice sessions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

