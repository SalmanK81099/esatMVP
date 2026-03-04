/**
 * Resume Page - Shows when session is paused
 * Allows user to resume or quit the session
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePaperSessionStore } from "@/store/paperSessionStore";
import { getSectionColor } from "@/config/colors";
import { cn } from "@/lib/utils";

export default function ResumePage() {
  const router = useRouter();
  const {
    sessionId,
    paperName,
    paperVariant,
    sessionName,
    currentQuestionIndex,
    questions,
    selectedSections,
    currentSectionIndex,
    isPaused,
    lastActiveTimestamp,
    sectionTimeLimits,
    sectionElapsedTimes,
    getSectionRemainingTime,
    resumeSession,
    resetSession,
  } = usePaperSessionStore();

  // Redirect if no session or not paused
  useEffect(() => {
    if (!sessionId) {
      router.push("/past-papers/library");
      return;
    }
    if (!isPaused) {
      // If not paused, redirect to solve page
      router.push("/past-papers/solve");
      return;
    }
  }, [sessionId, isPaused, router]);

  // Don't render if redirecting
  if (!sessionId || !isPaused) {
    return null;
  }

  // Get current question info
  const currentQuestion = questions[currentQuestionIndex];
  const currentQuestionNumber = currentQuestion?.questionNumber ?? (currentQuestionIndex >= 0 ? currentQuestionIndex + 1 : 1);
  const currentSection = selectedSections[currentSectionIndex] || "Section";
  
  // Format last active timestamp
  const formatLastActive = () => {
    if (!lastActiveTimestamp) return "Unknown";
    const date = new Date(lastActiveTimestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  };

  // Format time remaining
  const formatTimeRemaining = () => {
    if (selectedSections.length > 0 && sectionTimeLimits.length > currentSectionIndex && currentSectionIndex >= 0) {
      const remainingSeconds = getSectionRemainingTime(currentSectionIndex);
      const minutes = Math.floor(remainingSeconds / 60);
      const seconds = remainingSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    return "N/A";
  };

  // Format paper display name
  const getPaperDisplayName = (): string => {
    if (!paperName) return 'Custom';
    
    const yearMatch = paperVariant?.match(/^(\d{4})-/);
    const year = yearMatch ? yearMatch[1] : null;
    
    const isCustom = sessionName && (
      sessionName.includes('Custom') || 
      sessionName.includes('custom') ||
      !sessionName.match(/\d{4}/)
    );
    
    if (isCustom) {
      return 'Custom';
    }
    
    return year ? `${paperName} ${year}` : paperName;
  };

  const paperDisplayName = getPaperDisplayName();

  const handleResume = async () => {
    await resumeSession();
    router.push("/past-papers/solve");
  };

  const handleQuit = async () => {
    if (window.confirm('Are you sure you want to quit? Your progress will be saved.')) {
      await resetSession();
      router.push("/past-papers/library");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-mono font-semibold text-white/90">
            Session Paused
          </h1>
          <p className="text-sm font-mono text-white/60">
            {paperDisplayName}
          </p>
        </div>

        {/* Session Info Card */}
        <div className="bg-white/[0.02] border border-white/10 rounded-organic-lg p-6 space-y-4">
          {/* Current Question */}
          <div className="flex items-center justify-between py-2 border-b border-white/5">
            <span className="text-sm font-mono text-white/60 uppercase tracking-wide">Current Question</span>
            <span className="text-base font-mono font-semibold text-white/90">
              Question {currentQuestionNumber}
            </span>
          </div>

          {/* Section */}
          {selectedSections.length > 0 && (
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-sm font-mono text-white/60 uppercase tracking-wide">Section</span>
              <span 
                className="text-base font-mono font-semibold px-3 py-1.5 rounded-organic-md"
                style={{ 
                  backgroundColor: getSectionColor(currentSection),
                  color: '#ffffff'
                }}
              >
                {currentSection}
              </span>
            </div>
          )}

          {/* Last Active */}
          <div className="flex items-center justify-between py-2 border-b border-white/5">
            <span className="text-sm font-mono text-white/60 uppercase tracking-wide">Last Active</span>
            <span className="text-base font-mono font-semibold text-white/90">
              {formatLastActive()}
            </span>
          </div>

          {/* Time Remaining */}
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-mono text-white/60 uppercase tracking-wide">Time Remaining</span>
            <span className="text-base font-mono font-semibold text-white/90 tabular-nums">
              {formatTimeRemaining()}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleResume}
            className={cn(
              "flex-1 sm:flex-none px-6 py-3 rounded-organic-md transition-all duration-fast ease-signature",
              "flex items-center justify-center gap-2 font-mono text-sm font-medium",
              "bg-[#85BC82]/30 hover:bg-[#85BC82]/40 text-[#85BC82] cursor-pointer",
              "border border-[#85BC82]/30"
            )}
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
            Resume Session
          </button>
          <button
            onClick={handleQuit}
            className={cn(
              "flex-1 sm:flex-none px-6 py-3 rounded-organic-md transition-all duration-fast ease-signature",
              "flex items-center justify-center gap-2 font-mono text-sm font-medium",
              "bg-white/5 hover:bg-white/10 text-white/70 hover:text-white/90 cursor-pointer",
              "border border-white/10"
            )}
          >
            Quit Session
          </button>
        </div>
      </div>
    </div>
  );
}
