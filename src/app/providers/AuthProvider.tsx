import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ApiError,
  authApi,
  SESSION_EXPIRED_EVENT,
  sessionTokens,
  userApi,
} from '@shared/http/apiClient';
import {
  can as hasPermission,
  normalizePermissions,
  normalizeRoles,
  type AuthorizationContext,
} from '@shared/config/authorization';

export type AuthSession = AuthorizationContext & {
  userId?: string;
  sessionId?: string;
  fullName?: string;
  email?: string;
  avatarDataUrl?: string | null;
  preferences?: { language?: string; currency?: string };
};

type LoginCredentials = { login: string; password: string };

export type RegistrationPayload = {
  username: string;
  email: string;
  password: string;
  fullName: string;
  documentType: 'CC' | 'CE';
  documentNumber: string;
  privacyPolicyAccepted: boolean;
  termsAccepted: boolean;
  privacyPolicyVersion: string;
  termsVersion: string;
};

export type RegistrationResult = { message: string; email: string };

type AuthContextValue = {
  session: AuthSession | null;
  isInitializing: boolean;
  initializationError: boolean;
  retryInitialization: () => Promise<void>;
  isAuthenticated: boolean;
  can: (permission: string) => boolean;
  refreshSession: () => Promise<AuthSession>;
  login: (credentials: LoginCredentials) => Promise<AuthSession>;
  register: (payload: RegistrationPayload) => Promise<RegistrationResult>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => ReturnType<typeof authApi.requestPasswordReset>;
  passwordResetContext: (token: string) => ReturnType<typeof authApi.passwordResetContext>;
  resetPassword: (payload: { token: string; password: string }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initializationError, setInitializationError] = useState(false);
  const initializationAttempt = useRef(0);
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();

  const clearLocalSession = useCallback(() => {
    queryClient.clear();
    sessionTokens.clear();
    setSession(null);
  }, [queryClient]);

  const refreshSession = useCallback(async () => {
    const response = await userApi.me();
    const data = response.data as Partial<AuthSession>;
    const nextSession: AuthSession = {
      ...data,
      sessionId: data.sessionId,
      roles: normalizeRoles(data.roles),
      permissions: normalizePermissions(data.permissions),
    };
    setSession(nextSession);
    if (nextSession.preferences?.language) {
      try {
        await i18n.changeLanguage(nextSession.preferences.language);
      } catch {
        // Un fallo al cargar traducciones no invalida la sesión autenticada.
      }
    }
    return nextSession;
  }, [i18n]);

  const login = useCallback(
    async ({ login: identifier, password }: LoginCredentials) => {
      await authApi.login(identifier, password);
      return refreshSession();
    },
    [refreshSession]
  );

  const register = useCallback(async (payload: RegistrationPayload) => {
    const response = await authApi.register(payload);
    return response.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Una sesión revocada ya no puede utilizarse. Los fallos de red, CSRF o
      // rate limit se muestran al usuario para que pueda reintentar.
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
    }
    clearLocalSession();
  }, [clearLocalSession]);

  const retryInitialization = useCallback(async () => {
    const attempt = ++initializationAttempt.current;
    setIsInitializing(true);
    setInitializationError(false);
    try {
      // El cliente HTTP intenta renovar el access token si /users/me responde 401.
      await refreshSession();
    } catch (error) {
      if (attempt !== initializationAttempt.current) return;
      if (error instanceof ApiError && error.status === 401) {
        clearLocalSession();
      } else {
        // No confundir un fallo de red, 429 o 5xx con una sesión revocada.
        setInitializationError(true);
      }
    } finally {
      if (attempt === initializationAttempt.current) setIsInitializing(false);
    }
  }, [clearLocalSession, refreshSession]);

  useEffect(() => {
    void retryInitialization();
    return () => {
      initializationAttempt.current += 1;
    };
  }, [retryInitialization]);

  useEffect(() => {
    const handleExpiredSession = () => {
      clearLocalSession();
      setInitializationError(false);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpiredSession);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpiredSession);
  }, [clearLocalSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isInitializing,
      initializationError,
      retryInitialization,
      isAuthenticated: Boolean(session),
      can: (permission) => hasPermission(session?.permissions, permission),
      refreshSession,
      login,
      register,
      logout,
      requestPasswordReset: authApi.requestPasswordReset,
      passwordResetContext: authApi.passwordResetContext,
      resetPassword: async ({ token, password }) => {
        await authApi.resetPassword(token, password);
      },
    }),
    [
      initializationError,
      isInitializing,
      login,
      logout,
      refreshSession,
      register,
      retryInitialization,
      session,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe utilizarse dentro de AuthProvider');
  return context;
}
