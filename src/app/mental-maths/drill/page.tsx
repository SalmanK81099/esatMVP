/**
 * NEW VERSION - Drill builder page - Custom multi-topic session builder
 * 
 * This is the new three-column layout (Subject Categories | Topic Folders | Drill Variants Grid)
 * 
 * TO RESTORE OLD VERSION:
 * 1. Rename page.old.tsx to page.tsx
 * 2. Rename this file to page.new.tsx
 * 
 * The old version uses: TopicSelector | TopicsOverview + SessionFolder (two-column layout)
 */

"use client";

import { useState, Suspense, lazy } from "react";
import { getAllTopics } from "@/config/topics";
import { useBuilderSession } from "@/hooks/useBuilderSession";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ArrowRight, ListOrdered, Clock, Calculator } from "lucide-react";
import { SubjectCategories } from "@/components/builder/SubjectCategories";
import { TopicFolders } from "@/components/builder/TopicFolders";
import { DrillVariantsGrid } from "@/components/builder/DrillVariantsGrid";
import { useSubscription } from "@/hooks/useSubscription";

type HighLevelCategory =
  | "arithmetic"
  | "algebra"
  | "geometry"
  | "number_theory"
  | "shortcuts"
  | "trigonometry"
  | "physics"
  | "other";

// Lazy load session components
const MentalMathSession = lazy(() =>
  import("@/components/mental-math/MentalMathSession").then((mod) => ({
    default: mod.MentalMathSession,
  })),
);
const SessionResults = lazy(() =>
  import("@/components/builder/SessionResults").then((mod) => ({
    default: mod.SessionResults,
  })),
);

// Loading skeleton components
const BuilderLoadingSkeleton = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <LoadingSpinner size="md" />
      <p className="text-white/40 mt-4">Loading...</p>
    </div>
  </div>
);

const QuizLoadingSkeleton = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <LoadingSpinner size="md" />
      <p className="text-white/40 mt-4">Loading quiz...</p>
    </div>
  </div>
);

export default function BuilderPage() {
  const allTopics = getAllTopics();
  const { hasFullAccess } = useSubscription();
  const topics = hasFullAccess
    ? allTopics
    : allTopics.filter((t) => t.id === "addition");
  const builder = useBuilderSession();
  const [selectedCategory, setSelectedCategory] = useState<HighLevelCategory | null>("arithmetic");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  // Builder view
  if (builder.view === "builder") {
    return (
      <div className="relative min-h-[calc(100vh-4rem)] bg-background">
        <div className="flex h-full overflow-hidden">
          {/* Column 1: Subject Categories */}
          <SubjectCategories
            selectedCategory={selectedCategory}
            onSelectCategory={(cat) => {
              setSelectedCategory(cat);
              setSelectedTopicId(null); // Reset topic selection when category changes
            }}
          />

          {/* Columns 2 & 3: Topic Folders + Drill Variants */}
          <div className="flex-1 flex gap-6 p-6 overflow-hidden">
            {/* Column 2: Topic Folders (Operations-style) */}
            <Suspense fallback={<div className="w-80 rounded-2xl bg-surface-mid animate-pulse" />}>
              <TopicFolders
                topics={topics}
                selectedCategory={selectedCategory}
                selectedTopicId={selectedTopicId}
                onSelectTopic={setSelectedTopicId}
                selectedTopicIds={builder.selectedTopicVariants.map((tv) => `${tv.topicId}-${tv.variantId}`)}
              />
            </Suspense>

            {/* Column 3: Drill Variants Grid */}
            <Suspense fallback={<div className="flex-1 rounded-2xl bg-surface-mid animate-pulse" />}>
              <DrillVariantsGrid
                topicId={selectedTopicId}
                selectedTopicIds={builder.selectedTopicVariants.map((tv) => `${tv.topicId}-${tv.variantId}`)}
                onAddVariant={builder.addTopic}
                onRemoveVariant={builder.removeTopicVariant}
              />
            </Suspense>
            {!hasFullAccess && (
              <div className="p-4 rounded-2xl bg-surface-subtle border border-border text-center">
                <p className="text-sm text-text-muted mb-2">
                  Free: Addition only. Upgrade for all mental maths modules.
                </p>
                <a href="/pricing" className="text-primary hover:underline text-sm font-medium">
                  View plans
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Floating action bar */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-50">
          <div className="rounded-2xl bg-surface-elevated shadow-2xl px-4 py-4 md:px-5 md:py-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-5 w-full md:w-auto">
              <div className="flex -space-x-3">
                <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-background shadow-glow border border-border-subtle/40">
                  <Calculator className="w-5 h-5" />
                </div>
                <div className="w-9 h-9 rounded-xl bg-surface-mid flex items-center justify-center text-text shadow-lg border border-border-subtle/30">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="flex-1 md:flex-none">
                <h5 className="text-sm font-semibold text-text">
                  {builder.selectedTopicVariants.length || 0}{" "}
                  {builder.selectedTopicVariants.length === 1 ? "drill" : "drills"} selected
                </h5>
                <p className="text-[11px] font-medium text-text-subtle flex items-center gap-3 mt-0.5">
                  <span className="inline-flex items-center gap-1">
                    <ListOrdered className="w-3 h-3" />
                    <input
                      type="number"
                      value={builder.questionCount}
                      onChange={(e) => builder.setQuestionCount(Number(e.target.value) || 1)}
                      min="1"
                      max="100"
                      className="w-12 bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-text text-center font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0 m-0"
                      style={{ boxShadow: 'none' }}
                    />{" "}
                    questions
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto justify-end">
              <button
                type="button"
                onClick={builder.clearTopics}
                disabled={builder.selectedTopicVariants.length === 0}
                className="text-sm font-medium text-text-subtle hover:text-text transition-colors disabled:opacity-40"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={() => builder.startSession()}
                disabled={!builder.canStart}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-background font-semibold text-sm shadow-lg shadow-black/40 transition-all disabled:bg-surface-mid disabled:text-text-disabled disabled:shadow-none disabled:cursor-not-allowed active:scale-95"
              >
                Review &amp; start session
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Running session view - show session component directly
  if (builder.view === "running") {
    // Show loading if questions are being generated or session is initializing
    if (!builder.currentSession || !builder.currentQuestion) {
      return <QuizLoadingSkeleton />;
    }
    
    // Use MentalMathSession for all modes
    return (
      <Suspense fallback={<QuizLoadingSkeleton />}>
        <MentalMathSession
          currentQuestion={builder.currentQuestion}
          questionNumber={builder.currentQuestionIndex + 1}
          totalQuestions={builder.totalQuestions}
          progress={builder.progress}
          showFeedback={builder.showFeedback}
          lastAttempt={builder.lastAttempt}
          correctCount={builder.correctCount}
          onSubmitAnswer={builder.submitAnswer}
          onContinueAfterIncorrect={builder.continueAfterIncorrect}
          onExit={() => {
            builder.exitSession();
          }}
        />
      </Suspense>
    );
  }

  // Results view
  if (builder.view === "results" && builder.currentSession) {
    return (
      <Suspense fallback={<BuilderLoadingSkeleton />}>
        <SessionResults
          session={builder.currentSession}
          attempts={builder.attemptLog}
          onBackToBuilder={builder.exitSession}
          mode={builder.mode}
        />
      </Suspense>
    );
  }

  // Fallback / Debug
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-white/70 mb-2">State: {builder.view}</p>
        {builder.currentSession && (
          <p className="text-white/50 text-sm">
            Questions: {builder.currentSession.questions.length}, 
            Index: {builder.currentQuestionIndex}
          </p>
        )}
      </div>
    </div>
  );
}
