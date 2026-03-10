/**
 * Navigation bar component with section detection and switching
 */

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useSupabaseClient, useSupabaseSession } from "@/components/auth/SupabaseSessionProvider";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { UserIcon, LogInIcon } from "@/components/icons";
import { SessionProgressBar } from "@/components/papers/SessionProgressBar";
import { usePaperSessionStore } from "@/store/paperSessionStore";
import { useTheme } from "@/contexts/ThemeContext";
import { Sun, Moon } from "lucide-react";

const skillsNavItems = [
  { href: "/mental-maths/drill", label: "Drill" },
  { href: "/mental-maths/analytics", label: "Analytics" },
  { href: "/mental-maths/leaderboard", label: "Leaderboard" },
];

const papersNavItems = [
  { href: "/past-papers/roadmap", label: "Roadmap" },
  { href: "/past-papers/library", label: "Library" },
  { href: "/past-papers/drill", label: "Drill" },
  { href: "/past-papers/analytics", label: "Analytics" },
];

const questionsNavItems = [
  { href: "/questions/questionbank", label: "Bank" },
  { href: "/questions/library", label: "Library" },
  { href: "/questions/questionbank/drill", label: "Drill" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [activePress, setActivePress] = useState<string | null>(null);
  const session = useSupabaseSession();
  const supabase = useSupabaseClient();
  const { sessionId, endedAt, justQuitSessionId, justQuitTimestamp } = usePaperSessionStore();
  const { theme, toggleTheme, isDark } = useTheme();
  
  // Show progress bar if there's an active session
  // Don't show if this session was just quit (within last 5 seconds)
  const isJustQuit = justQuitSessionId === sessionId && justQuitTimestamp && (Date.now() - justQuitTimestamp) < 5000;
  const hasActiveSession = sessionId !== null && endedAt === null && !isJustQuit;

  const currentSection =
    pathname.startsWith("/mental-maths") ? "skills" 
    : pathname.startsWith("/past-papers") ? "papers" 
    : pathname.startsWith("/questions") ? "questions"
    : "home";

  const currentNavItems = 
    currentSection === "skills" ? skillsNavItems 
    : currentSection === "papers" ? papersNavItems 
    : currentSection === "questions" ? questionsNavItems
    : [];

  useEffect(() => {
    const allRoutes = [
      "/",
      "/mental-maths/drill",
      "/mental-maths/analytics",
      "/past-papers/roadmap",
      "/past-papers/library",
      "/past-papers/drill",
      "/past-papers/analytics",
      "/questions/questionbank",
      "/questions/library",
      "/questions/questionbank/drill",
    ];

    allRoutes.forEach((route, index) => {
      setTimeout(() => router.prefetch(route), index * 5);
    });
    router.prefetch("/pricing");
  }, [router]);

  const handleMouseDown = useCallback(
    (href: string) => {
      setActivePress(href);
      router.prefetch(href);
    },
    [router]
  );

  const handleMouseEnter = useCallback(
    (href: string) => {
      router.prefetch(href);
    },
    [router]
  );

  const handleMouseUp = useCallback(() => {
    setTimeout(() => setActivePress(null), 120);
  }, []);

  const loginHref = useMemo(() => {
    // Default to /papers/library if on home page or login page
    const redirectTo = pathname && pathname !== "/login" && pathname !== "/" ? pathname : "/past-papers/library";
    return `/login?redirectTo=${encodeURIComponent(redirectTo)}`;
  }, [pathname]);

  // Render progress bar if session is active
  if (hasActiveSession) {
    return <SessionProgressBar />;
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="interaction-scale">
              <span className="text-sm font-semibold uppercase tracking-wider text-text transition-colors duration-fast ease-signature hover:text-text-muted">
                No-Calc
              </span>
            </Link>

            <div className="flex items-center space-x-3">
              <Link
                href="/mental-maths/drill"
                className={cn(
                  "text-sm font-semibold uppercase tracking-wider transition-colors duration-fast ease-signature",
                  currentSection === "skills" ? "text-primary" : "text-text-muted hover:text-text"
                )}
              >
                Mental Maths
              </Link>
              <span className="text-sm text-text-subtle">/</span>
              <Link
                href="/past-papers/library"
                className={cn(
                  "text-sm font-semibold uppercase tracking-wider transition-colors duration-fast ease-signature",
                  currentSection === "papers" ? "text-maths" : "text-text-muted hover:text-text"
                )}
              >
                Past Papers
              </Link>
              <span className="text-sm text-text-subtle">/</span>
              <Link
                href="/questions/questionbank"
                className={cn(
                  "text-sm font-semibold uppercase tracking-wider transition-colors duration-fast ease-signature",
                  pathname.startsWith("/questions") ? "text-secondary" : "text-text-muted hover:text-text"
                )}
              >
                Question Bank
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {currentSection !== "home" && (
              <div className="flex items-center space-x-2">
                {currentNavItems.map((item) => {
                  const isActive = pathname === item.href;
                  const isPressed = activePress === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={true}
                      onMouseEnter={() => handleMouseEnter(item.href)}
                      onMouseDown={() => handleMouseDown(item.href)}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-semibold uppercase tracking-wider transition-all duration-instant ease-signature will-change-transform",
                        "active:scale-[0.97]",
                        isActive
                          ? currentSection === "skills"
                            ? "bg-primary/10 text-primary"
                            : currentSection === "papers"
                            ? "bg-maths/10 text-maths"
                            : "bg-secondary/10 text-secondary"
                          : "text-text-muted hover:text-text hover:bg-surface-subtle",
                        isPressed && !isActive && "bg-surface-elevated scale-[0.97]"
                      )}
                      style={{
                        transform: isPressed ? "scale(0.97)" : undefined,
                      }}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Link
                href="/pricing"
                className="text-sm font-medium text-text-muted hover:text-primary transition-colors px-2"
              >
                Pricing
              </Link>
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg transition-all duration-fast ease-signature hover:bg-surface-subtle interaction-scale"
                aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              >
                {isDark ? (
                  <Sun className="w-5 h-5 text-text-muted hover:text-text" />
                ) : (
                  <Moon className="w-5 h-5 text-text-muted hover:text-text" />
                )}
              </button>

              {session?.user ? (
                <Link
                  href="/profile"
                  className={cn(
                    "relative p-2 rounded-lg transition-all duration-fast ease-signature interaction-scale",
                    pathname === "/profile"
                      ? "bg-primary/10"
                      : "hover:bg-surface-subtle"
                  )}
                >
                  <UserIcon 
                    size="md" 
                    className={cn(
                      pathname === "/profile" ? "text-primary" : "text-text-muted hover:text-text"
                    )}
                  />
                  {/* Checkmark badge indicator */}
                  <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-primary rounded-full flex items-center justify-center">
                    <svg 
                      viewBox="0 0 12 12" 
                      fill="none" 
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-2.5 h-2.5 text-text"
                    >
                      <path 
                        d="M2.5 6L5 8.5L9.5 3.5" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </Link>
              ) : (
                <Link
                  href={loginHref}
                  className="p-2 rounded-lg transition-all duration-fast ease-signature hover:bg-surface-subtle interaction-scale"
                >
                  <LogInIcon size="md" className="text-text-muted hover:text-text" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}



