/**
 * Question Bank Page - Bank
 * Practice questions with countdown timer for sessions
 */

"use client";

import { useState, useEffect, Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { QuestionCard } from "@/components/questionBank/QuestionCard";
import { FilterPopup } from "@/components/questionBank/FilterPopup";
import { EditModal } from "@/components/questionBank/EditModal";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { MathContent } from "@/components/shared/MathContent";
import { SolutionModal } from "@/components/questionBank/SolutionModal";
import { useQuestionBank } from "@/hooks/useQuestionBank";
import { useQuestionEditor } from "@/hooks/useQuestionEditor";
import { useSubscription } from "@/hooks/useSubscription";
import { useSupabaseSession } from "@/components/auth/SupabaseSessionProvider";
import { UpgradeCTA } from "@/components/subscription/UpgradeCTA";
import { ArrowRight, RotateCw, BookOpen, X, Settings, Pencil, Eye, AlertCircle, Filter, Lightbulb, Check } from "lucide-react";
import type { QuestionBankQuestion, SubjectFilter } from "@/types/questionBank";
import { cn, formatTime } from "@/lib/utils";

const FREE_QUESTION_LIMIT = 10;
const STORAGE_KEY = "qb_free_attempts";

function getFreeAttemptsKey(userId: string | undefined): string {
  return userId ? `${STORAGE_KEY}_${userId}` : STORAGE_KEY;
}

export default function QuestionBankPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useSupabaseSession();
  const isSessionMode = searchParams.get('session') === 'true';
  const { hasFullAccess } = useSubscription();
  const [freeAttemptsUsed, setFreeAttemptsUsed] = useState(() => {
    if (typeof window === "undefined") return 0;
    const key = getFreeAttemptsKey(session?.user?.id);
    const stored = localStorage.getItem(key);
    return stored ? parseInt(stored, 10) : 0;
  });

  const isFreeLimitReached = !hasFullAccess && freeAttemptsUsed >= FREE_QUESTION_LIMIT;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = getFreeAttemptsKey(session?.user?.id);
    const stored = localStorage.getItem(key);
    setFreeAttemptsUsed(stored ? parseInt(stored, 10) : 0);
  }, [session?.user?.id]);

  const incrementFreeAttempts = () => {
    if (!hasFullAccess) {
      const next = freeAttemptsUsed + 1;
      setFreeAttemptsUsed(next);
      const key = getFreeAttemptsKey(session?.user?.id);
      localStorage.setItem(key, String(next));
    }
  };

  const {
    currentQuestion,
    isLoading,
    error,
    filters,
    isAnswered,
    selectedAnswer,
    isCorrect,
    questionCount,
    hasBeenAttempted,
    setFilters,
    submitAnswer,
    nextQuestion,
    viewSolution,
    updateCurrentQuestion,
  } = useQuestionBank();

  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [curriculum, setCurriculum] = useState<any>(null);
  const [sessionMode, setSessionMode] = useState(false);
  const [sessionQuestions, setSessionQuestions] = useState<QuestionBankQuestion[]>([]);
  const [sessionCurrentIndex, setSessionCurrentIndex] = useState(0);
  
  // Timer states - countdown for sessions, count-up for regular practice
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(0);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [showDetailedExplanation, setShowDetailedExplanation] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [currentSelection, setCurrentSelection] = useState<string | null>(null);
  const [incorrectAnswers, setIncorrectAnswers] = useState<Set<string>>(new Set());
  
  // Progress tracking state - synced with active filters for accurate "X out of Y" counts
  const [progressSubjects, setProgressSubjects] = useState<SubjectFilter[]>(['Math 1']);
  const [showProgressFilter, setShowProgressFilter] = useState(false);
  
  const [progressStats, setProgressStats] = useState<{ attempted: number; total: number } | null>(null);
  
  // Load session data from sessionStorage if in session mode
  useEffect(() => {
    if (isSessionMode) {
      try {
        const sessionDataStr = sessionStorage.getItem('questionBankSession');
        if (sessionDataStr) {
          const sessionData = JSON.parse(sessionDataStr);
          setSessionQuestions(sessionData.questions || []);
          setSessionCurrentIndex(0);
          setSessionMode(true);
          setTimeLimitMinutes(sessionData.timeLimitMinutes || Math.ceil((sessionData.questions?.length || 0) * 1.5));
          
          // Initialize countdown timer
          const startTime = Date.now();
          const timeLimitMs = (sessionData.timeLimitMinutes || Math.ceil((sessionData.questions?.length || 0) * 1.5)) * 60 * 1000;
          setDeadline(startTime + timeLimitMs);
          setTimerStartTime(startTime);
          
          // Load first question
          if (sessionData.questions && sessionData.questions.length > 0) {
            updateCurrentQuestion(sessionData.questions[0]);
          }
          
          // Clear sessionStorage after loading
          sessionStorage.removeItem('questionBankSession');
        }
      } catch (err) {
        console.error('[Bank] Error loading session:', err);
      }
    }
  }, [isSessionMode, updateCurrentQuestion]);

  // Sync progressSubjects with active filters so "X out of Y" matches the question pool
  useEffect(() => {
    const subj = filters.subject;
    let subjects: SubjectFilter[];
    if (Array.isArray(subj) && subj.length > 0) {
      subjects = subj;
    } else if (subj && subj !== 'All') {
      subjects = Array.isArray(subj) ? subj : [subj];
    } else {
      subjects = filters.testType === 'TMUA'
        ? ['Paper 1', 'Paper 2']
        : filters.testType === 'ESAT'
          ? ['Math 1', 'Math 2', 'Physics', 'Chemistry', 'Biology']
          : ['Math 1', 'Math 2', 'Physics', 'Chemistry', 'Biology', 'Paper 1', 'Paper 2'];
    }
    setProgressSubjects(subjects);
  }, [filters.subject, filters.testType]);

  // Fetch progress stats (debounced on isAnswered to avoid rapid refetches)
  useEffect(() => {
    if (progressSubjects.length === 0) {
      setProgressStats(null);
      return;
    }

    const params = new URLSearchParams();
    params.append('subjects', progressSubjects.join(','));
    if (filters.testType && filters.testType !== 'All') {
      params.append('testType', filters.testType);
    }

    const fetchProgressStats = async () => {
      try {
        const response = await fetch(`/api/question-bank/progress?${params.toString()}`);
        
        if (response.ok) {
          const data = await response.json();
          setProgressStats({
            attempted: data.attempted || 0,
            total: data.total || 0
          });
        } else {
          const totalParams = new URLSearchParams();
          totalParams.append('subject', progressSubjects.join(','));
          totalParams.append('limit', '1');
          if (filters.testType && filters.testType !== 'All') {
            totalParams.append('testType', filters.testType);
          }
          const totalRes = await fetch(`/api/question-bank/questions?${totalParams.toString()}`);
          if (totalRes.ok) {
            const totalData = await totalRes.json();
            setProgressStats({
              attempted: 0,
              total: totalData.totalCount ?? totalData.count ?? 0
            });
          }
        }
      } catch (error) {
        console.error('[Progress] Error fetching stats:', error);
      }
    };

    // Debounce 300ms to avoid rapid refetches when user answers multiple questions quickly
    const timeoutId = setTimeout(fetchProgressStats, 300);
    return () => clearTimeout(timeoutId);
  }, [progressSubjects, isAnswered, filters.testType]);

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editModalTitle, setEditModalTitle] = useState("");
  const [editModalContent, setEditModalContent] = useState("");
  const [editModalField, setEditModalField] = useState<string>("");
  const [editModalOptionLetter, setEditModalOptionLetter] = useState<string | null>(null);
  
  const { updateQuestion, updateQuestionField } = useQuestionEditor();

  // Fetch curriculum data for tag lookups
  useEffect(() => {
    fetch('/api/question-bank/curriculum')
      .then(res => res.json())
      .then(data => setCurriculum(data))
      .catch(err => console.error('Error fetching curriculum:', err));
  }, []);

  // Reset answer revealed state when question changes
  useEffect(() => {
    setAnswerRevealed(false);
    setShowDetailedExplanation(false);
    setCurrentSelection(null);
    setIncorrectAnswers(new Set());
  }, [currentQuestion?.id]);

  // Timer effect - countdown for sessions, count-up for regular practice
  useEffect(() => {
    if (sessionMode && deadline) {
      // Countdown timer for session mode
      const interval = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
        setRemainingTime(remaining);
        
        if (remaining <= 0) {
          // Time's up - auto-submit or end session
          clearInterval(interval);
          // Could show a modal or auto-submit here
        }
      }, 1000);
      
      return () => clearInterval(interval);
    } else if (!sessionMode && timerStartTime !== null) {
      // Count-up timer for regular practice mode
      if (isCorrect === true) {
        return;
      }

      const interval = setInterval(() => {
        setElapsedTime(Date.now() - timerStartTime);
      }, 100); // Update every 100ms for smooth display

      return () => clearInterval(interval);
    }
  }, [sessionMode, deadline, timerStartTime, isCorrect]);

  // Timer effect - start from 0:00 when new question loads (for count-up mode)
  useEffect(() => {
    if (!sessionMode && currentQuestion) {
      // Reset timer to 0:00 and start it
      setElapsedTime(0);
      const newStartTime = Date.now();
      setTimerStartTime(newStartTime);
    }
  }, [currentQuestion?.id, sessionMode]);

  // Reset timer function (for count-up mode)
  const resetTimer = () => {
    if (!sessionMode) {
      const newStartTime = Date.now();
      setTimerStartTime(newStartTime);
      setElapsedTime(0);
    }
  };

  // Get remaining time in seconds for countdown
  const getRemainingTime = (): number => {
    if (!deadline) return 0;
    return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  };

  // Format time for display
  const formatTimerDisplay = (): string => {
    if (sessionMode && remainingTime !== null) {
      // Countdown format: MM:SS
      const minutes = Math.floor(remainingTime / 60);
      const seconds = remainingTime % 60;
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } else {
      // Count-up format
      return formatTime(elapsedTime);
    }
  };

  // Get timer color based on remaining time
  const getTimerColor = (): string => {
    if (sessionMode && remainingTime !== null && deadline) {
      const totalSeconds = timeLimitMinutes * 60;
      const percentage = remainingTime / totalSeconds;
      
      if (percentage <= 0.1) return 'text-red-400';
      if (percentage <= 0.5) return 'text-yellow-400';
      return 'text-white/90';
    }
    return 'text-white/90';
  };

  // Edit handlers
  const handleEditQuestionStem = () => {
    if (!currentQuestion) return;
    setEditModalTitle("Edit Question");
    setEditModalContent(currentQuestion.question_stem);
    setEditModalField("question_stem");
    setEditModalOptionLetter(null);
    setEditModalOpen(true);
  };

  const handleEditOption = (optionLetter: string) => {
    if (!currentQuestion) return;
    setEditModalTitle(`Edit Option ${optionLetter}`);
    setEditModalContent(currentQuestion.options[optionLetter]);
    setEditModalField("options");
    setEditModalOptionLetter(optionLetter);
    setEditModalOpen(true);
  };

  const handleEditKeyInsight = () => {
    if (!currentQuestion) return;
    setEditModalTitle("Edit Key Insight");
    setEditModalContent(currentQuestion.solution_key_insight || "");
    setEditModalField("solution_key_insight");
    setEditModalOptionLetter(null);
    setEditModalOpen(true);
  };

  const handleEditReasoning = () => {
    if (!currentQuestion) return;
    setEditModalTitle("Edit Solution");
    setEditModalContent(currentQuestion.solution_reasoning || "");
    setEditModalField("solution_reasoning");
    setEditModalOptionLetter(null);
    setEditModalOpen(true);
  };

  const handleEditDistractor = (optionLetter: string) => {
    if (!currentQuestion || !currentQuestion.distractor_map) return;
    setEditModalTitle(`Edit Distractor Analysis for Option ${optionLetter}`);
    setEditModalContent(currentQuestion.distractor_map[optionLetter] || "");
    setEditModalField("distractor_map");
    setEditModalOptionLetter(optionLetter);
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (newContent: string) => {
    if (!currentQuestion) return;

    try {
      let updatedQuestion: QuestionBankQuestion | null;
      
      if (editModalField === "options" && editModalOptionLetter) {
        // Update a specific option
        const updatedOptions = { ...currentQuestion.options, [editModalOptionLetter]: newContent };
        updatedQuestion = await updateQuestion(currentQuestion.id, "options", updatedOptions);
        console.log('[Questions Page] Updated options:', updatedQuestion);
      } else if (editModalField === "distractor_map" && editModalOptionLetter) {
        // Update a specific distractor
        const updatedDistractors = { ...currentQuestion.distractor_map, [editModalOptionLetter]: newContent };
        updatedQuestion = await updateQuestion(currentQuestion.id, "distractor_map", updatedDistractors);
        console.log('[Questions Page] Updated distractor:', updatedQuestion);
      } else {
        // Update a regular field
        updatedQuestion = await updateQuestion(currentQuestion.id, editModalField as any, newContent);
        console.log('[Questions Page] Updated field:', editModalField, updatedQuestion);
      }
      
      // Update the current question state with the updated data
      if (updatedQuestion) {
        updateCurrentQuestion(updatedQuestion);
      }
    } catch (error) {
      console.error('[Questions Page] Failed to save edit:', error);
      throw error; // Re-throw so EditModal can show the error
    }
  };

  // Helper to find topic title from code
  const getTopicTitle = (tagCode: string) => {
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
    
    // If no prefix matched, we'll try to find it in any paper
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
    
    return topic ? topic.title : tagCode;
  };

  // Helper to get active filters as display items
  const getActiveFilters = () => {
    const activeFilters: Array<{ label: string; value: string; type: string; onRemove: () => void }> = [];
    
    // Handle subject (can be array or single value)
    const subjects = Array.isArray(filters.subject) ? filters.subject : (filters.subject !== 'All' ? [filters.subject] : []);
    subjects.forEach((subject) => {
      activeFilters.push({
        label: subject,
        value: subject,
        type: 'subject',
        onRemove: () => {
          const newSubjects = subjects.filter(s => s !== subject);
          setFilters({ ...filters, subject: newSubjects.length > 0 ? newSubjects : 'All' });
        },
      });
    });
    
    // Handle difficulty (can be array or single value)
    const difficulties = Array.isArray(filters.difficulty) ? filters.difficulty : (filters.difficulty !== 'All' ? [filters.difficulty] : []);
    difficulties.forEach((difficulty) => {
      activeFilters.push({
        label: difficulty,
        value: difficulty,
        type: 'difficulty',
        onRemove: () => {
          const newDifficulties = difficulties.filter(d => d !== difficulty);
          setFilters({ ...filters, difficulty: newDifficulties.length > 0 ? newDifficulties : 'All' });
        },
      });
    });
    
    if (filters.attemptedStatus !== 'Mix') {
      activeFilters.push({
        label: filters.attemptedStatus,
        value: filters.attemptedStatus,
        type: 'attemptedStatus',
        onRemove: () => setFilters({ ...filters, attemptedStatus: 'Mix' }),
      });
    }
    
    // Handle attempt result (can be array or single value)
    const attemptResults = Array.isArray(filters.attemptResult) ? filters.attemptResult : (filters.attemptResult ? [filters.attemptResult] : []);
    attemptResults.forEach((result) => {
      activeFilters.push({
        label: result,
        value: result,
        type: 'attemptResult',
        onRemove: () => {
          const newResults = attemptResults.filter(r => r !== result);
          setFilters({ ...filters, attemptResult: newResults.length > 0 ? newResults : [] });
        },
      });
    });
    
    if (filters.searchTag) {
      activeFilters.push({
        label: filters.searchTag,
        value: filters.searchTag,
        type: 'topic',
        onRemove: () => setFilters({ ...filters, searchTag: '' }),
      });
    }
    
    return activeFilters;
  };

  // Get filter color based on type
  const getFilterColor = (type: string, value: string) => {
    if (type === 'subject') {
      const subjectColors: Record<string, string> = {
        'Math 1': 'bg-[#406166]/20 text-[#5da8f0]',
        'Math 2': 'bg-[#406166]/20 text-[#5da8f0]',
        'Physics': 'bg-[#2f2835]/30 text-[#a78bfa]',
        'Chemistry': 'bg-[#854952]/20 text-[#ef7d7d]',
        'Biology': 'bg-[#506141]/20 text-[#85BC82]',
        'Paper 1': 'bg-[#406166]/20 text-[#5da8f0]',
        'Paper 2': 'bg-[#2f2835]/30 text-[#a78bfa]',
      };
      return subjectColors[value] || 'bg-white/10 text-white/70';
    }
    if (type === 'difficulty') {
      if (value === 'Easy') return 'bg-[#506141]/20 text-[#85BC82]';
      if (value === 'Medium') return 'bg-[#967139]/20 text-[#b8a066]';
      if (value === 'Hard') return 'bg-[#854952]/20 text-[#ef7d7d]';
      return 'bg-white/10 text-white/70';
    }
    if (type === 'attemptedStatus') {
      if (value === 'New' || value === 'Attempted') return 'bg-white/20 text-white/70';
      if (value === 'Mix') return 'bg-white/10 text-white/60';
      return 'bg-white/10 text-white/70';
    }
    if (type === 'attemptResult') {
      return 'bg-white/20 text-white/70';
    }
    if (type === 'topic') {
      return 'bg-white/10 text-white/70';
    }
    return 'bg-white/10 text-white/70';
  };

  const handleStartSession = async (config: { count: number; topics: string[]; difficulties: string[] }) => {
    // Build query params for session
    const params = new URLSearchParams();
    // Handle subject (can be array or single value)
    const subjects = Array.isArray(filters.subject) ? filters.subject : (filters.subject !== 'All' ? [filters.subject] : []);
    if (subjects.length > 0) {
      // For multiple subjects, we'll need to fetch separately or use OR logic
      // For now, use the first subject or fetch all and filter client-side
      if (subjects.length === 1) {
        params.append('subject', subjects[0]);
      }
    }
    if (config.difficulties.length > 0) {
      // If multiple difficulties, we need to fetch them separately or use a different approach
      // For now, if multiple are selected, we'll fetch all and filter client-side
      if (config.difficulties.length === 1) {
        params.append('difficulty', config.difficulties[0]);
      }
    }
    if (config.topics.length > 0) {
      params.append('tags', config.topics.join(','));
    }
    // Fetch more questions than needed to account for filtering
    params.append('limit', (config.count * 2).toString());
    params.append('random', 'true');

    try {
      const response = await fetch(`/api/question-bank/questions?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch session questions');
      
      const data = await response.json();
      if (data.questions && data.questions.length > 0) {
        // Filter by difficulties if multiple were selected
        let filteredQuestions = data.questions;
        if (config.difficulties.length > 1) {
          filteredQuestions = data.questions.filter((q: QuestionBankQuestion) => 
            config.difficulties.includes(q.difficulty)
          );
        }
        
        // Take only the requested count
        const sessionQs = filteredQuestions.slice(0, config.count);
        
        if (sessionQs.length > 0) {
          setSessionQuestions(sessionQs);
          setSessionCurrentIndex(0);
          setSessionMode(true);
          // Update current question to first session question
          updateCurrentQuestion(sessionQs[0]);
        } else {
          alert('No questions found matching your criteria. Please try different filters.');
        }
      } else {
        alert('No questions found matching your criteria. Please try different filters.');
      }
    } catch (err) {
      console.error('Failed to start session:', err);
      alert('Failed to start session. Please try again.');
    }
  };

  // Handle next question in session mode
  const handleNextQuestionInSession = async () => {
    if (isFreeLimitReached) return;
    if (sessionMode && sessionQuestions.length > 0) {
      const nextIndex = sessionCurrentIndex + 1;
      if (nextIndex < sessionQuestions.length) {
        setSessionCurrentIndex(nextIndex);
        updateCurrentQuestion(sessionQuestions[nextIndex]);
      } else {
        incrementFreeAttempts();
        setSessionMode(false);
        setSessionQuestions([]);
        setSessionCurrentIndex(0);
        setDeadline(null);
        setRemainingTime(null);
        await nextQuestion();
      }
    } else {
      incrementFreeAttempts();
      await nextQuestion();
    }
  };

  return (
    <Fragment>
      <div className="min-h-[calc(100vh-3.5rem)] py-8 pb-24">
      <Container size="lg">
        <div className="space-y-6">
          {isFreeLimitReached && (
            <UpgradeCTA feature="unlimited questions" />
          )}
          {/* Session Progress Indicator */}
          {sessionMode && sessionQuestions.length > 0 && (
            <div className="bg-primary/10 rounded-organic-md p-4 border border-primary/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-primary">Session Mode</span>
                <span className="text-xs text-white/60">
                  Question {sessionCurrentIndex + 1} of {sessionQuestions.length}
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300 ease-signature"
                  style={{ width: `${((sessionCurrentIndex + 1) / sessionQuestions.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Active Filters and Timer Row */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Active Filters Container */}
            <div className="flex items-center justify-between gap-4 flex-wrap px-6 py-4 rounded-organic-md bg-white/[0.02] flex-1 min-h-[56px]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-white/50 font-mono">Active Filters:</span>
                  {(() => {
                    const activeFilters = getActiveFilters();
                    if (activeFilters.length === 0) {
                      return <span className="text-xs text-white/40 font-mono">No filters active</span>;
                    }
                    
                    // Group filters by type
                    const groupedFilters: Record<string, typeof activeFilters> = {};
                    activeFilters.forEach(filter => {
                      if (!groupedFilters[filter.type]) {
                        groupedFilters[filter.type] = [];
                      }
                      groupedFilters[filter.type].push(filter);
                    });
                    
                    // Display groups with "/" within groups, spacing between groups
                    return (
                      <div className="flex items-center gap-3 flex-wrap">
                        {Object.entries(groupedFilters).map(([type, filters], groupIndex) => (
                          <div key={type} className="flex items-center">
                            {filters.map((filter, index) => (
                              <span key={`${filter.type}-${filter.value}`} className="flex items-center">
                                <button
                                  onClick={filter.onRemove}
                                  className={cn(
                                    "group relative px-3 py-1.5 rounded-organic-md text-xs font-mono transition-all duration-fast ease-signature cursor-pointer",
                                    "hover:line-through",
                                    getFilterColor(filter.type, filter.value)
                                  )}
                                  aria-label={`Remove ${filter.label} filter`}
                                >
                                  <span>{filter.label}</span>
                                </button>
                                {index < filters.length - 1 && (
                                  <span className="text-white/40 px-2">/</span>
                                )}
                              </span>
                            ))}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
              </div>
              
              {/* Filter button - top right */}
              <button
                onClick={() => setShowFilterPopup(true)}
                className="p-2.5 bg-white/10 hover:bg-white/15 rounded-organic-md text-white/70 hover:text-white/90 transition-all duration-fast ease-signature flex items-center justify-center"
                title="Filters & Settings"
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
            
            {/* Timer Container */}
            {(sessionMode ? remainingTime !== null : elapsedTime !== undefined) && (
              <div className="flex items-center gap-4 px-6 py-4 rounded-organic-md bg-white/[0.02] min-h-[56px]">
                {!sessionMode && (
                  <button
                    onClick={resetTimer}
                    className="p-2.5 bg-white/10 hover:bg-white/15 rounded-organic-md text-white/70 hover:text-white/90 transition-all duration-fast ease-signature flex items-center justify-center"
                    title="Reset timer"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                )}
                <div 
                  className={cn(
                    "text-xl font-bold tabular-nums tracking-tight select-none",
                    getTimerColor()
                  )}
                  style={{ fontFamily: "'Times New Roman', Times, serif" }}
                >
                  {formatTimerDisplay()}
                </div>
              </div>
            )}
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <LoadingSpinner size="lg" />
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="bg-interview/10 rounded-organic-lg p-6 text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <AlertCircle className="w-5 h-5 text-interview" />
                <p className="text-interview font-mono text-sm">{error}</p>
              </div>
              <Button onClick={nextQuestion} variant="secondary">
                <RotateCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          )}

          {/* Question Display */}
          {currentQuestion && !isLoading && (
            <div className="space-y-6">
              <QuestionCard
                question={currentQuestion}
                onAnswerSubmit={submitAnswer}
                isAnswered={isAnswered}
                selectedAnswer={selectedAnswer}
                correctAnswer={currentQuestion.correct_option}
                isCorrect={isCorrect}
                onEditQuestionStem={handleEditQuestionStem}
                onEditOption={handleEditOption}
                answerRevealed={answerRevealed}
                onRevealAnswer={() => setAnswerRevealed(true)}
                allowRetry={isAnswered && !isCorrect && !answerRevealed}
                getTopicTitle={getTopicTitle}
                onSelectionChange={setCurrentSelection}
                onIncorrectAnswersChange={setIncorrectAnswers}
              />

              {/* Detailed Explanation Modal */}
              {currentQuestion && (
                <Fragment>
                  <SolutionModal
                    isOpen={showDetailedExplanation}
                    onClose={() => setShowDetailedExplanation(false)}
                    solution_reasoning={currentQuestion.solution_reasoning}
                    solution_key_insight={currentQuestion.solution_key_insight}
                    distractor_map={currentQuestion.distractor_map}
                    correct_option={currentQuestion.correct_option}
                    options={currentQuestion.options}
                    isCorrect={isCorrect ?? false}
                    selectedAnswer={selectedAnswer}
                    onEditKeyInsight={handleEditKeyInsight}
                    onEditReasoning={handleEditReasoning}
                    onEditDistractor={handleEditDistractor}
                    graphSpecs={currentQuestion.graph_specs}
                  />
                  
                  {/* Hint Modal */}
                  {showHint && currentQuestion.solution_key_insight && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowHint(false)}>
                      <div className="bg-white/[0.08] rounded-organic-lg p-6 max-w-2xl w-full border border-white/10" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-organic-md bg-primary/20 flex items-center justify-center">
                              <Lightbulb className="w-5 h-5 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold text-white/90">Hint</h3>
                          </div>
                          <button
                            onClick={() => setShowHint(false)}
                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
                          >
                            <X className="w-4 h-4 text-white/60" />
                          </button>
                        </div>
                        <div className="text-white/90 leading-relaxed" style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '1.125rem' }}>
                          <MathContent content={currentQuestion.solution_key_insight} className="text-inherit" />
                        </div>
                      </div>
                    </div>
                  )}
                </Fragment>
              )}

              {/* Edit Modal */}
              <EditModal
                isOpen={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                title={editModalTitle}
                content={editModalContent}
                onSave={handleSaveEdit}
              />

            </div>
          )}

          {/* Filter Popup */}
          <FilterPopup
            isOpen={showFilterPopup}
            onClose={() => setShowFilterPopup(false)}
            filters={filters}
            onFilterChange={setFilters}
            onStartSession={handleStartSession}
          />
        </div>
      </Container>
      
      {/* Fixed Bottom Action Bar */}
      {currentQuestion && !isLoading && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-white/10">
          {/* Progress Bar */}
          <div className="w-full h-1.5 bg-white/[0.03] relative overflow-hidden">
            <div 
              className="h-full bg-interview/40 transition-all duration-300 ease-signature"
              style={{ 
                width: progressStats && progressStats.total > 0 
                  ? `${(progressStats.attempted / progressStats.total) * 100}%` 
                  : '0%' 
              }}
            />
          </div>
          <Container size="lg">
            <div className="flex items-center justify-center gap-3 py-4 relative">
              {/* Left: Progress Indicator - positioned absolutely */}
              {progressStats && (
                <div className="absolute left-0 flex items-center gap-2">
                  <span className="text-xs text-white/60 font-mono">
                    <span className="font-medium text-base">{progressStats.attempted}</span> out of <span className="font-medium text-base">{progressStats.total}</span> questions done
                    {progressSubjects.length === 1 && (
                      <Fragment>
                        {" "}
                        <button
                          onClick={() => setShowProgressFilter(!showProgressFilter)}
                          className="text-white/40 hover:text-white font-normal transition-colors duration-fast ease-signature cursor-pointer"
                        >
                          for {progressSubjects[0]}
                        </button>
                      </Fragment>
                    )}
                    {progressSubjects.length > 1 && (
                      <Fragment>
                        {" "}
                        <button
                          onClick={() => setShowProgressFilter(!showProgressFilter)}
                          className="text-white/40 hover:text-white font-normal transition-colors duration-fast ease-signature cursor-pointer"
                        >
                          for {progressSubjects.length} subjects
                        </button>
                      </Fragment>
                    )}
                  </span>
                </div>
              )}

              {/* Center: Action Buttons */}
              <div className="flex items-center justify-center gap-3">
                {/* Hint Button - always shown if hint exists */}
                {currentQuestion.solution_key_insight && (
                  <button
                    onClick={() => setShowHint(true)}
                    className="px-4 py-2.5 rounded-organic-md bg-white/5 hover:bg-white/10 text-white/70 hover:text-white/90 transition-all duration-fast ease-signature flex items-center gap-2 font-mono text-sm border border-white/10"
                  >
                    <Lightbulb className="w-4 h-4" />
                    <span>Hint</span>
                  </button>
                )}
                
                {/* Submit Answer OR Next Question (replaces Submit Answer) */}
              {answerRevealed || (isAnswered && isCorrect) ? (
                // Next Question Button - shown after answer is revealed or correct
                <button
                  onClick={handleNextQuestionInSession}
                  disabled={isFreeLimitReached}
                  className="px-6 py-3 rounded-organic-md bg-interview/40 hover:bg-interview/50 text-interview transition-all duration-fast ease-signature flex items-center gap-2 font-mono text-sm font-medium"
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
                  <span>
                    {isFreeLimitReached
                      ? "Upgrade to continue"
                      : sessionMode && sessionCurrentIndex < sessionQuestions.length - 1
                      ? `Next (${sessionCurrentIndex + 1}/${sessionQuestions.length})`
                      : sessionMode
                      ? "Finish Session"
                      : "Next Question"}
                  </span>
                  <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                </button>
              ) : (
                // Submit Answer Button - shown when not answered correctly and not revealed
                <button
                  onClick={() => {
                    if (currentSelection && !incorrectAnswers.has(currentSelection)) {
                      const correct = currentSelection === currentQuestion.correct_option;
                      const wrongAnswersArray = Array.from(incorrectAnswers);
                      const timeUntilCorrect = correct ? (sessionMode ? (deadline ? Math.max(0, deadline - Date.now()) : null) : elapsedTime) : null;
                      submitAnswer(currentSelection, correct, {
                        wasRevealed: answerRevealed,
                        usedHint: showHint,
                        wrongAnswersBefore: wrongAnswersArray,
                        timeUntilCorrectMs: timeUntilCorrect,
                      });
                    }
                  }}
                  disabled={!currentSelection || incorrectAnswers.has(currentSelection)}
                  className={cn(
                    "px-6 py-3 rounded-organic-md transition-all duration-fast ease-signature flex items-center gap-2 font-mono text-sm font-medium border",
                    currentSelection && !incorrectAnswers.has(currentSelection)
                      ? "bg-white/5 hover:bg-white/10 text-white/70 hover:text-white/90 border-white/10 cursor-pointer"
                      : "bg-white/5 text-white/40 cursor-not-allowed border-white/10"
                  )}
                >
                  <span>Submit Answer</span>
                  <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                </button>
              )}

                {/* Right: Reveal Answer OR Explanation */}
                {hasFullAccess ? (
                  answerRevealed || (isAnswered && isCorrect) ? (
                    <button
                      onClick={() => setShowDetailedExplanation(true)}
                      className="px-4 py-2.5 rounded-organic-md bg-white/5 hover:bg-white/10 text-white/70 hover:text-white/90 transition-all duration-fast ease-signature flex items-center gap-2 font-mono text-sm border border-white/10"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Explanation</span>
                    </button>
                  ) : (
                    (!isAnswered || (isAnswered && !isCorrect)) && (
                      <button
                        onClick={() => setAnswerRevealed(true)}
                        className="px-4 py-2.5 rounded-organic-md bg-white/5 hover:bg-white/10 text-white/70 hover:text-white/90 transition-all duration-fast ease-signature flex items-center gap-2 font-mono text-sm border border-white/10"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Reveal Answer</span>
                      </button>
                    )
                  )
                ) : (
                  (answerRevealed || isAnswered) && (
                    <a
                      href="/pricing"
                      className="px-4 py-2.5 rounded-organic-md bg-primary/20 hover:bg-primary/30 text-primary transition-all duration-fast ease-signature flex items-center gap-2 font-mono text-sm border border-primary/30"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Upgrade to view solutions</span>
                    </a>
                  )
                )}
              </div>
            </div>
          </Container>
        </div>
      )}
      </div>

      {/* Progress Filter Speech Bubble */}
      {showProgressFilter && progressStats && (
        <Fragment>
          {/* Backdrop to close on click outside */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowProgressFilter(false)}
          />
          <div className="fixed bottom-20 left-4 z-50">
            <div className="bg-background border border-white/10 rounded-organic-lg p-4 shadow-xl min-w-[280px] relative">
              {/* Speech bubble tail */}
              <div className="absolute -bottom-2 left-8 w-4 h-4 bg-background border-b border-r border-white/10 transform rotate-45"></div>
            
            <div className="space-y-2">
              {(['Math 1', 'Math 2', 'Physics', 'Chemistry', 'Biology', 'Paper 1', 'Paper 2'] as SubjectFilter[]).map((subject) => {
                const isSelected = progressSubjects.includes(subject);
                const subjectColors: Record<SubjectFilter, { bg: string; text: string; border: string }> = {
                  'Math 1': { bg: 'bg-[#406166]/20', text: 'text-[#5da8f0]', border: 'border-[#5da8f0]/30' },
                  'Math 2': { bg: 'bg-[#406166]/20', text: 'text-[#5da8f0]', border: 'border-[#5da8f0]/30' },
                  'Physics': { bg: 'bg-[#6B4C93]/30', text: 'text-[#B794F6]', border: 'border-[#B794F6]/30' },
                  'Paper 1': { bg: 'bg-[#406166]/20', text: 'text-[#5da8f0]', border: 'border-[#5da8f0]/30' },
                  'Paper 2': { bg: 'bg-[#6B4C93]/30', text: 'text-[#B794F6]', border: 'border-[#B794F6]/30' },
                  'Chemistry': { bg: 'bg-[#5A7C65]/20', text: 'text-[#85BC82]', border: 'border-[#85BC82]/30' },
                  'Biology': { bg: 'bg-[#5A7C65]/20', text: 'text-[#85BC82]', border: 'border-[#85BC82]/30' },
                  'All': { bg: 'bg-white/10', text: 'text-white/70', border: 'border-white/20' },
                };
                const colors = subjectColors[subject] || subjectColors['All'];
                
                return (
                  <button
                    key={subject}
                    onClick={() => {
                      if (isSelected) {
                        setProgressSubjects(prev => prev.filter(s => s !== subject));
                      } else {
                        setProgressSubjects(prev => [...prev, subject]);
                      }
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-organic-md transition-all duration-fast ease-signature text-left border",
                      isSelected
                        ? `${colors.bg} ${colors.text} ${colors.border} border-2`
                        : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0",
                      isSelected ? `${colors.border} ${colors.bg}` : "border-white/30 bg-white/5"
                    )}>
                      {isSelected && <Check className="w-3 h-3" strokeWidth={2.5} />}
                    </div>
                    <span className="font-mono text-xs">{subject}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        </Fragment>
      )}
    </Fragment>
  );
}
