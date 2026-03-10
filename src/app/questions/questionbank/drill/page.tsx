/**
 * Question Bank Drill - Practice questions you got wrong
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { BookOpen, RotateCcw } from "lucide-react";
import type { QuestionBankQuestion } from "@/types/questionBank";

export default function QuestionBankDrillPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<QuestionBankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(10);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/question-bank/drill-questions", { credentials: "include" })
      .then((res) => {
        if (res.status === 401) {
          setError("unauthorized");
          return { questions: [], count: 0 };
        }
        if (!res.ok) throw new Error("Failed to load drill questions");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setQuestions(data.questions || []);
        const count = (data.questions || []).length;
        if (count > 0) {
          setTimeLimitMinutes(Math.max(5, Math.ceil(count * 1.5)));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Something went wrong");
          setQuestions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStartDrill = () => {
    if (questions.length === 0 || starting) return;
    setStarting(true);
    const sessionData = {
      questions,
      timeLimitMinutes,
      sessionName: `Drill - ${new Date().toLocaleString()}`,
      source: 'drill', // so the bank page can show "Drill (wrong questions)"
    };
    sessionStorage.setItem("questionBankSession", JSON.stringify(sessionData));
    router.push("/questions/questionbank?session=true");
  };

  if (loading) {
    return (
      <Container size="lg">
        <div className="flex flex-col items-center justify-center py-20">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-sm text-white/50">Loading drill questions...</p>
        </div>
      </Container>
    );
  }

  if (error === "unauthorized") {
    return (
      <Container size="lg">
        <PageHeader
          title="Question Bank Drill"
          description="Practice questions you got wrong. Sign in to use the drill."
        />
        <Card className="p-8 max-w-md">
          <p className="text-white/70 mb-4">You need to be signed in to practice your wrong questions.</p>
          <Button variant="primary" onClick={() => router.push("/login")}>
            Sign in
          </Button>
        </Card>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="lg">
        <PageHeader title="Question Bank Drill" description="Practice questions you got wrong." />
        <Card className="p-8 max-w-md">
          <p className="text-red-400 mb-4">{error}</p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </Card>
      </Container>
    );
  }

  const count = questions.length;

  if (count === 0) {
    return (
      <Container size="lg">
        <PageHeader
          title="Question Bank Drill"
          description="Practice questions you got wrong. Focus on your weak areas."
        />
        <Card className="p-8">
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-surface-elevated mb-2">
              <BookOpen className="w-8 h-8 text-text-muted" strokeWidth={1.5} />
            </div>
            <div className="text-center space-y-1.5">
              <div className="text-base font-mono font-semibold text-text-muted">
                No wrong questions yet
              </div>
              <div className="text-sm font-mono text-text-subtle max-w-sm">
                Answer questions in the Bank and get some wrong to build your drill.
              </div>
            </div>
            <Button
              variant="primary"
              onClick={() => router.push("/questions/questionbank")}
              className="mt-4"
            >
              Go to Question Bank
            </Button>
          </div>
        </Card>
      </Container>
    );
  }

  return (
    <Container size="lg">
      <PageHeader
        title="Question Bank Drill"
        description="Practice questions you got wrong. Focus on your weak areas."
      />
      <Card className="p-6">
        <div className="space-y-4">
          <p className="text-white/70">
            You have <strong className="text-white/90">{count}</strong> question{count === 1 ? "" : "s"} you got wrong.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-white/60">
              Time limit (minutes):
              <input
                type="number"
                min={5}
                max={120}
                value={timeLimitMinutes}
                onChange={(e) => setTimeLimitMinutes(Math.max(5, parseInt(e.target.value, 10) || 5))}
                className="w-20 px-2 py-1 rounded bg-white/10 text-white border border-white/20"
              />
            </label>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="primary"
              onClick={handleStartDrill}
              disabled={starting}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              {starting ? "Starting…" : "Start drill"}
            </Button>
            <Button variant="secondary" onClick={() => router.push("/questions/questionbank")}>
              Back to Bank
            </Button>
          </div>
        </div>
      </Card>
    </Container>
  );
}
