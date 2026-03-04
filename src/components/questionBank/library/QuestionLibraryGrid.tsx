/**
 * QuestionLibraryGrid - Row-based layout grouped by subject
 */

"use client";

import { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { ChevronDown, Check, CheckCircle2, BookOpen } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { MathContent } from "@/components/shared/MathContent";
import type { QuestionBankQuestion } from "@/types/questionBank";
import { useSupabaseSession } from "@/components/auth/SupabaseSessionProvider";

interface QuestionLibraryGridProps {
  questions: QuestionBankQuestion[];
  selectedQuestionIds: Set<string>;
  onToggleQuestion: (questionId: string) => void;
}

const subjectColors: Record<string, string> = {
  'Math 1': '#5da8f0',
  'Math 2': '#ff69b4', // Pink for Math 2
  'Physics': '#a78bfa',
  'Chemistry': '#ef7d7d',
  'Biology': '#85BC82',
};

const difficultyColors: Record<string, string> = {
  'Easy': '#85BC82',
  'Medium': '#b8a066',
  'Hard': '#ef7d7d',
};

function getSubjectFromQuestion(question: QuestionBankQuestion): string {
  // Use subjects field directly if available
  if (question.subjects) return question.subjects;
  
  // Fallback logic for backwards compatibility
  if (question.schema_id?.startsWith('P')) return 'Physics';
  if (question.schema_id?.startsWith('C')) return 'Chemistry';
  if (question.schema_id?.startsWith('B')) return 'Biology';
  if (question.schema_id?.startsWith('M')) return 'Math 1'; // Default to Math 1
  return 'Unknown';
}

export function QuestionLibraryGrid({
  questions,
  selectedQuestionIds,
  onToggleQuestion,
}: QuestionLibraryGridProps) {
  const session = useSupabaseSession();
  // Track expanded subjects - all collapsed by default (empty set means all collapsed)
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  // Track expanded primary tags - all collapsed by default (empty set means all collapsed)
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
  // Curriculum data for tag lookups
  const [curriculum, setCurriculum] = useState<any>(null);
  // Track which questions have been attempted
  const [attemptedQuestionIds, setAttemptedQuestionIds] = useState<Set<string>>(new Set());

  // Fetch curriculum data
  useEffect(() => {
    fetch('/api/question-bank/curriculum')
      .then(res => res.json())
      .then(data => setCurriculum(data))
      .catch(err => console.error('Error fetching curriculum:', err));
  }, []);

  // Memoize question IDs to prevent infinite loops
  const questionIds = useMemo(() => questions.map(q => q.id), [questions]);
  const questionIdsString = useMemo(() => questionIds.join(','), [questionIds]);

  // Fetch attempted question IDs if user is logged in
  useEffect(() => {
    if (session?.user && questionIds.length > 0) {
      // Fetch attempts for all questions at once
      fetch(`/api/question-bank/attempts?limit=1000`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.attempts) {
            // Get unique question IDs that have been attempted
            const attemptedIds = new Set<string>(
              data.attempts
                .filter((a: any) => questionIds.includes(a.question_id))
                .map((a: any) => String(a.question_id))
            );
            setAttemptedQuestionIds(attemptedIds);
          }
        })
        .catch(err => {
          console.error('[QuestionLibraryGrid] Error fetching attempts:', err);
        });
    }
  }, [session?.user, questionIdsString]); // Use stringified IDs to prevent re-runs

  // Helper to find topic title from tag code
  const getTopicTitle = (tagCode: string): string => {
    if (!tagCode) return tagCode;
    
    // First, check if tag has subject prefix format (e.g., "Chemistry - Oxidation, reduction and redox")
    // Remove subject prefix before the '-' if present
    const subjectPrefixes = ['Math 1', 'Math 2', 'Physics', 'Chemistry', 'Biology', 'Paper 1', 'Paper 2'];
    for (const prefix of subjectPrefixes) {
      const prefixPattern = new RegExp(`^${prefix}\\s*-\\s*`, 'i');
      if (prefixPattern.test(tagCode)) {
        // Remove the subject prefix and the dash
        return tagCode.replace(prefixPattern, '').trim();
      }
    }
    
    // If no subject prefix found, try curriculum lookup
    if (!curriculum) return tagCode;
    
    // 1. Identify the paper and clean the code
    let paperId = '';
    let cleanCode = '';
    
    if (tagCode.startsWith('M1-')) { 
      paperId = 'math1'; 
      cleanCode = tagCode.replace('M1-', ''); 
    } else if (tagCode.startsWith('M2-')) { 
      paperId = 'math2'; 
      cleanCode = tagCode.replace('M2-', ''); 
    } else if (tagCode.startsWith('P-')) { 
      paperId = 'physics'; 
      cleanCode = tagCode.replace('P-', ''); 
    } else if (tagCode.startsWith('biology-')) { 
      paperId = 'biology'; 
      cleanCode = tagCode.replace('biology-', ''); 
    } else if (tagCode.startsWith('chemistry-')) { 
      paperId = 'chemistry'; 
      cleanCode = tagCode.replace('chemistry-', ''); 
    }
    
    // If no prefix matched, try to find it in any paper
    if (!paperId) {
      // Search all papers for this code
      for (const paper of (curriculum.papers || [])) {
        const topic = paper.topics?.find((t: any) => 
          t.code === tagCode || 
          t.code === tagCode.replace(/^[A-Z]+/, '')
        );
        if (topic) return topic.title;
      }
      return tagCode;
    }
    
    // 2. Find the paper in curriculum
    const paper = curriculum.papers?.find((p: any) => p.paper_id === paperId);
    if (!paper) return tagCode;
    
    // 3. Match the topic by code
    // Try exact match first (e.g., cleanCode "M5" matches topic code "M5")
    let topic = paper.topics?.find((t: any) => t.code === cleanCode);
    
    // If not found, try removing letter prefix (e.g., cleanCode "M5" -> "5" matches topic code "5")
    if (!topic) {
      const numericCode = cleanCode.replace(/^[A-Z]+/, '');
      topic = paper.topics?.find((t: any) => t.code === numericCode);
    }
    
    // Final attempt: try matching with the original tag code
    if (!topic) {
      topic = paper.topics?.find((t: any) => t.code === tagCode);
    }
    
    // 4. Return the title if found, otherwise return the original code
    return topic?.title || tagCode;
  };

  const toggleSubject = (subject: string) => {
    setExpandedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subject)) {
        next.delete(subject); // Collapse
      } else {
        next.add(subject); // Expand
      }
      return next;
    });
  };

  const toggleTag = (tagKey: string) => {
    setExpandedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagKey)) {
        next.delete(tagKey); // Collapse
      } else {
        next.add(tagKey); // Expand
      }
      return next;
    });
  };

  const isSubjectExpanded = (subject: string) => expandedSubjects.has(subject);
  const isTagExpanded = (tagKey: string) => expandedTags.has(tagKey);

  // Group questions by subject, then by primary_tag
  const questionsBySubjectAndTag = useMemo(() => {
    const grouped: Record<string, Record<string, QuestionBankQuestion[]>> = {};

    questions.forEach((question) => {
      const subject = getSubjectFromQuestion(question);
      const primaryTag = question.primary_tag || 'Untagged';
      
      if (!grouped[subject]) {
        grouped[subject] = {};
      }
      if (!grouped[subject][primaryTag]) {
        grouped[subject][primaryTag] = [];
      }
      grouped[subject][primaryTag].push(question);
    });

    // Sort questions within each primary tag by generation_id or id
    Object.keys(grouped).forEach((subject) => {
      Object.keys(grouped[subject]).forEach((tag) => {
        grouped[subject][tag].sort((a, b) => {
          const aId = a.generation_id || a.id;
          const bId = b.generation_id || b.id;
          return aId.localeCompare(bId);
        });
      });
    });

    // Sort subjects: put Math 1 and Math 2 at the end, others alphabetically
    const sortedSubjects = Object.keys(grouped).sort((a, b) => {
      const isMath1 = a === 'Math 1';
      const isMath2 = a === 'Math 2';
      const isOtherMath1 = b === 'Math 1';
      const isOtherMath2 = b === 'Math 2';
      
      // Math 1 and Math 2 go to the end
      if (isMath1 || isMath2) {
        if (isOtherMath1 || isOtherMath2) {
          // Both are Math, sort Math 1 before Math 2
          if (isMath1 && isOtherMath2) return -1;
          if (isMath2 && isOtherMath1) return 1;
          return 0;
        }
        return 1; // Math goes after non-Math
      }
      if (isOtherMath1 || isOtherMath2) {
        return -1; // Non-Math goes before Math
      }
      // Both are non-Math, sort alphabetically
      return a.localeCompare(b);
    });

    return { grouped, sortedSubjects };
  }, [questions]);

  return (
    <Card variant="flat" className="p-5 h-full bg-transparent">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-mono font-semibold uppercase tracking-wider text-white/70">
            Question Library
          </h2>
          <p className="text-sm font-mono text-white/50 mt-1">
            Browse questions and add them to your practice session.
          </p>
        </div>
        <div className="text-xs text-white/50">
          {questions.length} result{questions.length === 1 ? "" : "s"}
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="h-[220px] min-h-[220px] flex flex-col items-center justify-center gap-4 py-12">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-surface-elevated mb-2">
            <BookOpen className="w-8 h-8 text-text-muted" strokeWidth={1.5} />
          </div>
          <div className="text-center space-y-1.5">
            <div className="text-base font-mono font-semibold text-text-muted">
              No questions found
            </div>
            <div className="text-sm font-mono text-text-subtle max-w-xs">
              Try adjusting your filters to find questions
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {questionsBySubjectAndTag.sortedSubjects.map((subject) => {
            const subjectTags = questionsBySubjectAndTag.grouped[subject];
            if (!subjectTags || Object.keys(subjectTags).length === 0) return null;

            const subjectColor = subjectColors[subject] || '#ffffff';
            const isSubjectExpandedState = isSubjectExpanded(subject);
            const totalSubjectQuestions = Object.values(subjectTags).reduce((sum, questions) => sum + questions.length, 0);

            return (
              <div
                key={subject}
                className="rounded-xl overflow-hidden transition-all duration-300"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.02)",
                }}
              >
                {/* Color-coded subject header */}
                <button
                  onClick={() => toggleSubject(subject)}
                  className="w-full px-6 py-7 flex items-center justify-between bg-white/[0.04] hover:bg-white/[0.06] transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 transition-transform duration-300",
                        isSubjectExpandedState ? "rotate-0" : "-rotate-90"
                      )}
                      style={{ color: subjectColor }}
                      strokeWidth={3}
                    />
                    <h3 className="text-base font-mono font-bold uppercase tracking-wider" style={{ color: subjectColor }}>
                      {subject} Questions
                    </h3>
                  </div>
                  <div className="text-xs opacity-40 font-mono tracking-tight group-hover:opacity-60 transition-opacity">
                    {totalSubjectQuestions} question{totalSubjectQuestions === 1 ? "" : "s"}
                  </div>
                </button>

                {/* Primary tags for this subject */}
                <AnimatePresence initial={false}>
                  {isSubjectExpandedState && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 space-y-3">
                        {Object.keys(subjectTags).sort().map((primaryTag) => {
                          const tagQuestions = subjectTags[primaryTag];
                          if (!tagQuestions || tagQuestions.length === 0) return null;

                          const tagKey = `${subject}-${primaryTag}`;
                          const isTagExpandedState = isTagExpanded(tagKey);

                          return (
                            <div
                              key={tagKey}
                              className="rounded-lg overflow-hidden"
                              style={{
                                backgroundColor: "rgba(255, 255, 255, 0.015)",
                              }}
                            >
                              {/* Primary tag header */}
                              <button
                                onClick={() => toggleTag(tagKey)}
                                className="w-full px-4 py-3 flex items-center justify-between bg-white/[0.03] hover:bg-white/[0.05] transition-colors group"
                              >
                                <div className="flex items-center gap-2">
                                  <ChevronDown
                                    className={cn(
                                      "w-3.5 h-3.5 transition-transform duration-300",
                                      isTagExpandedState ? "rotate-0" : "-rotate-90"
                                    )}
                                    style={{ color: subjectColor }}
                                    strokeWidth={2.5}
                                  />
                                  <span className="text-sm font-mono font-medium text-white/80">
                                    {getTopicTitle(primaryTag)}
                                  </span>
                                </div>
                                <div className="text-xs opacity-40 font-mono tracking-tight group-hover:opacity-60 transition-opacity">
                                  {tagQuestions.length} question{tagQuestions.length === 1 ? "" : "s"}
                                </div>
                              </button>

                              {/* Questions for this primary tag */}
                              <AnimatePresence initial={false}>
                                {isTagExpandedState && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                                    className="overflow-hidden"
                                  >
                                    <div className="p-3 space-y-2">
                                      {tagQuestions.map((question, index) => {
                                        const isSelected = selectedQuestionIds.has(question.id);
                                        const questionNumber = index + 1;
                                        const hasBeenAttempted = attemptedQuestionIds.has(question.id);

                                        return (
                                          <div
                                            key={question.id}
                                            className={cn(
                                              "flex items-start gap-3 p-3 rounded-lg transition-all cursor-pointer",
                                              isSelected
                                                ? "bg-white/[0.08] border border-white/20"
                                                : "bg-white/[0.03] hover:bg-white/[0.05] border border-transparent"
                                            )}
                                            onClick={() => onToggleQuestion(question.id)}
                                          >
                                            {/* Selection checkbox */}
                                            <div
                                              className={cn(
                                                "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all",
                                                isSelected
                                                  ? "bg-white/20 border-white/40"
                                                  : "bg-white/5 border-white/20"
                                              )}
                                            >
                                              {isSelected && (
                                                <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                              )}
                                            </div>

                                            {/* Question content */}
                                            <div className="flex-1 min-w-0 space-y-2">
                                              {/* Header: Question Number, Difficulty, Attempted Badge */}
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-mono font-semibold text-white/90">
                                                  Question {questionNumber}
                                                </span>
                                                {hasBeenAttempted && (
                                                  <span title="You have attempted this question">
                                                    <CheckCircle2 
                                                      className="w-3.5 h-3.5 text-green-400" 
                                                      strokeWidth={2.5}
                                                    />
                                                  </span>
                                                )}
                                                <span
                                                  className="text-[10px] px-2 py-0.5 rounded uppercase font-mono tracking-wider"
                                                  style={{
                                                    backgroundColor: `${difficultyColors[question.difficulty]}20`,
                                                    color: difficultyColors[question.difficulty],
                                                  }}
                                                >
                                                  {question.difficulty}
                                                </span>
                                              </div>

                                              {/* Question stem preview */}
                                              <div className="text-sm text-white/70 line-clamp-2">
                                                <MathContent
                                                  content={question.question_stem}
                                                  className="text-inherit"
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

