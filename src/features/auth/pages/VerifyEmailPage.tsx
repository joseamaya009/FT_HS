import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authApi } from '@shared/http/apiClient';

type VerificationState = 'loading' | 'success' | 'invalid' | 'error';

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [state, setState] = useState<VerificationState>('loading');
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');
  const token = new URLSearchParams(window.location.search).get('token') || '';

  useEffect(() => {
    if (!token) {
      setState('invalid');
      return;
    }

    authApi
      .verifyEmail(token)
      .then(() => setState('success'))
      .catch((error) => {
        setState(error?.status === 400 || error?.status === 404 ? 'invalid' : 'error');
      });
  }, [token]);

  const resend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setResending(true);
    setMessage('');
    try {
      await authApi.resendVerification(email.trim().toLowerCase());
      setMessage(t('verification.resendSuccess'));
    } catch {
      setMessage(t('verification.resendError'));
    } finally {
      setResending(false);
    }
  };

  const title =
    state === 'success'
      ? t('verification.successTitle')
      : state === 'loading'
        ? t('verification.loadingTitle')
        : state === 'invalid'
          ? t('verification.invalidTitle')
          : t('verification.errorTitle');

  return (
    <main className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-100 p-4">
      <section className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h1 className="text-xl font-semibold text-blue-950">{title}</h1>
        <p className="mt-3 text-sm text-slate-600">
          {state === 'success'
            ? t('verification.successDescription')
            : state === 'loading'
              ? t('verification.loadingDescription')
              : t('verification.resendDescription')}
        </p>

        {state !== 'success' && state !== 'loading' && (
          <form className="mt-5 space-y-3" onSubmit={resend}>
            <label className="block text-sm font-medium" htmlFor="verification-email">
              {t('auth.email')}
            </label>
            <input
              id="verification-email"
              className="w-full rounded-md border px-3 py-2"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <button
              className="w-full rounded-md bg-blue-700 px-3 py-2 text-white disabled:opacity-50"
              disabled={resending}
            >
              {resending ? t('verification.sending') : t('verification.resend')}
            </button>
            {message && <p className="text-sm text-slate-600">{message}</p>}
          </form>
        )}

        <a className="mt-5 inline-block text-sm text-blue-700 hover:underline" href="/login">
          {t('auth.backToLogin')}
        </a>
      </section>
    </main>
  );
}
