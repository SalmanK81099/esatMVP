/**
 * Hook to track user activity and handle session persistence
 * 
 * Tracks user activity, detects tab switches/closes, and triggers
 * pause/save operations to IndexedDB.
 */

import { useEffect, useRef, useCallback } from 'react';
import { usePaperSessionStore } from '@/store/paperSessionStore';

const ACTIVITY_UPDATE_INTERVAL = 5000; // Update every 5 seconds
const INACTIVITY_THRESHOLD = 30000; // 30 seconds of inactivity

export function useSessionActivity() {
  const {
    sessionId,
    isPaused,
    currentQuestionIndex,
    currentSectionIndex,
    updateLastActiveTimestamp,
    pauseSession,
    saveSessionToIndexedDB,
    updateTimerState,
  } = usePaperSessionStore();

  const activityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const saveDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update last active timestamp periodically
  const updateActivity = useCallback(() => {
    if (!sessionId || isPaused) return;
    
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityRef.current;
    
    // Only update if user has been active recently
    if (timeSinceLastActivity < INACTIVITY_THRESHOLD) {
      updateLastActiveTimestamp();
      lastActivityRef.current = now;
    }
  }, [sessionId, isPaused, updateLastActiveTimestamp]);

  // Handle user activity events
  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (!isPaused && sessionId) {
      updateLastActiveTimestamp();
    }
  }, [isPaused, sessionId, updateLastActiveTimestamp]);

  // Save session to IndexedDB with debouncing
  const debouncedSave = useCallback(() => {
    if (!sessionId) return;
    
    if (saveDebounceTimerRef.current) {
      clearTimeout(saveDebounceTimerRef.current);
    }
    
    saveDebounceTimerRef.current = setTimeout(async () => {
      try {
        // Update timer state before saving to ensure accuracy
        if (!isPaused) {
          updateTimerState();
        }
        await saveSessionToIndexedDB();
      } catch (error) {
        console.error('[useSessionActivity] Failed to save session:', error);
      }
    }, 800); // 800ms debounce, same as server persistence
  }, [sessionId, isPaused, saveSessionToIndexedDB, updateTimerState]);

  // Handle visibility change (tab switch)
  useEffect(() => {
    if (!sessionId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Tab switched away - pause and save
        if (!isPaused) {
          pauseSession();
        }
        debouncedSave();
      } else if (document.visibilityState === 'visible') {
        // Tab became visible - update activity
        handleActivity();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sessionId, isPaused, pauseSession, debouncedSave, handleActivity]);

  // Handle page unload (tab close, navigation)
  useEffect(() => {
    if (!sessionId) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Pause session if not already paused
      if (!isPaused) {
        pauseSession();
      }
      
      // Save synchronously (using sendBeacon or synchronous IndexedDB)
      // Note: We can't use async/await in beforeunload, so we'll rely on
      // the debounced save that should have already fired
      // For critical saves, we could use navigator.sendBeacon, but IndexedDB
      // doesn't support that. The debounced save should handle most cases.
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [sessionId, isPaused, pauseSession]);

  // Track user activity (mouse, keyboard, scroll, touch)
  useEffect(() => {
    if (!sessionId || isPaused) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [sessionId, isPaused, handleActivity]);

  // Periodic activity update
  useEffect(() => {
    if (!sessionId || isPaused) {
      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current);
        activityIntervalRef.current = null;
      }
      return;
    }

    activityIntervalRef.current = setInterval(updateActivity, ACTIVITY_UPDATE_INTERVAL);
    
    return () => {
      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current);
        activityIntervalRef.current = null;
      }
    };
  }, [sessionId, isPaused, updateActivity]);

  // Auto-save on state changes (debounced) - including when user navigates between questions
  useEffect(() => {
    if (!sessionId || isPaused) return;

    debouncedSave();

    return () => {
      if (saveDebounceTimerRef.current) {
        clearTimeout(saveDebounceTimerRef.current);
      }
    };
  }, [sessionId, isPaused, debouncedSave, currentQuestionIndex, currentSectionIndex]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current);
      }
      if (saveDebounceTimerRef.current) {
        clearTimeout(saveDebounceTimerRef.current);
      }
    };
  }, []);
}

