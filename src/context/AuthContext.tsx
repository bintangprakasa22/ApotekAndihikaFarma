import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';

export type UserRole = 'admin' | 'petugas';

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
}

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const GET_CACHE_TTL_MS = 45_000;

function resolveInvalidationPrefixes(url: string): string[] | null {
  const path = url.split('?')[0];
  if (path.startsWith('/api/notifications')) {
    return ['/api/alerts', '/api/me'];
  }
  if (path.startsWith('/api/categories')) {
    return ['/api/categories', '/api/medicines', '/api/reports/', '/api/topsis/candidates', '/api/audit-logs'];
  }
  if (path.startsWith('/api/suppliers')) {
    return ['/api/suppliers', '/api/medicines', '/api/reports/', '/api/topsis/candidates', '/api/audit-logs'];
  }
  if (path.startsWith('/api/medicines')) {
    return [
      '/api/medicines',
      '/api/categories',
      '/api/suppliers',
      '/api/alerts',
      '/api/dashboard',
      '/api/topsis/candidates',
      '/api/reports/',
      '/api/audit-logs',
    ];
  }
  if (path.startsWith('/api/stock/')) {
    return [
      '/api/medicines',
      '/api/stock-movements',
      '/api/alerts',
      '/api/dashboard',
      '/api/topsis/candidates',
      '/api/reports/',
      '/api/me',
      '/api/audit-logs',
    ];
  }
  if (path === '/api/topsis/criteria') {
    return ['/api/topsis/criteria', '/api/topsis/candidates', '/api/audit-logs'];
  }
  if (path.startsWith('/api/topsis/run')) {
    return ['/api/topsis/runs', '/api/dashboard', '/api/reports/topsis', '/api/audit-logs'];
  }
  if (path.startsWith('/api/users')) {
    return ['/api/users', '/api/audit-logs', '/api/me'];
  }
  return null;
}

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  unreadNotifications: number;
  mutationVersion: number;
  loading: boolean;
  signingIn: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  getCached: <T = unknown>(url: string) => T | null;
  apiFetch: <T = unknown>(url: string, options?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [mutationVersion, setMutationVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Simpan token hanya di memori JS (tidak pernah di localStorage)
  const tokenRef = useRef<string | null>(null);
  const getCacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const inFlightGetRef = useRef<Map<string, Promise<unknown>>>(new Map());
  const cacheEpochRef = useRef(0);
  const profileLoadInFlightRef = useRef<{ uid: string; promise: Promise<void> } | null>(null);

  const getToken = useCallback(async (userOverride?: User | null) => {
    const targetUser = userOverride ?? auth.currentUser;
    if (!targetUser) return null;
    const token = await targetUser.getIdToken();
    tokenRef.current = token;
    return token;
  }, []);

  const getCached = useCallback(<T = unknown>(url: string): T | null => {
    const cached = getCacheRef.current.get(url);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
      getCacheRef.current.delete(url);
      return null;
    }
    return cached.data as T;
  }, []);

  const invalidateByPrefixes = useCallback((prefixes: string[] | null) => {
    cacheEpochRef.current += 1;
    if (!prefixes) {
      getCacheRef.current.clear();
      return;
    }
    for (const key of getCacheRef.current.keys()) {
      if (prefixes.some((prefix) => key.startsWith(prefix))) {
        getCacheRef.current.delete(key);
      }
    }
  }, []);

  const apiFetch = useCallback(
    async <T = unknown>(url: string, options: RequestInit = {}): Promise<T> => {
      const method = (options.method || 'GET').toUpperCase();
      const bypassCache = options.cache === 'no-store' || options.cache === 'reload';

      if (method === 'GET' && !bypassCache && !options.signal) {
        const cached = getCacheRef.current.get(url);
        if (cached && cached.expiresAt > Date.now()) {
          return cached.data as T;
        }
        const pending = inFlightGetRef.current.get(url);
        if (pending) {
          return pending as Promise<T>;
        }
      }

      const startEpoch = cacheEpochRef.current;

      const executeRequest = async (): Promise<T> => {
        const token = (await getToken()) ?? tokenRef.current;
        const headers = new Headers(options.headers || {});
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        if (options.body && !headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json');
        }

        const response = await fetch(url, { ...options, headers });
        const contentType = response.headers.get('content-type') || '';
        const data = contentType.includes('application/json')
          ? await response.json()
          : await response.text();

        if (!response.ok) {
          const message =
            typeof data === 'object' && data && 'error' in data
              ? String((data as { error: unknown }).error)
              : `Terjadi kesalahan (${response.status}).`;
          throw new Error(message);
        }

        if (method === 'GET') {
          // Do not cache responses whose request started before a cache invalidation occurred
          if (startEpoch === cacheEpochRef.current && !options.signal?.aborted) {
            getCacheRef.current.set(url, {
              data,
              expiresAt: Date.now() + GET_CACHE_TTL_MS,
            });
          }
        } else {
          const prefixes = resolveInvalidationPrefixes(url);
          invalidateByPrefixes(prefixes);
          if (!url.startsWith('/api/notifications')) {
            setMutationVersion((v) => v + 1);
          }
        }

        return data as T;
      };

      if (method === 'GET' && !bypassCache && !options.signal) {
        const promise = executeRequest().finally(() => {
          inFlightGetRef.current.delete(url);
        });
        inFlightGetRef.current.set(url, promise);
        return promise;
      }

      return executeRequest();
    },
    [getToken, invalidateByPrefixes],
  );

  const loadBackendProfile = useCallback(
    async (user: User, bypassCache = false) => {
      if (profileLoadInFlightRef.current?.uid === user.uid) {
        return profileLoadInFlightRef.current.promise;
      }

      const promise = (async () => {
        try {
          setAuthError(null);
          await getToken(user);
          const data = await apiFetch<{ profile: UserProfile; unreadNotifications: number }>(
            '/api/me',
            bypassCache ? { cache: 'no-store' } : {},
          );
          setProfile(data.profile);
          setUnreadNotifications(data.unreadNotifications ?? 0);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Gagal memverifikasi akun.';
          setAuthError(msg);
          setProfile(null);
        } finally {
          if (profileLoadInFlightRef.current?.uid === user.uid) {
            profileLoadInFlightRef.current = null;
          }
        }
      })();

      profileLoadInFlightRef.current = { uid: user.uid, promise };
      return promise;
    },
    [apiFetch, getToken],
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await loadBackendProfile(user, true);
      } else {
        tokenRef.current = null;
        getCacheRef.current.clear();
        inFlightGetRef.current.clear();
        setProfile(null);
        setUnreadNotifications(0);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [loadBackendProfile]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    setSigningIn(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      if (cred.user) {
        setFirebaseUser(cred.user);
        await loadBackendProfile(cred.user, true);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Proses masuk dengan Google dibatalkan atau gagal.';
      setAuthError(msg);
    } finally {
      setSigningIn(false);
    }
  }, [loadBackendProfile]);

  const logout = useCallback(async () => {
    await signOut(auth);
    tokenRef.current = null;
    getCacheRef.current.clear();
    inFlightGetRef.current.clear();
    setProfile(null);
    setUnreadNotifications(0);
  }, []);

  const refreshProfile = useCallback(async () => {
    const current = auth.currentUser ?? firebaseUser;
    if (current) {
      await loadBackendProfile(current, true);
    }
  }, [firebaseUser, loadBackendProfile]);

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      profile,
      unreadNotifications,
      mutationVersion,
      loading,
      signingIn,
      authError,
      signInWithGoogle,
      logout,
      refreshProfile,
      getCached,
      apiFetch,
    }),
    [
      firebaseUser,
      profile,
      unreadNotifications,
      mutationVersion,
      loading,
      signingIn,
      authError,
      signInWithGoogle,
      logout,
      refreshProfile,
      getCached,
      apiFetch,
    ],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider.');
  }
  return ctx;
}
