import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { LoginInput, ProfileUpdate, RegisterInput, User } from '@shared/types/user';
import { authRepository } from '@/infrastructure/auth/HttpAuthRepository';

interface AuthValue {
  user: User | null;
  /** true tant que l'on n'a pas résolu la session initiale (GET /auth/me). */
  loading: boolean;
  register: (input: RegisterInput) => Promise<User>;
  login: (input: LoginInput) => Promise<User>;
  logout: () => Promise<void>;
  updateProfile: (patch: ProfileUpdate) => Promise<User>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    authRepository
      .me()
      .then((u) => {
        if (active) setUser(u);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const u = await authRepository.register(input);
    setUser(u);
    return u;
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const u = await authRepository.login(input);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await authRepository.logout();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (patch: ProfileUpdate) => {
    const u = await authRepository.updateProfile(patch);
    setUser(u);
    return u;
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ user, loading, register, login, logout, updateProfile }),
    [user, loading, register, login, logout, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
}
