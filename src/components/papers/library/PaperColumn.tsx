/**
 * PaperColumn - Simplified paper item with icons and plus buttons
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronDown, Plus, CheckCircle2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getPaperTypeColor } from "@/config/colors";
import { getQuestions } from "@/lib/supabase/questions";
import { getAvailableSectionsFromParts, mapPartToSection } from "@/lib/papers/sectionMapping";
import { examNameToPaperType } from "@/lib/papers/paperConfig";
import type { Paper, PaperSection, Question } from "@/types/papers";
import { useSupabaseSession } from "@/components/auth/SupabaseSessionProvider";
import { getPaperCompletionStatus, getPaperSectionCompletion } from "@/lib/papers/libraryCompletion";

interface PaperColumnProps {
  paper: Paper;
  isSelected: boolean;
  selectedSections: Set<PaperSection>;
  onToggleSection: (paperId: number, section: PaperSection) => void;
  onAddFullPaper: (paper: Paper, sections: PaperSection[]) => void;
  onAddPaper: (paper: Paper) => void;
  onAddSection?: (paper: Paper, sectionName: string, sections: PaperSection[]) => void;
  allPapers?: Paper[];
}

interface MainSection {
  name: string; // "Section 1", "Section 2", "Paper 1", "Paper 2"
  subjectParts: PaperSection[];
}

// Determine which main section a question belongs to
function getMainSectionForQuestion(
  question: Question,
  paperType: string,
  paperExamType?: string,
  paperName?: string
): "Section 1" | "Section 2" {
  const examTypeLower = (question.examType || paperExamType || "").toLowerCase();
  const partLetter = (question.partLetter || "").toString().toLowerCase();
  const partName = (question.partName || "").toString().toLowerCase();
  const paperNameLower = (question.paperName || paperName || "").toLowerCase();

  const isSection2 = /(^|\s)(section|paper)\s*2\b/.test(examTypeLower) ||
    examTypeLower === "s2" ||
    examTypeLower.includes("sec 2");
  const isSection1 = /(^|\s)(section|paper)\s*1\b/.test(examTypeLower) ||
    examTypeLower === "s1" ||
    examTypeLower.includes("sec 1");

  if (isSection2) return "Section 2";
  if (isSection1) return "Section 1";

  if (/(^|\s)(section|paper)\s*2\b/.test(paperNameLower) || paperNameLower.includes("sec 2")) {
    return "Section 2";
  }
  if (/(^|\s)(section|paper)\s*1\b/.test(paperNameLower) || paperNameLower.includes("sec 1")) {
    return "Section 1";
  }

  if (paperType === "NSAA") {
    const hasMathematics = (partName.includes("mathematics") || partLetter === "a" || partLetter === "1") &&
      !partName.includes("advanced");
    if (hasMathematics) return "Section 1";

    const isSciencePart = partLetter === "b" || partLetter === "c" || partLetter === "d" ||
      partLetter === "2" || partLetter === "3" || partLetter === "4";
    if (isSciencePart && !partName.includes("mathematics")) {
      return "Section 2";
    }
  }

  if (paperType === "ENGAA") {
    if (partLetter === "a" || partLetter === "1") {
      return "Section 1";
    }
    if (partLetter === "b" || partLetter === "2") {
      return "Section 2";
    }

    if (partName.includes("mathematics") && partName.includes("physics") && !partName.includes("advanced")) {
      return "Section 1";
    }
    if (partName.includes("advanced") && partName.includes("mathematics") && partName.includes("physics")) {
      return "Section 2";
    }
  }

  if (paperType === "ESAT") {
    return "Section 1";
  }

  return "Section 1";
}

// Group sections into main sections and subject parts based on actual questions
function groupSectionsIntoMainSections(
  sections: PaperSection[],
  paperType: string,
  examType: string,
  questions: Question[],
  paper?: Paper
): MainSection[] {
  const mainSections: MainSection[] = [];

  if (paperType === "TMUA") {
    const paper1Exists = sections.includes("Paper 1");
    const paper2Exists = sections.includes("Paper 2");

    if (paper1Exists) {
      mainSections.push({ name: "Paper 1", subjectParts: ["Paper 1"] });
    }
    if (paper2Exists) {
      mainSections.push({ name: "Paper 2", subjectParts: ["Paper 2"] });
    }

    if (mainSections.length === 0 && questions.length > 0) {
      mainSections.push({ name: "Paper 1", subjectParts: ["Paper 1"] });
      mainSections.push({ name: "Paper 2", subjectParts: ["Paper 2"] });
    }
  } else if (paperType === "NSAA" || paperType === "ENGAA" || paperType === "ESAT") {
    const section1Parts = new Set<PaperSection>();
    const section2Parts = new Set<PaperSection>();

    questions.forEach((question) => {
      const mainSection = getMainSectionForQuestion(
        question,
        paperType,
        paper?.examType,
        paper?.paperName
      );
      const subjectPart = mapPartToSection(
        { partLetter: question.partLetter, partName: question.partName },
        paperType
      );

      if (mainSection === "Section 1") {
        section1Parts.add(subjectPart);
      } else if (mainSection === "Section 2") {
        section2Parts.add(subjectPart);
      } else {
        section1Parts.add(subjectPart);
      }
    });

    if (section1Parts.size > 0) {
      mainSections.push({
        name: "Section 1",
        subjectParts: Array.from(section1Parts),
      });
    }

    if (section2Parts.size > 0) {
      mainSections.push({
        name: "Section 2",
        subjectParts: Array.from(section2Parts),
      });
    }

    if (mainSections.length === 0 && sections.length > 0) {
      mainSections.push({ name: "Section 1", subjectParts: sections });
    }
  } else {
    if (sections.length > 0) {
      mainSections.push({ name: "Sections", subjectParts: sections });
    }
  }

  return mainSections;
}

export function PaperColumn({
  paper,
  isSelected,
  selectedSections,
  onToggleSection,
  onAddFullPaper,
  onAddPaper,
  onAddSection,
  allPapers = [],
}: PaperColumnProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [availableSections, setAvailableSections] = useState<PaperSection[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [paperCompletionStatus, setPaperCompletionStatus] = useState<'none' | 'partial' | 'complete'>('none');
  const [sectionCompletionMap, setSectionCompletionMap] = useState<Map<PaperSection, boolean>>(new Map());
  const [loadingCompletion, setLoadingCompletion] = useState(false);

  const session = useSupabaseSession();
  const paperColor = getPaperTypeColor(paper.examName);
  const paperType = examNameToPaperType(paper.examName as any) || "NSAA";

  // Load sections and questions from both Section 1 and Section 2 if they exist
  useEffect(() => {
    const loadData = async () => {
      if (availableSections.length === 0 && !loadingSections) {
        setLoadingSections(true);
        try {
          const siblingPapers = allPapers.filter(
            (p) =>
              p.examName === paper.examName &&
              p.examYear === paper.examYear &&
              p.id !== paper.id &&
              (paperType === "NSAA" || paperType === "ENGAA" || paperType === "ESAT")
          );

          const currentQuestions = await getQuestions(paper.id);
          let allQuestions = [...currentQuestions];

          for (const siblingPaper of siblingPapers) {
            try {
              const siblingQuestions = await getQuestions(siblingPaper.id);
              allQuestions = [...allQuestions, ...siblingQuestions];
            } catch (error) {
              console.error(`[PaperColumn] Error loading sibling paper ${siblingPaper.id}:`, error);
            }
          }

          setQuestions(allQuestions);

          const allParts = allQuestions.map((q) => ({
            partLetter: q.partLetter,
            partName: q.partName,
          }));

          const sectionSet = new Set<PaperSection>();
          allParts.forEach((part) => {
            const section = mapPartToSection(part, paperType);
            sectionSet.add(section);
          });

          const allSections = Array.from(sectionSet);
          setAvailableSections(allSections);
        } catch (error) {
          console.error(`[PaperColumn] Error loading data for paper ${paper.id}:`, error);
        } finally {
          setLoadingSections(false);
        }
      }
    };
    loadData();
  }, [paper.id, paper.examName, paper.examYear, paperType, allPapers, availableSections.length, loadingSections]);

  // Group sections into main sections
  const mainSections = useMemo(() => {
    if (availableSections.length === 0 || questions.length === 0) {
      if (availableSections.length > 0) {
        return [{ name: "Section 1", subjectParts: availableSections }];
      }
      return [];
    }

    const grouped = groupSectionsIntoMainSections(availableSections, paperType, paper.examType, questions, paper);

    if (paperType === "TMUA") {
      return grouped;
    }

    return grouped;
  }, [availableSections, paperType, paper.examType, questions, paper]);

  // Load completion status when sections are available
  useEffect(() => {
    if (availableSections.length > 0 && session?.user?.id && !loadingCompletion) {
      const loadCompletionStatus = async () => {
        setLoadingCompletion(true);
        try {
          const status = await getPaperCompletionStatus(session.user.id, paper, availableSections);
          const sectionMap = await getPaperSectionCompletion(session.user.id, paper, availableSections);
          setPaperCompletionStatus(status);
          setSectionCompletionMap(sectionMap);
        } catch (error) {
          console.error('[PaperColumn] Error loading completion status:', error);
        } finally {
          setLoadingCompletion(false);
        }
      };
      loadCompletionStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadingCompletion intentionally excluded to prevent infinite loop (effect toggles it)
  }, [availableSections, session?.user?.id, paper]);

  const handleAddPaperClick = () => {
    if (availableSections.length > 0) {
      onAddFullPaper(paper, availableSections);
    } else {
      onAddPaper(paper);
    }
  };

  const handleAddSectionClick = (sectionName: string, subjectParts: PaperSection[]) => {
    if (onAddSection) {
      onAddSection(paper, sectionName, subjectParts);
    } else {
      // Fallback: add all subjects from this section
      subjectParts.forEach((part) => {
        onToggleSection(paper.id, part);
      });
    }
  };

  return (
    <div className="space-y-2">
      {/* Main paper row */}
      <div
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg transition-all h-14",
          isSelected
            ? "bg-surface-neutral"
            : "bg-surface-elevated hover:bg-surface-neutral"
        )}
      >
        {/* Left: Dropdown icon for papers */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-8 h-8 flex items-center justify-center flex-shrink-0 text-text-muted hover:text-text transition-colors"
        >
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-transform duration-200",
              isExpanded ? "rotate-0" : "-rotate-90"
            )}
            strokeWidth={3}
          />
        </button>

        {/* Exam Name and Year */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-base font-mono font-bold text-text">
              {paper.examName} {paper.examYear}
            </div>
            {/* Completion status badge for paper */}
            {paperCompletionStatus !== 'none' && (
              <div className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide flex items-center gap-1",
                paperCompletionStatus === 'complete' 
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
              )}>
                <CheckCircle2 className="w-3 h-3" />
                {paperCompletionStatus === 'complete' ? 'Complete' : 'In Progress'}
              </div>
            )}
          </div>
        </div>

        {/* Right: Official/Specimen Tag */}
        {paper.examType && (
          <div className="px-2 py-1 rounded-md bg-surface-elevated text-[10px] uppercase font-mono tracking-wider text-text-subtle mr-2 border border-border">
            {paper.examType}
          </div>
        )}

        {/* Right: Plus button */}
        <button
          onClick={handleAddPaperClick}
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all",
            "bg-surface-elevated hover:bg-surface text-text-muted hover:text-text"
          )}
          aria-label="Add paper to session"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      </div>

      {/* Expanded sections - show Section 1 and Section 2 as separate rows */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="space-y-2 pl-11 overflow-hidden"
          >
            {loadingSections ? (
              <div className="text-xs text-text-disabled py-2">Loading sections...</div>
            ) : mainSections.length === 0 ? (
              <div className="text-xs text-text-disabled py-2">No sections available</div>
            ) : (
              mainSections.map((mainSection) => {
                const sectionNumber = mainSection.name === "Section 1" || mainSection.name === "Paper 1" ? "1" :
                  mainSection.name === "Section 2" || mainSection.name === "Paper 2" ? "2" : null;

                return (
                  <div
                    key={mainSection.name}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg transition-all h-14",
                      isSelected
                        ? "bg-surface-neutral"
                        : "bg-surface-elevated hover:bg-surface-neutral"
                    )}
                  >
                    {/* Left: Number badge for sections */}
                    {sectionNumber ? (
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-sm text-text"
                        style={{ backgroundColor: paperColor }}
                      >
                        {sectionNumber}
                      </div>
                    ) : (
                      <div className="w-8 h-8 flex-shrink-0" />
                    )}

                    {/* Section name */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-mono font-semibold text-text-muted">
                          {mainSection.name}
                        </div>
                        {/* Check if all sections in this main section are completed */}
                        {(() => {
                          const allCompleted = mainSection.subjectParts.length > 0 && 
                            mainSection.subjectParts.every(section => sectionCompletionMap.get(section));
                          const someCompleted = mainSection.subjectParts.some(section => sectionCompletionMap.get(section));
                          
                          if (allCompleted) {
                            return (
                              <div className="flex items-center gap-1 text-[10px] text-green-400">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Complete</span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      {/* Show individual section completion indicators */}
                      {mainSection.subjectParts.length > 1 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {mainSection.subjectParts.map((section) => {
                            const isCompleted = sectionCompletionMap.get(section);
                            if (!isCompleted) return null;
                            return (
                              <div
                                key={section}
                                className="text-[9px] text-green-400/80 font-medium flex items-center gap-0.5"
                              >
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span>{section}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Right: Plus button for section */}
                    <button
                      onClick={() => handleAddSectionClick(mainSection.name, mainSection.subjectParts)}
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all",
                        "bg-surface-elevated hover:bg-surface text-text-muted hover:text-text"
                      )}
                      aria-label={`Add ${mainSection.name} to session`}
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  </div>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>

  );
}
