/**
 * Papers Solve page - Timed solving interface
 */

"use client";

import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Container } from "@/components/layout/Container";
import { PaperBadge } from "@/components/papers/PaperBadge";
import { TimerDisplay } from "@/components/papers/TimerDisplay";
import { ChoicePill } from "@/components/papers/ChoicePill";
import { QuestionGrid } from "@/components/papers/QuestionGrid";
import { QuestionDisplay } from "@/components/papers/QuestionDisplay";
import { NavigatorPopup } from "@/components/papers/NavigatorPopup";
import { SectionSummary } from "@/components/papers/SectionSummary";
import { SubmitSectionReview } from "@/components/papers/SubmitSectionReview";
import { MarkingInfoPage } from "@/components/papers/MarkingInfoPage";
import { usePaperSessionStore } from "@/store/paperSessionStore";
import { mapPartToSection } from "@/lib/papers/sectionMapping";
import { prefetchImages } from "@/lib/papers/prefetch";
import { useSessionActivity } from "@/hooks/useSessionActivity";
import type { Letter, PaperType } from "@/types/papers";

const LETTERS: Letter[] = ["A", "B", "C", "D", "E", "F", "G", "H"];

export default function PapersSolvePage() {
  const router = useRouter();
  const {
    sessionId,
    paperId,
    paperName,
    paperVariant,
    sessionName,
    timeLimitMinutes,
    questionRange,
    questions,
    questionsLoading,
    questionsError,
    currentQuestionIndex,
    answers,
    perQuestionSec,
    guessedFlags,
    reviewFlags,
    startedAt,
    deadline,
    isPaused,
    isRestoring,
    loadQuestions,
    navigateToQuestion,
    setAnswer,
    setOther,
    setGuessedFlag,
    setReviewFlag,
    incrementTime,
    setEndedAt,
    getTotalQuestions,
    getRemainingTime,
    getCorrectCount,
    visitedQuestions,
    selectedSections,
    sectionStarts,
    currentSectionIndex,
    sectionTimeLimits,
    sectionInstructionTimer,
    setSectionInstructionTimer,
    allSectionsQuestions,
    getCurrentSectionQuestions,
    setCurrentSectionIndex,
    calculateSectionTimeLimits,
    sectionDeadlines,
    getSectionRemainingTime,
    setSectionStartTime,
    updateTimerState,
    sectionInstructionDeadline,
    saveSessionToIndexedDB,
  } = usePaperSessionStore();
  
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [showNotesPopover, setShowNotesPopover] = useState(false);
  const [showNavigator, setShowNavigator] = useState(false);
  const [showSubmitReview, setShowSubmitReview] = useState(false);
  const [showMarkingInfo, setShowMarkingInfo] = useState(false);
  
  // Track if we've loaded questions for the current paperId to prevent reload loops
  const loadedPaperIdRef = useRef<number | null>(null);
  
  // Track user activity and handle session persistence
  useSessionActivity();
  
  // Determine if section mode is active (needed for timer effect)
  const isSectionMode = selectedSections.length > 0 && allSectionsQuestions.length > 0;
  
  // Handle section time expired
  const handleSectionTimeExpired = useCallback(() => {
    const isLastSection = currentSectionIndex === selectedSections.length - 1;
    
    if (isLastSection) {
      // Last section - show marking info page
      setShowMarkingInfo(true);
    } else {
      // Move to next section - show section summary first
      const nextSectionIndex = currentSectionIndex + 1;
      setCurrentSectionIndex(nextSectionIndex);
      // Show section summary for next section (60 second timer)
      setSectionInstructionTimer(60);
    }
  }, [currentSectionIndex, selectedSections.length, setCurrentSectionIndex, setSectionInstructionTimer]);
  
  // Timer effect
  useEffect(() => {
    if (!startedAt || !deadline) return;
    
    let updateTimerStateInterval: ReturnType<typeof setInterval> | null = null;
    
    // Update timer state every 5 seconds to keep it accurate
    if (!isPaused) {
      updateTimerStateInterval = setInterval(() => {
        updateTimerState();
      }, 5000);
    }
    
    const interval = setInterval(() => {
      const state = usePaperSessionStore.getState();
      
      // Don't run timer if paused
      if (state.isPaused) return;
      
      // Check instruction timer deadline if on instruction page
      if (isSectionMode && sectionInstructionDeadline) {
        const now = Date.now();
        if (now >= sectionInstructionDeadline) {
          // Instruction timer expired - transition to section
          setSectionInstructionTimer(0);
          // Section will start automatically
          return;
        }
      }
      
      // Check section deadline if in section mode and not showing intro/marking info
      if (isSectionMode && 
          sectionInstructionTimer === null && 
          !showMarkingInfo &&
          sectionDeadlines.length > 0 &&
          currentSectionIndex < sectionDeadlines.length) {
        const sectionDeadline = sectionDeadlines[currentSectionIndex];
        if (sectionDeadline && Date.now() >= sectionDeadline) {
          // Section time expired
          handleSectionTimeExpired();
          clearInterval(interval);
          if (updateTimerStateInterval) clearInterval(updateTimerStateInterval);
          return;
        }
      }
      
      const remaining = getRemainingTime();
      if (remaining <= 0) {
        handleSubmit();
        clearInterval(interval);
        if (updateTimerStateInterval) clearInterval(updateTimerStateInterval);
        return;
      }
      
      // Increment time for current question - use currentQuestionIndex from store directly
      const currentIdx = state.currentQuestionIndex;
      incrementTime(currentIdx);
    }, 1000);
    
    return () => {
      clearInterval(interval);
      if (updateTimerStateInterval) clearInterval(updateTimerStateInterval);
    };
  }, [startedAt, deadline, isSectionMode, sectionInstructionTimer, sectionInstructionDeadline, sectionDeadlines, currentSectionIndex, showMarkingInfo, isPaused, handleSectionTimeExpired, getRemainingTime, incrementTime, updateTimerState, setSectionInstructionTimer]); // Minimal dependencies - getRemainingTime and incrementTime are stable from Zustand
  
  // Check if session is paused and redirect to resume page
  useEffect(() => {
    if (sessionId && isPaused) {
      // If paused, redirect to resume page
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/past-papers/solve/resume')) {
        router.push('/past-papers/solve/resume');
        return;
      }
    }
  }, [sessionId, isPaused, router]);

  // Load questions when session starts
  useEffect(() => {
    // Don't load if paused (will be handled by resume page)
    if (isPaused) return;
    
    // Load questions if:
    // 1. We have sessionId and paperId
    // 2. Either no questions loaded yet, OR questions don't match current paperId
    // 3. Not currently loading
    // 4. We haven't already loaded questions for this paperId (prevent reload loops)
    const shouldLoad = sessionId && paperId && !questionsLoading && 
                      (questions.length === 0 || questions[0]?.paperId !== paperId) &&
                      loadedPaperIdRef.current !== paperId;
    
    if (shouldLoad) {
      loadedPaperIdRef.current = paperId;
      loadQuestions(paperId).then(() => {
        // After questions load, ensure we're on the correct question
        // Preserve currentQuestionIndex from restored state
        const state = usePaperSessionStore.getState();
        const targetIndex = state.currentQuestionIndex;
        if (targetIndex >= 0 && targetIndex < state.questions.length) {
          navigateToQuestion(targetIndex);
        } else if (state.questions.length > 0) {
          // If index is invalid, navigate to first question
          navigateToQuestion(0);
        }
      });
    }
  }, [sessionId, paperId, questions.length, questionsLoading, isPaused, loadQuestions, navigateToQuestion]);
  
  // Track if we've started answering questions for current section (to prevent re-initializing timer)
  const sectionStartedRef = useRef<Set<number>>(new Set());
  
  // Initialize section instruction timer if needed (e.g., when session is restored from persistence)
  // BUT: Don't initialize if we just resumed from a paused state (resumeSession sets it to null intentionally)
  useEffect(() => {
    // Only initialize if:
    // 1. Section mode is active (selectedSections.length > 0)
    // 2. Questions are loaded (questions.length > 0 and not loading)
    // 3. Questions are grouped (allSectionsQuestions.length > 0)
    // 4. Current section has questions
    // 5. Timer is null (not set yet) - don't re-initialize if it's been set to 0 or we've started
    // 6. We haven't already started this section
    // 7. Session is not paused (if paused, we're on resume page)
    // 8. Pipeline state is "instruction" (if "section", user was already working, don't show intro)
    const state = usePaperSessionStore.getState();
    const shouldInit = selectedSections.length > 0 && 
        questions.length > 0 && 
        !questionsLoading &&
        !isPaused &&
        allSectionsQuestions.length > 0 && 
        currentSectionIndex < allSectionsQuestions.length &&
        allSectionsQuestions[currentSectionIndex]?.length > 0 &&
        sectionInstructionTimer === null &&
        state.currentPipelineState === "instruction" &&
        !sectionStartedRef.current.has(currentSectionIndex);
    if (shouldInit) {
      setSectionInstructionTimer(60);
    }
  }, [selectedSections.length, questions.length, questionsLoading, allSectionsQuestions.length, currentSectionIndex, sectionInstructionTimer, setSectionInstructionTimer, isPaused]);

  // Prefetch question images during section intro timer
  useEffect(() => {
    if (sectionInstructionTimer !== null && sectionInstructionTimer > 0 && isSectionMode) {
      const sectionQuestions = allSectionsQuestions[currentSectionIndex] || [];
      const imageUrls = sectionQuestions
        .map(q => q.questionImage)
        .filter(Boolean) as string[];
      
      if (imageUrls.length > 0) {
        // Prefetch in background - don't await to avoid blocking
        prefetchImages(imageUrls, { cacheName: 'paper-assets-v1', warmDecodeCount: 5 }).catch(err => {
          console.warn('[solve] Error prefetching images:', err);
        });
      }
    }
  }, [sectionInstructionTimer, currentSectionIndex, allSectionsQuestions, isSectionMode]);

  // Prefetch images when questions are first loaded (for first section)
  useEffect(() => {
    if (questions.length > 0 && !questionsLoading && isSectionMode && allSectionsQuestions.length > 0) {
      // Prefetch first section's images if timer hasn't started yet
      if (currentSectionIndex === 0 && (sectionInstructionTimer === null || sectionInstructionTimer === 0)) {
        const firstSectionQuestions = allSectionsQuestions[0] || [];
        const imageUrls = firstSectionQuestions
          .map(q => q.questionImage)
          .filter(Boolean) as string[];
        
        if (imageUrls.length > 0) {
          prefetchImages(imageUrls, { cacheName: 'paper-assets-v1', warmDecodeCount: 5 }).catch(err => {
            console.warn('[solve] Error prefetching first section images:', err);
          });
        }
      }
    }
  }, [questions.length, questionsLoading, isSectionMode, allSectionsQuestions, currentSectionIndex, sectionInstructionTimer]);
  
  // Show loading if session is being restored
  if (isRestoring) {
    return (
      <Container size="lg">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <LoadingSpinner size="md" />
            <p className="text-sm text-white/60">Restoring session...</p>
          </div>
        </div>
      </Container>
    );
  }

  // Redirect if no active session
  useEffect(() => {
    if (!sessionId && !isRestoring) {
      router.push("/past-papers/library");
    }
  }, [sessionId, isRestoring, router]);

  // Apply background color to body with smooth transition
  useEffect(() => {
    // Set transition for smooth color change
    document.body.style.transition = 'background-color 300ms ease-in-out';
    const backgroundColor = isDarkMode ? '#000000' : '#ffffff';
    document.body.style.backgroundColor = backgroundColor;
    
    // Cleanup on unmount
    return () => {
      document.body.style.backgroundColor = '';
      document.body.style.transition = '';
    };
  }, [isDarkMode]);

  // Preserve scroll position when navigating between questions
  const scrollPositionRef = useRef(window.scrollY);
  const previousQuestionIndexRef = useRef(currentQuestionIndex);

  useEffect(() => {
    // Only restore scroll if question actually changed
    if (previousQuestionIndexRef.current !== currentQuestionIndex) {
      requestAnimationFrame(() => {
        window.scrollTo({
          top: scrollPositionRef.current,
          left: 0,
          behavior: 'instant'
        });
      });
      previousQuestionIndexRef.current = currentQuestionIndex;
    }
    // Always capture current scroll in case we navigate
    scrollPositionRef.current = window.scrollY;
  });

  // Close notes popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showNotesPopover) {
        const target = event.target as Element;
        if (!target.closest('[data-notes-popover]')) {
          setShowNotesPopover(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotesPopover]);
  
  // Prevent main page scroll when navigator is open
  useEffect(() => {
    if (showNavigator) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showNavigator]);
  
  const totalQuestions = getTotalQuestions();
  
  
  // Validate section mode state
  if (selectedSections.length > 0 && allSectionsQuestions.length === 0 && questions.length > 0 && !questionsLoading) {
    console.error('[solve] Section mode active but questions not grouped. selectedSections:', selectedSections, 'allSectionsQuestions.length:', allSectionsQuestions.length);
  }
  
  // Get current section questions - if using section-based flow, use filtered questions
  const currentSectionQuestions = isSectionMode
    ? (allSectionsQuestions[currentSectionIndex] || [])
    : questions;
  
  // Use current section questions count for navigation and display
  const actualQuestionCount = currentSectionQuestions.length > 0 
    ? currentSectionQuestions.length 
    : (questions.length > 0 ? questions.length : totalQuestions);
  
  // Calculate remaining time - use section-specific time in section mode
  const remainingTime = isSectionMode && sectionDeadlines.length > currentSectionIndex
    ? getSectionRemainingTime(currentSectionIndex)
    : getRemainingTime();
  
  // Calculate total time minutes - use section time limit in section mode
  const totalTimeMinutes = isSectionMode && sectionTimeLimits.length > currentSectionIndex
    ? sectionTimeLimits[currentSectionIndex]
    : timeLimitMinutes;
  
  // Get current question first - find it in the full questions array
  const currentQuestion = questions[currentQuestionIndex];
  
  // Calculate section-relative index by finding currentQuestion's position in currentSectionQuestions
  let sectionQuestionIndex = 0;
  if (isSectionMode && currentQuestion && currentSectionQuestions.length > 0) {
    const foundIndex = currentSectionQuestions.findIndex(q => q.id === currentQuestion.id);
    sectionQuestionIndex = foundIndex >= 0 ? foundIndex : 0;
  } else {
    // Fallback for non-section flow
    sectionQuestionIndex = Math.min(currentQuestionIndex, actualQuestionCount - 1);
  }
  
  const currentSectionQuestion = currentSectionQuestions[sectionQuestionIndex];
  
  // Find the full index in the questions array for answer storage
  let fullQuestionIndex = currentQuestionIndex;
  if (allSectionsQuestions.length > 0 && currentSectionQuestion) {
    const fullIndex = questions.findIndex(q => q.id === currentSectionQuestion.id);
    if (fullIndex >= 0) {
      fullQuestionIndex = fullIndex;
    }
  }

  // Ensure current question is always within current section (when section-based flow is active)
  // Skip validation when section summary is showing (sectionInstructionTimer > 0)
  useEffect(() => {
    // Don't validate if section summary is showing
    if (sectionInstructionTimer !== null && sectionInstructionTimer > 0) {
      return;
    }
    
    if (isSectionMode && currentSectionQuestions.length > 0 && currentQuestion) {
      const isInCurrentSection = currentSectionQuestions.some(q => q.id === currentQuestion.id);
      if (!isInCurrentSection) {
        console.warn('[solve] Current question not in current section. Recovering to first question of section.', {
          currentQuestionId: currentQuestion.id,
          currentQuestionNumber: currentQuestion.questionNumber,
          currentSectionIndex,
          currentSectionQuestions: currentSectionQuestions.map(q => ({ id: q.id, number: q.questionNumber }))
        });
        // Current question is not in current section - navigate to first question of current section
        const firstQuestionOfSection = currentSectionQuestions[0];
        if (firstQuestionOfSection) {
          const fullIndex = questions.findIndex(q => q.id === firstQuestionOfSection.id);
          if (fullIndex >= 0) {
            navigateToQuestion(fullIndex);
          }
        }
      }
    }
  }, [isSectionMode, currentSectionIndex, currentQuestionIndex, currentSectionQuestions, currentQuestion, questions, navigateToQuestion, sectionInstructionTimer]);
  
  const currentAnswer = answers[fullQuestionIndex];
  const isGuessed = guessedFlags[fullQuestionIndex];
  const isFlaggedForReview = reviewFlags[fullQuestionIndex];
  // Compute section start indices for quick nav labeling
  // sectionStarts now computed in store during load, use directly

  
  // Get the actual question number from the question object
  const currentQuestionNumber = currentQuestion?.questionNumber ?? (questionRange.start + currentQuestionIndex);
  
  // Get current section boundaries
  const getCurrentSectionBounds = useCallback(() => {
    const sectionIndices = Object.keys(sectionStarts)
      .map(Number)
      .sort((a, b) => a - b);
    
    if (sectionIndices.length === 0) {
      return { start: 0, end: actualQuestionCount - 1 };
    }

    // Find which section we're currently in
    let sectionStart = 0;
    let sectionEnd = actualQuestionCount - 1;

    for (let i = 0; i < sectionIndices.length; i++) {
      const startIdx = sectionIndices[i];
      if (currentQuestionIndex >= startIdx) {
        sectionStart = startIdx;
        // Find next section start, or end of questions
        if (i + 1 < sectionIndices.length) {
          sectionEnd = sectionIndices[i + 1] - 1;
        } else {
          sectionEnd = actualQuestionCount - 1;
        }
      } else {
        break;
      }
    }

    return { start: sectionStart, end: sectionEnd };
  }, [currentQuestionIndex, sectionStarts, actualQuestionCount]);

  // Check if current section is complete (all questions have answers)
  const isCurrentSectionComplete = useCallback(() => {
    const { start, end } = getCurrentSectionBounds();
    for (let i = start; i <= end; i++) {
      if (!answers[i]?.choice) {
        return false;
      }
    }
    return true;
  }, [answers, getCurrentSectionBounds]);

  // Check if target index is in next section
  const isInNextSection = useCallback((targetIndex: number) => {
    const { start, end } = getCurrentSectionBounds();
    return targetIndex > end;
  }, [getCurrentSectionBounds]);

  const handleChoiceSelect = (letter: Letter) => {
    setAnswer(fullQuestionIndex, letter);
  };
  
  const handleOtherChange = (value: string) => {
    setOther(fullQuestionIndex, value);
  };
  
  const handleGuessToggle = () => {
    setGuessedFlag(fullQuestionIndex, !isGuessed);
  };

  const handleReviewFlagToggle = () => {
    setReviewFlag(fullQuestionIndex, !isFlaggedForReview);
  };
  
  const handleNavigation = (direction: number) => {
    scrollPositionRef.current = window.scrollY;
    
    if (isSectionMode && currentSectionQuestions.length > 0) {
      // Section-based flow: strictly enforce section boundaries
      const newSectionIndex = sectionQuestionIndex + direction;
      
      // Validate: must stay within current section
      if (newSectionIndex < 0 || newSectionIndex >= currentSectionQuestions.length) {
        return; // Don't navigate outside section
      }
      
      // Convert section-relative to global index
      const targetQuestion = currentSectionQuestions[newSectionIndex];
      const globalIndex = questions.findIndex(q => q.id === targetQuestion.id);
      
      if (globalIndex >= 0) {
        navigateToQuestion(globalIndex);
      } else {
        console.error('[solve] Failed to find global index for target question in current section');
      }
    } else if (selectedSections.length > 0 && allSectionsQuestions.length === 0) {
      // Section mode should be active but grouping failed - prevent navigation
      console.error('[solve] Section mode active but questions not grouped. Cannot navigate.');
      return;
    } else {
      // Fallback for non-section flow
      const newIndex = currentQuestionIndex + direction;
      if (newIndex >= 0 && newIndex < questions.length) {
        navigateToQuestion(newIndex);
      }
    }
  };

  const handleJumpNavigation = (direction: number) => {
    scrollPositionRef.current = window.scrollY;
    
    if (isSectionMode && currentSectionQuestions.length > 0) {
      // Section-based flow: jump within current section only
      const jumpSize = 10;
      const newSectionIndex = sectionQuestionIndex + (direction * jumpSize);
      const clampedSectionIndex = Math.max(0, Math.min(newSectionIndex, currentSectionQuestions.length - 1));
      
      const targetQuestion = currentSectionQuestions[clampedSectionIndex];
      const globalIndex = questions.findIndex(q => q.id === targetQuestion.id);
      if (globalIndex >= 0) {
        navigateToQuestion(globalIndex);
      } else {
        console.error('[solve] Failed to find global index for jumped question');
      }
    } else if (selectedSections.length > 0 && allSectionsQuestions.length === 0) {
      // Section mode should be active but grouping failed - prevent navigation
      console.error('[solve] Section mode active but questions not grouped. Cannot jump.');
      return;
    } else {
      // Fallback for non-section flow
      const jumpSize = 10;
      const actualCount = questions.length > 0 ? questions.length : totalQuestions;
      const newIndex = currentQuestionIndex + (direction * jumpSize);
      const clampedIndex = Math.max(0, Math.min(newIndex, actualCount - 1));
      navigateToQuestion(clampedIndex);
    }
  };
  
  const handleQuestionJump = (sectionRelativeIndex: number) => {
    scrollPositionRef.current = window.scrollY;
    // In section-based flow, index is relative to current section
    if (isSectionMode && currentSectionQuestions.length > 0) {
      // Ensure index is within current section bounds
      if (sectionRelativeIndex < 0 || sectionRelativeIndex >= currentSectionQuestions.length) {
        return;
      }
      // Convert section-relative to global index
      const targetQuestion = currentSectionQuestions[sectionRelativeIndex];
      const globalIndex = questions.findIndex(q => q.id === targetQuestion.id);
      if (globalIndex >= 0) {
        navigateToQuestion(globalIndex);
      } else {
        console.error('[solve] Failed to find global index for jumped question');
      }
    } else if (selectedSections.length > 0 && allSectionsQuestions.length === 0) {
      // Section mode should be active but grouping failed - prevent navigation
      console.error('[solve] Section mode active but questions not grouped. Cannot jump to question.');
      return;
    } else {
      // Fallback for non-section flow
      if (sectionRelativeIndex < 0 || sectionRelativeIndex >= questions.length) return;
      navigateToQuestion(sectionRelativeIndex);
    }
  };
  
  const handleSubmit = () => {
    setEndedAt(Date.now());
    router.push("/past-papers/submit");
  };

  // Handle section summary next button
  const handleSectionSummaryNext = () => {
    // Try navigation even if section mode check fails (defensive)
    let targetIndex = -1;
    
    if (isSectionMode && allSectionsQuestions.length > 0 && currentSectionIndex < allSectionsQuestions.length) {
      const sectionQuestions = allSectionsQuestions[currentSectionIndex] || [];
      if (sectionQuestions.length > 0) {
        const firstQuestion = sectionQuestions[0];
        targetIndex = questions.findIndex(q => q.id === firstQuestion.id);
      }
    }
    
    // Fallback: if section-based navigation fails, try first question
    if (targetIndex < 0 && questions.length > 0) {
      targetIndex = 0;
      console.warn('[solve] Section-based navigation failed, using fallback to first question');
    }
    
    if (targetIndex >= 0) {
      // Mark this section as started
      sectionStartedRef.current.add(currentSectionIndex);
      // Set section start time when starting to answer questions
      if (isSectionMode && sectionDeadlines.length <= currentSectionIndex) {
        setSectionStartTime(currentSectionIndex, Date.now());
      }
      navigateToQuestion(targetIndex);
      setSectionInstructionTimer(0); // Set to 0 to indicate timer is done
    } else {
      console.error('[solve] Cannot navigate: no valid question index found');
    }
  };

  // Handle section summary timer expiry
  const handleSectionSummaryTimerExpire = () => {
    // Use same navigation logic as handleSectionSummaryNext
    if (!isSectionMode) {
      console.error('[solve] Section mode not active, cannot navigate from timer expiry');
      setSectionInstructionTimer(0);
      return;
    }
    
    if (allSectionsQuestions.length === 0 || currentSectionIndex >= allSectionsQuestions.length) {
      console.error('[solve] Invalid section state for timer expiry navigation', {
        currentSectionIndex,
        allSectionsQuestionsLength: allSectionsQuestions.length
      });
      setSectionInstructionTimer(0);
      return;
    }
    
    const sectionQuestions = allSectionsQuestions[currentSectionIndex] || [];
    if (sectionQuestions.length === 0) {
      console.error('[solve] Section has no questions for timer expiry', { currentSectionIndex });
      setSectionInstructionTimer(0);
      return;
    }
    
    const firstQuestionOfSection = sectionQuestions[0];
    const fullIndex = questions.findIndex(q => q.id === firstQuestionOfSection.id);
    
    if (fullIndex < 0) {
      console.error('[solve] First question not found in questions array (timer expiry)', {
        questionId: firstQuestionOfSection.id,
        questionNumber: firstQuestionOfSection.questionNumber,
        questionsLength: questions.length
      });
      setSectionInstructionTimer(0);
      return;
    }
    
    // Mark this section as started
    sectionStartedRef.current.add(currentSectionIndex);
    // Set section start time when starting to answer questions
    if (sectionDeadlines.length <= currentSectionIndex) {
      setSectionStartTime(currentSectionIndex, Date.now());
    }
    // Navigate first, then clear timer
    navigateToQuestion(fullIndex);
    setSectionInstructionTimer(0); // Set to 0 to indicate timer is done
  };

  // Handle submit section (show review popup)
  const handleSubmitSection = () => {
    setShowSubmitReview(true);
  };

  // Handle submit section review confirmation
  const handleSubmitSectionConfirm = () => {
    setShowSubmitReview(false);
    const isLastSection = currentSectionIndex === selectedSections.length - 1;
    
    if (isLastSection) {
      // Last section - show marking info page instead of submitting
      setShowMarkingInfo(true);
    } else {
      // Move to next section - show section summary first
      const nextSectionIndex = currentSectionIndex + 1;
      setCurrentSectionIndex(nextSectionIndex);
      // Show section summary for next section (60 second timer)
      setSectionInstructionTimer(60);
      // Persist to IndexedDB immediately so refresh on instruction page restores to this section
      saveSessionToIndexedDB().catch((err) =>
        console.warn('[solve] Failed to save session to IndexedDB after section transition', err)
      );
      // Reset current question index to prepare for next section
      // The section summary will handle navigation to first question when user clicks Next
    }
  };

  // Handle marking info page next
  const handleMarkingInfoNext = () => {
    setEndedAt(Date.now());
    router.push("/past-papers/mark");
  };

  const getTimerVariant = () => {
    const remainingMinutes = remainingTime / 60;
    const percentage = remainingMinutes / totalTimeMinutes;
    
    if (percentage <= 0.1) return "critical";
    if (percentage <= 0.5) return "warning";
    return "default";
  };
  
  if (!sessionId) {
    return (
      <Container size="lg">
        <div className="text-center py-12">
          <div className="text-neutral-400">No active session found. Please start a new session.</div>
          <Button
            variant="primary"
            className="mt-4"
            onClick={() => router.push("/papers/library")}
          >
            Start New Session
          </Button>
        </div>
      </Container>
    );
  }
  
  // Update URL based on current state for better tracking
  useEffect(() => {
    if (!sessionId) return;
    
    const currentPath = window.location.pathname;
    let newPath = currentPath;
    
    if (showMarkingInfo) {
      newPath = currentPath.replace(/\/info$|\/session$/, '') + '/info';
    } else if (sectionInstructionTimer !== null && sectionInstructionTimer > 0) {
      newPath = currentPath.replace(/\/info$|\/session$/, '') + '/info';
    } else if (isSectionMode && !showMarkingInfo && (sectionInstructionTimer === null || sectionInstructionTimer === 0)) {
      newPath = currentPath.replace(/\/info$|\/session$/, '') + '/session';
    } else {
      newPath = currentPath.replace(/\/info$|\/session$/, '');
    }
    
    if (newPath !== currentPath && newPath !== window.location.pathname) {
      window.history.replaceState({}, '', newPath);
    }
  }, [sessionId, showMarkingInfo, sectionInstructionTimer, isSectionMode]);
  
  // Show marking info page if active
  if (showMarkingInfo) {
    return (
      <Container size="lg" className="min-h-screen">
        <MarkingInfoPage
          selectedSections={selectedSections}
          onNext={handleMarkingInfoNext}
        />
      </Container>
    );
  }

  // Show section summary if instruction timer is active
  // The condition properly hides when timer is 0 or null
  if (sectionInstructionTimer !== null && sectionInstructionTimer > 0) {
    return (
      <Container size="lg" className="min-h-screen">
        <SectionSummary
          currentSectionIndex={currentSectionIndex}
          selectedSections={selectedSections}
          allSectionsQuestions={allSectionsQuestions}
          sectionTimeLimits={sectionTimeLimits}
          paperName={paperName}
          onNext={handleSectionSummaryNext}
          onTimerExpire={handleSectionSummaryTimerExpire}
          sectionInstructionTimer={sectionInstructionTimer}
          setSectionInstructionTimer={setSectionInstructionTimer}
        />
      </Container>
    );
  }
  
  return (
        <Container size="lg" className="min-h-screen">
          <div className="space-y-0 flex flex-col" style={{ minHeight: '100vh' }}>

        {/* Question Interface */}
        {/* QUESTION DIV HEIGHT: Change both '80vh' values below to adjust question div height */}
        <div className="space-y-1 rounded-lg overflow-hidden flex-shrink-0" style={{ minHeight: '80vh', height: '80vh' }}>
            {/* Question Content */}
            {questionsLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center space-y-4">
                  <LoadingSpinner size="md" />
                  <p className="text-sm text-white/60">Loading questions...</p>
                </div>
              </div>
            ) : questionsError ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center space-y-4">
                  <div className="w-8 h-8 text-red-400 mx-auto">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <p className="text-sm text-red-400">{questionsError}</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => paperId && loadQuestions(paperId)}
                  >
                    Retry
                  </Button>
            </div>
              </div>
                ) : currentQuestion ? (
                  // QUESTION DIV HEIGHT: Change '80vh' below to adjust question div height
                  <div className="-mb-8" style={{ minHeight: '80vh', height: '80vh' }}>
                    <QuestionDisplay
                      question={currentQuestion}
                      questionNumber={currentQuestionNumber}
                      remainingTime={remainingTime}
                      totalTimeMinutes={totalTimeMinutes}
                      isGuessed={isGuessed}
                      onGuessToggle={handleGuessToggle}
                      isFlaggedForReview={isFlaggedForReview}
                      onReviewFlagToggle={handleReviewFlagToggle}
                      paperName={paperName}
                      currentQuestion={currentQuestion}
                    />
                  </div>
                ) : (
              <div className="flex items-center justify-center py-16">
                <div className="text-center space-y-4">
                  <div className="w-8 h-8 text-yellow-400 mx-auto">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
                  <p className="text-sm text-yellow-400">Question not available</p>
                  <p className="text-xs text-white/60">Question {currentQuestionNumber} could not be found in the database.</p>
                </div>
              </div>
            )}



            </div>

        {/* Unified Navigation Container */}
        {/* PADDING BETWEEN QUESTION AND MC: Change 'pt-4' (padding-top) below to adjust spacing. Also check 'space-y-0' on line 273 */}
        <div className="px-8 pb-12 pt-4 rounded-3xl flex-shrink-0" style={{
          // Remove gradient and shadow to eliminate glow/outline
          background: 'transparent',
          boxShadow: 'none',
          backdropFilter: 'none',
          position: 'sticky',
          bottom: 0,
          zIndex: 10
        }}>
          
          {/* Two-Row Button Layout */}
          <div className="space-y-4 w-full">
            {/* First Row: A-H Buttons */}
            <div className="flex items-center justify-between gap-2 w-full">
              {LETTERS.map((letter) => (
                <button
                  key={letter}
                  onClick={() => handleChoiceSelect(letter)}
                  className={`
                    h-[50px] rounded-organic-md font-medium text-base
                    flex items-center justify-center flex-1
                    transition-all duration-300 ease-out
                    ${currentAnswer?.choice === letter
                      ? 'bg-neutral-500 text-white border-2 border-neutral-400'
                      : 'bg-neutral-700 text-neutral-100 hover:bg-neutral-600 border-2 border-transparent'
                    }
                  `}
                  style={{
                    boxShadow: currentAnswer?.choice === letter
                      ? 'inset 0 -4px 0 rgba(0, 0, 0, 0.4), 0 6px 0 rgba(0, 0, 0, 0.6), 0 0 12px rgba(255, 255, 255, 0.15)'
                      : 'inset 0 -4px 0 rgba(0, 0, 0, 0.4), 0 6px 0 rgba(0, 0, 0, 0.6)'
                  }}
                  onMouseEnter={(e) => {
                    if (currentAnswer?.choice !== letter) {
                      e.currentTarget.style.boxShadow = 'inset 0 -4px 0 rgba(0, 0, 0, 0.4), 0 8px 0 rgba(0, 0, 0, 0.7)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentAnswer?.choice === letter) {
                      e.currentTarget.style.boxShadow = 'inset 0 -4px 0 rgba(0, 0, 0, 0.4), 0 6px 0 rgba(0, 0, 0, 0.6), 0 0 12px rgba(255, 255, 255, 0.15)';
                    } else {
                      e.currentTarget.style.boxShadow = 'inset 0 -4px 0 rgba(0, 0, 0, 0.4), 0 6px 0 rgba(0, 0, 0, 0.6)';
                    }
                  }}
                >
                  {letter}
                </button>
              ))}
            </div>

            {/* Second Row: Navigation Buttons */}
            <div className="flex items-center justify-between w-full">
              {/* Left Group: Submit Section */}
              <div className="flex items-center gap-2">
                {/* Submit Section Button */}
                <button
                  onClick={handleSubmitSection}
                  className="
                    flex items-center gap-2 px-6 py-3 font-medium transition-all duration-fast ease-signature
                    rounded-organic-md active:scale-95
                  "
                  style={{
                    backgroundColor: '#3d6064',
                    color: '#ffffff',
                    boxShadow: 'inset 0 -4px 0 rgba(0, 0, 0, 0.4), 0 6px 0 rgba(0, 0, 0, 0.6)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#345155';
                    e.currentTarget.style.boxShadow = 'inset 0 -4px 0 rgba(0, 0, 0, 0.4), 0 8px 0 rgba(0, 0, 0, 0.7)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#3d6064';
                    e.currentTarget.style.boxShadow = 'inset 0 -4px 0 rgba(0, 0, 0, 0.4), 0 6px 0 rgba(0, 0, 0, 0.6)';
                  }}
                  title="Submit section"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Submit Section</span>
                </button>
              </div>

              {/* Right Group: Prev + Navigator + Next */}
              <div className="flex items-center gap-2">
                {/* Previous Button */}
                <button
                  onClick={() => handleNavigation(-1)}
                  disabled={sectionQuestionIndex === 0}
                  className="
                    flex items-center justify-center gap-2 px-6 py-3 font-medium transition-all duration-fast ease-signature
                    rounded-organic-md active:scale-95
                    disabled:opacity-30 disabled:cursor-not-allowed
                  "
                  style={{
                    backgroundColor: '#3d6064',
                    color: '#ffffff',
                    boxShadow: sectionQuestionIndex === 0 
                      ? 'none'
                      : 'inset 0 -4px 0 rgba(0, 0, 0, 0.4), 0 6px 0 rgba(0, 0, 0, 0.6)'
                  }}
                  onMouseEnter={(e) => {
                    if (sectionQuestionIndex !== 0) {
                      e.currentTarget.style.backgroundColor = '#345155';
                      e.currentTarget.style.boxShadow = 'inset 0 -4px 0 rgba(0, 0, 0, 0.4), 0 8px 0 rgba(0, 0, 0, 0.7)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (sectionQuestionIndex !== 0) {
                      e.currentTarget.style.backgroundColor = '#3d6064';
                      e.currentTarget.style.boxShadow = 'inset 0 -4px 0 rgba(0, 0, 0, 0.4), 0 6px 0 rgba(0, 0, 0, 0.6)';
                    }
                  }}
                  title="Previous question"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Prev</span>
                </button>

                {/* Navigator Button */}
                <button
                  onClick={() => setShowNavigator(true)}
                  className="
                    flex items-center justify-center gap-2 px-6 py-3 font-medium transition-all duration-fast ease-signature
                    rounded-organic-md active:scale-95
                  "
                  style={{
                    backgroundColor: '#3d6064',
                    color: '#ffffff',
                    boxShadow: 'inset 0 -4px 0 rgba(0, 0, 0, 0.4), 0 6px 0 rgba(0, 0, 0, 0.6)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#345155';
                    e.currentTarget.style.boxShadow = 'inset 0 -4px 0 rgba(0, 0, 0, 0.4), 0 8px 0 rgba(0, 0, 0, 0.7)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#3d6064';
                    e.currentTarget.style.boxShadow = 'inset 0 -4px 0 rgba(0, 0, 0, 0.4), 0 6px 0 rgba(0, 0, 0, 0.6)';
                  }}
                  title="Open navigator"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  <span>Navigator</span>
                </button>

                {/* Next Button */}
                <button
                  onClick={() => handleNavigation(1)}
                  disabled={allSectionsQuestions.length > 0 
                    ? sectionQuestionIndex >= currentSectionQuestions.length - 1
                    : sectionQuestionIndex >= actualQuestionCount - 1}
                  className="
                    flex items-center justify-center gap-2 px-6 py-3 font-medium transition-all duration-fast ease-signature
                    rounded-organic-md active:scale-95
                    disabled:opacity-30 disabled:cursor-not-allowed
                  "
                  style={{
                    backgroundColor: '#3d6064',
                    color: '#ffffff',
                    boxShadow: (allSectionsQuestions.length > 0 
                      ? sectionQuestionIndex >= currentSectionQuestions.length - 1
                      : sectionQuestionIndex >= actualQuestionCount - 1)
                      ? 'none'
                      : 'inset 0 -4px 0 rgba(0, 0, 0, 0.4), 0 6px 0 rgba(0, 0, 0, 0.6)'
                  }}
                  onMouseEnter={(e) => {
                    const isDisabled = allSectionsQuestions.length > 0 
                      ? sectionQuestionIndex >= currentSectionQuestions.length - 1
                      : sectionQuestionIndex >= actualQuestionCount - 1;
                    if (!isDisabled) {
                      e.currentTarget.style.backgroundColor = '#345155';
                      e.currentTarget.style.boxShadow = 'inset 0 -4px 0 rgba(0, 0, 0, 0.4), 0 8px 0 rgba(0, 0, 0, 0.7)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    const isDisabled = allSectionsQuestions.length > 0 
                      ? sectionQuestionIndex >= currentSectionQuestions.length - 1
                      : sectionQuestionIndex >= actualQuestionCount - 1;
                    if (!isDisabled) {
                      e.currentTarget.style.backgroundColor = '#3d6064';
                      e.currentTarget.style.boxShadow = 'inset 0 -4px 0 rgba(0, 0, 0, 0.4), 0 6px 0 rgba(0, 0, 0, 0.6)';
                    }
                  }}
                  title="Next question"
                >
                  <span>Next</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Notes Icon */}
        <div className="fixed bottom-6 left-6 z-50">
          <div className="relative" data-notes-popover>
            <button
              onClick={() => setShowNotesPopover(!showNotesPopover)}
              className="
                flex items-center justify-center w-12 h-12 rounded-full font-medium transition-all duration-200
                backdrop-blur-md bg-[#0f1114] text-neutral-300 shadow-lg
                hover:bg-[#151921] hover:text-blue-300 hover:scale-105
              "
              title="Add notes for this question"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {/* Indicator dot if notes exist */}
              {currentAnswer?.other && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full border border-black/50" />
              )}
            </button>

            {/* Notes Popover */}
            {showNotesPopover && (
              <div className="absolute bottom-16 left-0 w-[600px] p-4 rounded-lg backdrop-blur-md shadow-2xl bg-black/80">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-base font-medium text-white">Question Notes</label>
                    <button
                      onClick={() => setShowNotesPopover(false)}
                      className="text-white hover:text-gray-300 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={currentAnswer?.other || ""}
                      onChange={(e) => handleOtherChange(e.target.value)}
                      placeholder="Working or notes you would like to review after the session"
                      className="
                        bg-black/50 text-white placeholder-neutral-500
                        focus:ring-0 focus:outline-none focus:ring-offset-0
                        flex-1 h-11 border-0
                      "
                      autoFocus
                    />
                    <button
                      onClick={() => setShowNotesPopover(false)}
                      className="
                        flex items-center justify-center h-11 w-11 rounded-lg font-medium transition-all duration-200
                        bg-[#0f1114] text-white
                        hover:bg-white hover:text-black
                        active:scale-95 active:transform
                      "
                      title="Done"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  </div>
                </div>
            </div>
            )}
          </div>
        </div>

        {/* Submit Confirmation Modal - Professional Dark Theme */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={() => setShowConfirmModal(false)}>
            <div
              className="w-full md:max-w-lg md:rounded-organic-lg rounded-t-3xl border-2 shadow-2xl"
              style={{ backgroundColor: '#0e0f13', borderColor: 'rgba(255,255,255,0.12)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 md:p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#506141' }}>
                    <svg className="w-4 h-4" style={{ color: '#ffffff' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-neutral-100">Submit session?</h3>
                </div>
                <p className="text-sm text-neutral-400">
                  You can still review and edit your answers on the marking page after submitting.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    className="px-4 py-2 rounded-organic-md text-sm font-medium transition-all duration-fast ease-signature
                             active:scale-95"
                    style={{
                      backgroundColor: 'transparent',
                      color: '#e5e7eb',
                      boxShadow: 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { setShowConfirmModal(false); handleSubmit(); }}
                    className="px-4 py-2 rounded-organic-md text-sm font-semibold transition-all duration-fast ease-signature
                           active:scale-95"
                    style={{
                      backgroundColor: '#3d6064',
                      color: '#ffffff',
                      boxShadow: 'inset 0 -4px 0 rgba(0, 0, 0, 0.4), 0 6px 0 rgba(0, 0, 0, 0.6)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#345155';
                      e.currentTarget.style.boxShadow = 'inset 0 -4px 0 rgba(0, 0, 0, 0.4), 0 8px 0 rgba(0, 0, 0, 0.7)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#3d6064';
                      e.currentTarget.style.boxShadow = 'inset 0 -4px 0 rgba(0, 0, 0, 0.4), 0 6px 0 rgba(0, 0, 0, 0.6)';
                    }}
                    autoFocus
                  >
                    Submit & Mark
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigator Popup */}
        <NavigatorPopup
          isOpen={showNavigator}
          onClose={() => setShowNavigator(false)}
          totalQuestions={allSectionsQuestions.length > 0 ? currentSectionQuestions.length : actualQuestionCount}
          currentQuestionIndex={sectionQuestionIndex}
          answers={(() => {
            // Map section-relative indices to global answers
            if (allSectionsQuestions.length > 0 && currentSectionQuestions.length > 0) {
              return currentSectionQuestions.map((q) => {
                const globalIndex = questions.findIndex(q2 => q2.id === q.id);
                return globalIndex >= 0 ? answers[globalIndex] : { choice: null };
              });
            }
            return answers.slice(0, actualQuestionCount);
          })()}
          reviewFlags={(() => {
            // Map section-relative indices to global reviewFlags
            if (allSectionsQuestions.length > 0 && currentSectionQuestions.length > 0) {
              return currentSectionQuestions.map((q) => {
                const globalIndex = questions.findIndex(q2 => q2.id === q.id);
                return globalIndex >= 0 ? reviewFlags[globalIndex] : false;
              });
            }
            return reviewFlags.slice(0, actualQuestionCount);
          })()}
          visitedQuestions={(() => {
            // Map section-relative indices to global visitedQuestions
            if (allSectionsQuestions.length > 0 && currentSectionQuestions.length > 0) {
              return currentSectionQuestions.map((q) => {
                const globalIndex = questions.findIndex(q2 => q2.id === q.id);
                return globalIndex >= 0 ? visitedQuestions[globalIndex] : false;
              });
            }
            return visitedQuestions.slice(0, actualQuestionCount);
          })()}
          onNavigateToQuestion={handleQuestionJump}
          questionNumbers={currentSectionQuestions.map((q) => q.questionNumber)}
        />

        {/* Submit Section Review Popup */}
        {showSubmitReview && (
          <SubmitSectionReview
            isOpen={showSubmitReview}
            onClose={() => setShowSubmitReview(false)}
            currentSectionIndex={currentSectionIndex}
            totalSections={selectedSections.length}
            sectionQuestions={(() => {
              const sectionQs = allSectionsQuestions[currentSectionIndex] || [];
              return sectionQs.map((q, idx) => ({
                questionNumber: q.questionNumber,
                index: questions.findIndex(q2 => q2.id === q.id)
              })).filter(item => item.index >= 0);
            })()}
            answers={answers}
            reviewFlags={reviewFlags}
            visitedQuestions={visitedQuestions}
            onNavigateToQuestion={handleQuestionJump}
            onSubmit={handleSubmitSectionConfirm}
          />
        )}

      </div>
    </Container>
  );
}

