/**
 * IndexedDB storage layer for paper session persistence
 * 
 * Stores complete session state locally to enable resume functionality
 * when users navigate away or close tabs.
 */

const DB_NAME = 'paper_sessions_db';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

interface SessionData {
  sessionId: string;
  // All Zustand store state
  state: any;
  // Persistence metadata
  lastActiveTimestamp: number;
  sectionElapsedTimes: number[]; // Elapsed time per section in milliseconds
  isPaused: boolean;
  pausedAt: number | null;
  savedAt: number; // When this save occurred
}

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Initialize IndexedDB database
 */
function initDB(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open IndexedDB: ${request.error}`));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'sessionId' });
        store.createIndex('savedAt', 'savedAt', { unique: false });
      }
    };
  });

  return dbPromise;
}

/**
 * Save session state to IndexedDB
 */
export async function saveSession(sessionId: string, state: any, metadata: {
  lastActiveTimestamp: number;
  sectionElapsedTimes: number[];
  isPaused: boolean;
  pausedAt: number | null;
}): Promise<void> {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const sessionData: SessionData = {
      sessionId,
      state,
      lastActiveTimestamp: metadata.lastActiveTimestamp,
      sectionElapsedTimes: metadata.sectionElapsedTimes,
      isPaused: metadata.isPaused,
      pausedAt: metadata.pausedAt,
      savedAt: Date.now(),
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(sessionData);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[sessionStorage] Failed to save session:', error);
    throw error;
  }
}

/**
 * Load session state from IndexedDB
 */
export async function loadSession(sessionId: string): Promise<SessionData | null> {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise<SessionData | null>((resolve, reject) => {
      const request = store.get(sessionId);
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[sessionStorage] Failed to load session:', error);
    return null;
  }
}

/**
 * Delete session from IndexedDB
 */
export async function deleteSession(sessionId: string): Promise<void> {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(sessionId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[sessionStorage] Failed to delete session:', error);
    throw error;
  }
}

/**
 * Check if there's an active session in IndexedDB
 * Returns the sessionId if found, null otherwise
 */
export async function hasActiveSession(): Promise<string | null> {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise<string | null>((resolve, reject) => {
      const request = store.openCursor();
      const sessions: SessionData[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const data = cursor.value as SessionData;
          // Only consider sessions that are not ended
          if (data.state && !data.state.endedAt) {
            sessions.push(data);
          }
          cursor.continue();
        } else {
          // Return the most recently saved session
          if (sessions.length > 0) {
            sessions.sort((a, b) => b.savedAt - a.savedAt);
            resolve(sessions[0].sessionId);
          } else {
            resolve(null);
          }
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[sessionStorage] Failed to check for active session:', error);
    return null;
  }
}

/**
 * Unified session detection - checks both IndexedDB and database
 * Returns the most recent active session ID, or null if none found
 * Also reconciles differences (database is source of truth for ended_at)
 */
export async function findActiveSession(): Promise<{ sessionId: string; source: 'indexeddb' | 'database' } | null> {
  try {
    // Check IndexedDB first (faster, local)
    const indexedDBSessionId = await hasActiveSession();
    
    // Check database for in-progress sessions
    let databaseSessionId: string | null = null;
    try {
      const response = await fetch('/api/past-papers/sessions?in_progress=true', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        const data = await response.json();
        const sessions = data.sessions || [];
        if (sessions.length > 0) {
          // Sort by started_at descending and take most recent
          const sorted = sessions.sort((a: any, b: any) => {
            const aTime = a.started_at ? new Date(a.started_at).getTime() : 0;
            const bTime = b.started_at ? new Date(b.started_at).getTime() : 0;
            return bTime - aTime;
          });
          databaseSessionId = sorted[0].id;
        }
      }
    } catch (dbError) {
      console.warn('[findActiveSession] Failed to check database:', dbError);
      // Continue with IndexedDB result if database check fails
    }
    
    // Reconcile differences
    if (indexedDBSessionId && databaseSessionId) {
      // Both have sessions - check if they match
      if (indexedDBSessionId === databaseSessionId) {
        // Same session, use database as source of truth
        // Double-check that it's not ended in database
        try {
          const response = await fetch(`/api/past-papers/sessions?id=${databaseSessionId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          if (response.ok) {
            const data = await response.json();
            if (data.session && data.session.ended_at) {
              // Session is ended in database, clean up both
              await deleteSession(indexedDBSessionId);
              return null;
            }
          }
        } catch (checkError) {
          console.warn('[findActiveSession] Failed to verify session status:', checkError);
        }
        // Prefer IndexedDB when same session: it has full UI state (currentSectionIndex,
        // sectionInstructionTimer, etc.). Database doesn't store section/instruction position,
        // so restoring from DB would send user back to previous section if they're on the
        // next section's instruction page.
        return { sessionId: databaseSessionId, source: 'indexeddb' };
      } else {
        // Different sessions - prefer database (more authoritative)
        console.warn('[findActiveSession] Session mismatch:', {
          indexedDB: indexedDBSessionId,
          database: databaseSessionId
        });
        // Clean up IndexedDB session if it doesn't exist in database
        try {
          await deleteSession(indexedDBSessionId);
        } catch (deleteError) {
          console.error('[findActiveSession] Failed to clean up IndexedDB session:', deleteError);
        }
        // Verify database session is not ended
        try {
          const response = await fetch(`/api/past-papers/sessions?id=${databaseSessionId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          if (response.ok) {
            const data = await response.json();
            if (data.session && data.session.ended_at) {
              return null;
            }
          }
        } catch (checkError) {
          console.warn('[findActiveSession] Failed to verify database session:', checkError);
        }
        return { sessionId: databaseSessionId, source: 'database' };
      }
    } else if (databaseSessionId) {
      // Only database has session - IndexedDB might be out of sync
      // Verify it's not ended
      try {
        const response = await fetch(`/api/past-papers/sessions?id=${databaseSessionId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.session && data.session.ended_at) {
            return null;
          }
        }
      } catch (checkError) {
        console.warn('[findActiveSession] Failed to verify database session:', checkError);
      }
      return { sessionId: databaseSessionId, source: 'database' };
    } else if (indexedDBSessionId) {
      // Only IndexedDB has session - might be orphaned, but use it
      // Check if it's actually ended in database
      try {
        const response = await fetch(`/api/past-papers/sessions?id=${indexedDBSessionId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.session && data.session.ended_at) {
            // Session is ended in database, clean up IndexedDB
            await deleteSession(indexedDBSessionId);
            return null;
          }
        } else if (response.status === 404) {
          // Session doesn't exist in database, clean up IndexedDB
          await deleteSession(indexedDBSessionId);
          return null;
        }
      } catch (checkError) {
        console.warn('[findActiveSession] Failed to verify IndexedDB session:', checkError);
        // If we can't verify, don't restore it (safer to not restore than to restore incorrectly)
        return null;
      }
      return { sessionId: indexedDBSessionId, source: 'indexeddb' };
    }
    
    return null;
  } catch (error) {
    console.error('[findActiveSession] Failed to find active session:', error);
    return null;
  }
}

/**
 * Get all active sessions (for debugging/admin purposes)
 */
export async function getAllSessions(): Promise<SessionData[]> {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise<SessionData[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[sessionStorage] Failed to get all sessions:', error);
    return [];
  }
}



