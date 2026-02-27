/**
 * Papers Drill page - Spaced repetition drill mode
 */

"use client";

import { useState, useEffect } from "react";
import { BookOpen } from "lucide-react";
import { SubscriptionGate } from "@/components/subscription/SubscriptionGate";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/layout/Container";
import { PaperBadge } from "@/components/papers/PaperBadge";
import { ChoicePill } from "@/components/papers/ChoicePill";
import { MathContent } from "@/components/shared/MathContent";
import { PageHeader } from "@/components/shared/PageHeader";

interface DrillItem {
  id: string;
  paperName: string;
  questionNumber: number;
  explanation: string;
  correctChoice: string;
}

function PapersDrillContent() {
  const [selectedPaper, setSelectedPaper] = useState("ESAT");
  const [currentQuestion, setCurrentQuestion] = useState<DrillItem | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);

  // Mock drill data
  const mockDrillItems: DrillItem[] = [
    {
      id: "1",
      paperName: "ESAT",
      questionNumber: 15,
      explanation: "This problem requires simplifying \\( \\frac{(\\sqrt{12} + \\sqrt{3})^2}{(\\sqrt{12} - \\sqrt{3})^2} \\). First simplify \\( \\sqrt{12} = 2\\sqrt{3} \\). Then the expression becomes \\( \\frac{(2\\sqrt{3} + \\sqrt{3})^2}{(2\\sqrt{3} - \\sqrt{3})^2} = \\frac{(3\\sqrt{3})^2}{(\\sqrt{3})^2} = \\frac{27}{3} = 9 \\).",
      correctChoice: "C",
    },
    {
      id: "2", 
      paperName: "ESAT",
      questionNumber: 23,
      explanation: "Check the sign of the acceleration - it's decelerating so negative. Use \\( v = v_0 + at \\) where \\( a < 0 \\).",
      correctChoice: "B",
    },
  ];

  const paperTypes = ["ESAT", "TMUA", "NSAA", "ENGAA", "PAT"];

  useEffect(() => {
    // Start timer when question loads
    if (currentQuestion && !showFeedback) {
      const interval = setInterval(() => {
        setTimeSpent(prev => prev + 1);
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [currentQuestion, showFeedback]);

  const startNextQuestion = () => {
    // Mock: pick a random question
    const availableQuestions = mockDrillItems.filter(item => item.paperName === selectedPaper);
    if (availableQuestions.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableQuestions.length);
      setCurrentQuestion(availableQuestions[randomIndex]);
      setSelectedChoice(null);
      setShowFeedback(false);
      setTimeSpent(0);
    }
  };

  const handleChoiceSelect = (choice: string) => {
    setSelectedChoice(choice);
  };

  const handleCheck = () => {
    setShowFeedback(true);
  };

  const handleNext = (outcome: "correct" | "wrong") => {
    // Here you would update the drill item with the outcome
    startNextQuestion();
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Container size="lg">
      <div className="space-y-8">
        {/* Header */}
        <PageHeader
          title="Drill Practice"
          description="Practice questions you got wrong using spaced repetition. Focus on your weak areas."
        />

        {/* Paper Selector and Stats */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm text-neutral-400">Paper Type:</div>
              <div className="flex gap-2">
                {paperTypes.map((paper) => (
                  <button
                    key={paper}
                    onClick={() => setSelectedPaper(paper)}
                    className={`px-3 py-1 text-sm rounded-organic-md ring-1 transition ${
                      selectedPaper === paper
                        ? "bg-primary/20 text-primary ring-primary/40"
                        : "bg-white/5 text-neutral-300 ring-white/10 hover:bg-white/10"
                    }`}
                  >
                    {paper}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex gap-6 text-sm text-neutral-400">
              <div>To review: <span className="text-neutral-200 font-medium">5</span></div>
              <div>Reviewed: <span className="text-neutral-200 font-medium">12</span></div>
              <div>Total: <span className="text-neutral-200 font-medium">17</span></div>
            </div>
          </div>
        </Card>

        {/* Question Interface */}
        {currentQuestion ? (
          <Card className="p-8">
            <div className="space-y-8">
              {/* Question Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-2xl font-bold text-neutral-100">
                    Question {currentQuestion.questionNumber}
                  </div>
                  <PaperBadge paperName={currentQuestion.paperName as any} />
                </div>
                <div className="text-sm text-neutral-400">
                  Time: {formatTime(timeSpent)}
                </div>
              </div>

              {/* Explanation from when you got it wrong */}
              <div className="p-4 bg-white/5 rounded-organic-md border border-white/10">
                <div className="text-sm text-neutral-400 mb-2">Your previous explanation:</div>
                <MathContent content={currentQuestion.explanation} className="text-neutral-300" />
              </div>

              {/* Choice Selection */}
              {!showFeedback && (
                <div>
                  <div className="text-sm text-neutral-400 mb-4">Select your answer:</div>
                  <div className="grid grid-flow-col auto-cols-fr gap-4">
                    {["A", "B", "C", "D"].map((letter) => (
                      <ChoicePill
                        key={letter}
                        letter={letter as any}
                        selected={selectedChoice === letter}
                        onClick={() => handleChoiceSelect(letter)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback */}
              {showFeedback && (
                <div className="space-y-4">
                  <div className="p-4 bg-white/5 rounded-organic-md border border-white/10">
                    <div className="text-sm text-neutral-400 mb-2">Your answer: {selectedChoice || "None"}</div>
                    <div className="text-sm text-neutral-400 mb-2">Correct answer: {currentQuestion.correctChoice}</div>
                    <div className={`text-sm font-medium ${
                      selectedChoice === currentQuestion.correctChoice ? "text-success" : "text-error"
                    }`}>
                      {selectedChoice === currentQuestion.correctChoice ? "Correct!" : "Incorrect"}
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => handleNext("wrong")}
                    >
                      Got it wrong
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => handleNext("correct")}
                    >
                      Got it right
                    </Button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {!showFeedback && (
                <div className="flex justify-end gap-3">
                  <Button
                    variant="secondary"
                    onClick={startNextQuestion}
                  >
                    Skip
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleCheck}
                    disabled={!selectedChoice}
                  >
                    Check Answer
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ) : (
          <Card className="p-8 rounded-lg">
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-surface-elevated mb-2">
                <BookOpen className="w-8 h-8 text-text-muted" strokeWidth={1.5} />
              </div>
              <div className="text-center space-y-1.5">
                <div className="text-base font-mono font-semibold text-text-muted">
                  No questions available for {selectedPaper}
                </div>
                <div className="text-sm font-mono text-text-subtle max-w-xs">
                  Complete some paper sessions and mark questions as wrong to build your drill pool.
                </div>
              </div>
              <Button
                variant="primary"
                onClick={() => window.location.href = "/past-papers/library"}
                className="mt-4"
              >
                Start a Session
              </Button>
            </div>
          </Card>
        )}
      </div>
    </Container>
  );
}

export default function PapersDrillPage() {
  return (
    <SubscriptionGate feature="drill">
      <PapersDrillContent />
    </SubscriptionGate>
  );
}
