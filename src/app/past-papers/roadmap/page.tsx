/**
 * Papers Roadmap page - Linear, unlock-based practice structure
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/shared/PageHeader";
import { useSupabaseSession } from "@/components/auth/SupabaseSessionProvider";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeCTA } from "@/components/subscription/UpgradeCTA";
import {
  getRoadmapStages,
  getRoadmapStagesSync,
  type RoadmapStage,
} from "@/lib/papers/roadmapConfig";
import {
  getStageCompletionCount,
  getStageCompletion,
} from "@/lib/papers/roadmapCompletion";
import { RoadmapList } from "@/components/papers/roadmap/RoadmapList";
import { RoadmapTimeline } from "@/components/papers/roadmap/RoadmapTimeline";
import { RoadmapAnalytics } from "@/components/papers/roadmap/RoadmapAnalytics";
import { getSectionForRoadmapPart } from "@/lib/papers/roadmapConfig";
import { deriveTmuaSectionFromQuestion } from "@/lib/papers/sectionMapping";
import { usePaperSessionStore } from "@/store/paperSessionStore";
import { getPaper, getQuestions } from "@/lib/supabase/questions";
import { examNameToPaperType } from "@/lib/papers/paperConfig";
import type { PaperSection, Question, Paper } from "@/types/papers";
import type { RoadmapPart } from "@/lib/papers/roadmapConfig";

const FREE_ROADMAP_ITEMS = 3;

export default function PapersRoadmapPage() {
  const router = useRouter();
  const session = useSupabaseSession();
  const { hasFullAccess } = useSubscription();
  const { startSession, loadQuestions, setQuestions } = usePaperSessionStore();
  const [stages, setStages] = useState<RoadmapStage[]>([]);
  const [unlockedStages, setUnlockedStages] = useState<Set<string>>(new Set());
  const [completionData, setCompletionData] = useState<
    Map<string, { completed: number; total: number; parts: Map<string, boolean> }>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [currentStageIndex, setCurrentStageIndex] = useState<number | null>(null);
  const [examPreference, setExamPreference] = useState<'ESAT' | 'TMUA' | null>(null);

  // Load user exam preference
  useEffect(() => {
    async function loadExamPreference() {
      if (!session?.user?.id) return;
      
      try {
        const response = await fetch("/api/profile/preferences");
        if (response.ok) {
          const data = await response.json();
          setExamPreference(data.exam_preference || null);
        }
      } catch (error) {
        console.error("[roadmap] Error loading exam preference:", error);
      }
    }
    loadExamPreference();
  }, [session]);

  // Load stages (including dynamic TMUA stages)
  useEffect(() => {
    async function loadStages() {
      try {
        const loadedStages = await getRoadmapStages();
        
        // Debug: Log all stages by exam type
        const stagesByExam = loadedStages.reduce((acc, stage) => {
          if (!acc[stage.examName]) acc[stage.examName] = [];
          acc[stage.examName].push(stage.id);
          return acc;
        }, {} as Record<string, string[]>);
        
        // Debug: Check for duplicates
        const stageIds = loadedStages.map(s => s.id);
        const duplicates = stageIds.filter((id, index) => stageIds.indexOf(id) !== index);
        if (duplicates.length > 0) {
          console.warn("[roadmap] Duplicate stage IDs found:", duplicates);
        }
        
        // Roadmap shows ALL exams regardless of preference (preference only affects other views)
        // Don't filter by examPreference - users should see all available practice materials
        setStages(loadedStages);
      } catch (error) {
        console.error("[roadmap] Error loading stages:", error);
        // Fallback to sync version if async fails
        const syncStages = getRoadmapStagesSync();
        // Roadmap shows ALL exams regardless of preference
        setStages(syncStages);
      }
    }
    loadStages();
  }, [examPreference]);

  // Load completion data
  useEffect(() => {
    if (stages.length === 0) return; // Wait for stages to load

    async function loadCompletionData() {
      // Set loading to true at start
      setLoading(true);
      try {
        // 1. Get completion data for each stage
        const completionMap = new Map<
          string,
          { completed: number; total: number; parts: Map<string, boolean> }
        >();

        if (session?.user?.id) {
          // OPTIMIZATION: Load all completed sessions once, then process in memory
          // This avoids hundreds of sequential database queries
          const { loadAllCompletedSessions, getStageCompletionFromSessions } = await import('@/lib/papers/roadmapCompletion');
          const sessionsByPaperName = await loadAllCompletedSessions(session.user.id);

          // Process all stages (now async due to part-level checking)
          for (const stage of stages) {
            const parts = await getStageCompletionFromSessions(session.user.id, sessionsByPaperName, stage);
            
            let completed = 0;
            for (const [_, isCompleted] of parts) {
              if (isCompleted) {
                completed++;
              }
            }

            completionMap.set(stage.id, {
              completed,
              total: parts.size,
              parts,
            });
          }
        } else {
          // No user session - set all stages to 0 completion
          for (const stage of stages) {
            completionMap.set(stage.id, {
              completed: 0,
              total: stage.parts.length,
              parts: new Map<string, boolean>(),
            });
          }
        }

        setCompletionData(completionMap);

        // 2. Determine Unlocked Status and Current Stage
        // Smart unlocking logic:
        // - First stage is always unlocked
        // - Stage N is unlocked if stage N-1 is completed OR if stage N itself is already completed
        // This handles cases where users complete stages out of order (e.g., complete 2019, then 2018, unlocks 2020)
        const unlocked = new Set<string>();
        let currentIndex: number | null = null;

        for (let i = 0; i < stages.length; i++) {
          const stage = stages[i];
          const data = completionMap.get(stage.id);
          const isCompleted = (data?.completed || 0) === (data?.total || stage.parts.length) && (data?.total || 0) > 0;

          let isUnlocked = false;
          if (i === 0) {
            // First stage is always unlocked
            isUnlocked = true;
          } else {
            // Stage is unlocked if:
            // 1. Previous stage is completed (normal progression), OR
            // 2. This stage is already completed (handles backward completion)
            const prevStage = stages[i - 1];
            const prevData = completionMap.get(prevStage.id);
            const isPrevCompleted = (prevData?.completed || 0) === (prevData?.total || prevStage.parts.length) && (prevData?.total || 0) > 0;
            
            isUnlocked = isPrevCompleted || isCompleted;
          }

          if (isUnlocked) {
            unlocked.add(stage.id);
            // First incomplete unlocked stage is current
            if (!isCompleted && currentIndex === null) {
              currentIndex = i;
            }
          }
        }

        setUnlockedStages(unlocked);
        setCurrentStageIndex(currentIndex ?? 0);
      } catch (error) {
        console.error("[roadmap] Error loading completion data:", error);
        // Set default completion data on error to prevent infinite loading
        const defaultCompletionMap = new Map<
          string,
          { completed: number; total: number; parts: Map<string, boolean> }
        >();
        for (const stage of stages) {
          defaultCompletionMap.set(stage.id, {
            completed: 0,
            total: stage.parts.length,
            parts: new Map<string, boolean>(),
          });
        }
        setCompletionData(defaultCompletionMap);
        setUnlockedStages(new Set([stages[0]?.id].filter(Boolean)));
        setCurrentStageIndex(0);
      } finally {
        setLoading(false);
      }
    }

    loadCompletionData();
  }, [session?.user?.id, stages]);


  // Handle stage start with selected parts
  const handleStartStage = useCallback(
    async (stage: RoadmapStage, selectedParts: RoadmapPart[]) => {
      try {
        if (selectedParts.length === 0) {
          console.error("[roadmap] No parts selected");
          return;
        }

        // Group selected parts by paper (paperName + examType combination)
        const partsByPaper = new Map<string, typeof selectedParts>();
        selectedParts.forEach(part => {
          const paperKey = `${part.paperName}-${part.examType}`;
          if (!partsByPaper.has(paperKey)) {
            partsByPaper.set(paperKey, []);
          }
          partsByPaper.get(paperKey)!.push(part);
        });

        // Determine primary paper (for session metadata) - use the one with most parts
        let primaryPaperKey = '';
        let maxParts = 0;
        for (const [key, parts] of partsByPaper.entries()) {
          if (parts.length > maxParts) {
            maxParts = parts.length;
            primaryPaperKey = key;
          }
        }

        const primaryParts = partsByPaper.get(primaryPaperKey) || selectedParts;
        const firstPart = primaryParts[0];

        // Collect sections from ALL selected parts (not just primary)
        const allSections = new Set<PaperSection>();
        const paperType = examNameToPaperType(stage.examName) || "NSAA";

        // Handle TMUA differently - use section mapping
        if (paperType === "TMUA") {
          selectedParts.forEach(part => {
            // TMUA uses Paper 1 / Paper 2 as sections
            if (part.paperName === "Paper 1") {
              allSections.add("Paper 1");
            } else if (part.paperName === "Paper 2") {
              allSections.add("Paper 2");
            }
          });
        } else {
          // Collect sections from ALL selected parts across all papers
          selectedParts.forEach(part => {
            const section = getSectionForRoadmapPart(part, stage.examName);
            allSections.add(section);
          });
        }

        // Load questions from ALL papers that have selected parts
        const allPapers = new Map<string, Paper>();
        const allQuestionsByPaper = new Map<number, Question[]>();
        
        console.log("[roadmap] Loading papers for selected parts:", {
          selectedPartsCount: selectedParts.length,
          papersCount: partsByPaper.size,
          paperKeys: Array.from(partsByPaper.keys())
        });
        
        for (const [paperKey, parts] of partsByPaper.entries()) {
          const firstPartInPaper = parts[0];
          const paper = await getPaper(stage.examName, stage.year, firstPartInPaper.paperName, firstPartInPaper.examType);
          
          if (!paper) {
            console.error("[roadmap] Paper not found for stage", {
              examName: stage.examName,
              year: stage.year,
              paperName: firstPartInPaper.paperName,
              examType: firstPartInPaper.examType,
              stageId: stage.id
            });
            
            // Show user-friendly error message
            alert(`Paper not found: ${stage.examName} ${stage.year} ${firstPartInPaper.paperName} (${firstPartInPaper.examType}). Please check if this paper exists in the database.`);
            return;
          }
          
          console.log("[roadmap] Loaded paper:", {
            paperKey,
            paperId: paper.id,
            paperName: paper.paperName,
            partsCount: parts.length,
            parts: parts.map(p => `${p.partLetter}: ${p.partName}`)
          });
          
          allPapers.set(paperKey, paper);
          const questions = await getQuestions(paper.id);
          console.log("[roadmap] Loaded questions from paper:", {
            paperId: paper.id,
            questionsCount: questions.length
          });
          allQuestionsByPaper.set(paper.id, questions);
        }

        // Get primary paper for session metadata
        const primaryPaper = allPapers.get(primaryPaperKey);
        if (!primaryPaper) {
          console.error("[roadmap] Primary paper not found");
          return;
        }

        // Combine questions from all papers and filter to match ALL selected parts
        let matchingQuestions: Question[] = [];

        console.log("[roadmap] Filtering questions:", {
          allSections: Array.from(allSections),
          paperType,
          totalPapers: allQuestionsByPaper.size
        });

        if (paperType === "TMUA") {
          // For TMUA, combine questions from all papers and filter by section
          for (const [paperId, questions] of allQuestionsByPaper.entries()) {
            const totalQuestions = questions.length;
            const filtered = questions.filter((q: Question, index: number) => {
              const section = deriveTmuaSectionFromQuestion(q, index, totalQuestions);
              return Array.from(allSections).includes(section);
            });
            matchingQuestions = [...matchingQuestions, ...filtered];
          }
        } else {
          // For NSAA/ENGAA, filter questions from all papers to match ALL selected parts
          // Important: For NSAA, Section 1 and Section 2 might be in the same paper or different papers
          // We need to match parts correctly, considering that the same partLetter/partName
          // might exist in both sections, so we need to use the paperName from the roadmap config
          // to distinguish them. However, if they're in the same paper, we rely on the database
          // structure to have them properly distinguished (e.g., via examType or other fields).
          
          for (const [paperKey, parts] of partsByPaper.entries()) {
            const paper = allPapers.get(paperKey);
            if (!paper) continue;
            
            const questions = allQuestionsByPaper.get(paper.id) || [];
            console.log("[roadmap] Filtering questions for paper:", {
              paperKey,
              paperId: paper.id,
              paperName: paper.paperName,
              questionsCount: questions.length,
              partsToMatch: parts.map(p => `${p.partLetter}: ${p.partName} (${p.paperName})`)
            });
            
            // Log sample questions for debugging Section 2
            if (paper.paperName === 'Section 2' && questions.length > 0) {
              console.log("[roadmap] Sample Section 2 questions:", questions.slice(0, 3).map(q => ({
                questionNumber: q.questionNumber,
                partLetter: q.partLetter,
                partName: q.partName
              })));
            }
            
            const filtered = questions.filter((q: Question) => {
              return parts.some(part => {
                // Normalize strings for comparison (case-insensitive, trimmed)
                const qPartLetter = (q.partLetter || '').toString().trim().toLowerCase();
                const qPartName = (q.partName || '').toString().trim().toLowerCase();
                const partLetter = part.partLetter.trim().toLowerCase();
                const partName = part.partName.trim().toLowerCase();
                
                // Check if question matches this part (case-insensitive)
                // Since Section 1 and Section 2 are separate papers, all questions in a paper
                // belong to that section, so we just need to match partLetter/partName
                const partLetterMatches = 
                  qPartLetter === partLetter ||
                  qPartLetter.includes(partLetter) ||
                  partLetter.includes(qPartLetter);
                
                const partNameMatches = 
                  qPartName === partName ||
                  qPartName.includes(partName) ||
                  partName.includes(qPartName);

                const partMatches = partLetterMatches && partNameMatches;

                if (!partMatches) {
                  // Debug logging for first few non-matching questions
                  if (paper.paperName === 'Section 2' && questions.indexOf(q) < 3) {
                    console.log("[roadmap] Section 2 question not matching:", {
                      questionNumber: q.questionNumber,
                      qPartLetter: q.partLetter,
                      qPartName: q.partName,
                      partToMatch: { partLetter: part.partLetter, partName: part.partName },
                      partLetterMatches,
                      partNameMatches
                    });
                  }
                  return false;
                }

                // Apply question range filter if specified (for ENGAA Section 1 Part A split)
                if (part.questionRange) {
                  const inRange = q.questionNumber >= part.questionRange.start && 
                                 q.questionNumber <= part.questionRange.end;
                  if (!inRange) return false;
                }

                // Apply question filter if specified (for ENGAA Section 1 Part B)
                if (part.questionFilter && part.questionFilter.length > 0) {
                  return part.questionFilter.includes(q.questionNumber);
                }

                return true;
              });
            });
            
            console.log("[roadmap] Filtered questions for paper:", {
              paperKey,
              beforeCount: questions.length,
              afterCount: filtered.length
            });
            
            matchingQuestions = [...matchingQuestions, ...filtered];
          }
        }
        
        console.log("[roadmap] Total matching questions:", matchingQuestions.length);

        if (matchingQuestions.length === 0) {
          console.error("[roadmap] No matching questions found for stage");
          return;
        }

        // Get question number range
        const questionNumbers = matchingQuestions.map((q: Question) => q.questionNumber).sort((a: number, b: number) => a - b);
        const questionStart = questionNumbers[0];
        const questionEnd = questionNumbers[questionNumbers.length - 1];
        const totalQuestions = questionNumbers.length;

        // Calculate time (1.5 min per question, or 75 min per section for TMUA)
        let timeLimitMinutes: number;
        if (paperType === "TMUA") {
          timeLimitMinutes = Array.from(allSections).length * 75;
        } else {
          timeLimitMinutes = Math.ceil(totalQuestions * 1.5);
        }

        // Create variant string (use primary paper for metadata)
        const variantString = `${stage.year}-${firstPart.paperName}-${firstPart.examType}`;

        // Start session (use primary paper ID, but questions are already filtered)
        startSession({
          paperId: primaryPaper.id,
          paperName: paperType,
          paperVariant: variantString,
          sessionName: `${stage.examName} ${stage.year} - ${new Date().toLocaleString()}`,
          timeLimitMinutes,
          questionRange: {
            start: questionStart,
            end: questionEnd,
          },
          selectedSections: Array.from(allSections),
        });

        // If we have questions from multiple papers, set them directly
        // Otherwise, use the standard loadQuestions
        if (allPapers.size > 1) {
          console.log("[roadmap] Multiple papers detected, setting questions directly:", {
            papersCount: allPapers.size,
            totalQuestions: matchingQuestions.length,
            sections: Array.from(allSections)
          });
          // Set questions directly since we've already loaded and filtered from all papers
          setQuestions(matchingQuestions);
        } else {
          // Single paper - use standard loading
          console.log("[roadmap] Single paper, using standard loadQuestions");
          await loadQuestions(primaryPaper.id);
        }
        
        router.push("/past-papers/solve");
      } catch (error) {
        console.error("[roadmap] Error starting stage:", error);
      }
    },
    [router, startSession, loadQuestions]
  );

  // Refresh completion data
  const refreshCompletionData = useCallback(async () => {
    try {
      const completionMap = new Map<
        string,
        { completed: number; total: number; parts: Map<string, boolean> }
      >();

      if (session?.user?.id) {
        // Sync cache with database on refresh (will use cache if valid)
        const { syncWithDatabase } = await import('@/lib/papers/completionCache');
        const completedIds = await syncWithDatabase(session.user.id);
        
        for (const stage of stages) {
          const count = await getStageCompletionCount(session.user.id, stage);
          const parts = await getStageCompletion(session.user.id, stage);

          completionMap.set(stage.id, {
            completed: count.completed,
            total: count.total,
            parts,
          });
        }
      } else {
        // If no user, set all to 0 completion
        for (const stage of stages) {
          completionMap.set(stage.id, {
            completed: 0,
            total: stage.parts.length,
            parts: new Map(),
          });
        }
      }

      setCompletionData(completionMap);
    } catch (error) {
      console.error("[roadmap] Error refreshing completion data:", error);
    }

    setLoading(false);
  }, [session?.user?.id, stages]);

  // Track actual node positions for timeline alignment - MUST be before conditional return
  const [nodePositions, setNodePositions] = useState<number[]>([]);

  const handleNodePositionsUpdate = useCallback((positions: number[]) => {
    setNodePositions(positions);
  }, []);

  if (loading) {
    return (
      <Container>
        <PageHeader title="Practice Roadmap" />
        <div className="py-12 text-center text-white/50">Loading...</div>
      </Container>
    );
  }

  // Limit to first N items for free users
  const visibleStages = hasFullAccess ? stages : stages.slice(0, FREE_ROADMAP_ITEMS);
  const visibleUnlocked = new Set(
    visibleStages.map((s) => s.id).filter((id) => unlockedStages.has(id))
  );
  const visibleCurrentIndex =
    currentStageIndex !== null && currentStageIndex < visibleStages.length
      ? currentStageIndex
      : 0;

  // Prepare timeline nodes data
  const timelineNodes = visibleStages.map((stage, index) => {
    const data = completionData.get(stage.id);
    const completedCount = data?.completed || 0;
    const totalCount = data?.total || stage.parts.length;
    const isUnlocked = visibleUnlocked.has(stage.id);
    const isCompleted = completedCount === totalCount && totalCount > 0;
    const isCurrent = visibleCurrentIndex === index;

    return {
      stage,
      isCompleted,
      isUnlocked,
      isCurrent,
      completedCount,
      totalCount,
    };
  });

  return (
    <Container>
      {/* Custom Title Section with proper padding */}
      <div className="pt-8 pb-6">
        <h1 className="text-2xl font-semibold uppercase tracking-wider text-white/90">
          Practice Roadmap
        </h1>
      </div>

      {/* Analytics Section - At the top */}
      <RoadmapAnalytics
        stages={visibleStages}
        completionData={completionData}
        currentStageIndex={visibleCurrentIndex}
      />

      {/* Two-column layout: Timeline (left) and Roadmap (right) */}
      <div className="pt-4 pb-8">
        <div className="flex gap-8 lg:gap-12">
          {/* Left: Timeline (15-20% width, hidden on mobile) */}
          <div className="w-[18%] flex-shrink-0 hidden lg:block">
            <div className="sticky top-8">
              <RoadmapTimeline
                stages={visibleStages}
                nodePositions={nodePositions}
                currentStageIndex={visibleCurrentIndex ?? undefined}
              />
            </div>
          </div>

          {/* Right: Roadmap List (80-85% width, full width on mobile) */}
          <div className="flex-1 min-w-0 lg:w-[82%]">
            <RoadmapList
              nodes={timelineNodes}
              completionData={completionData}
              onStartSession={handleStartStage}
              onNodePositionsUpdate={handleNodePositionsUpdate}
              timelineNodePositions={nodePositions}
            />
            {!hasFullAccess && (
              <div className="mt-8">
                <UpgradeCTA feature="the full roadmap" />
              </div>
            )}
          </div>
        </div>
      </div>
    </Container>
  );
}

