import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
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

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  unreadNotifications: number;
  loading: boolean;
  signingIn: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  apiFetch: <T = unknown>(url: string, options?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Simpan token hanya di memori JS (tidak pernah di localStorage)
  const tokenRef = useRef<string | null>(null);

  const getToken = useCallback(async (userOverride?: User | null) => {
    const targetUser = userOverride ?? auth.currentUser;
    if (!targetUser) return null;
    const token = await targetUser.getIdToken();
    tokenRef.current = token;
    return token;
  }, []);

  const apiFetch = useCallback(
    async <T = unknown>(url: string, options: RequestInit = {}): Promise<T> => {
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

      return data as T;
    },
    [getToken],
  );

  const loadBackendProfile = useCallback(
    async (user: User) => {
      try {
        setAuthError(null);
        await getToken(user);
        const data = await apiFetch<{ profile: UserProfile; unreadNotifications: number }>('/api/me');
        setProfile(data.profile);
        setUnreadNotifications(data.unreadNotifications ?? 0);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Gagal memverifikasi akun.';
        setAuthError(msg);
        setProfile(null);
      }
    },
    [apiFetch, getToken],
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await loadBackendProfile(user);
      } else {
        tokenRef.current = null;
        setProfile(null);
        setUnreadNotifications(0);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [loadBackendProfile]);

  const signInWithGoogle = async () => {
    setAuthError(null);
    setSigningIn(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      if (cred.user) {
        setFirebaseUser(cred.user);
        await loadBackendProfile(cred.user);
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
  };

  const logout = async () => {
    await signOut(auth);
    tokenRef.current = null;
    setProfile(null);
    setUnreadNotifications(0);
  };

  const refreshProfile = async () => {
    if (firebaseUser) {
      await loadBackendProfile(firebaseUser);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        unreadNotifications,
        loading,
        signingIn,
        authError,
        signInWithGoogle,
        logout,
        refreshProfile,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider.');
  }
  return ctx;
}
