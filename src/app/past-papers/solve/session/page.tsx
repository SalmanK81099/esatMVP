/**
 * Session URL alias - /past-papers/solve/session is updated by the solve page
 * for tracking when the user is in an active section. There is no separate UI;
 * this route exists so that refreshing on /session doesn't 404.
 * Redirect to the main solve page; session state will be restored by SessionRestore.
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SolveSessionPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/past-papers/solve");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-sm text-white/60">Loading...</p>
    </div>
  );
}
