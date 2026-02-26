/**
 * Info URL alias - /past-papers/solve/info is set when the user is on section
 * instructions or marking info. There is no separate UI; this route exists
 * so that refreshing on /info doesn't 404.
 * Redirect to the main solve page; session state will be restored by SessionRestore.
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SolveInfoPage() {
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
