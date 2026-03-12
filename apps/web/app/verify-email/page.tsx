'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setError(t.login.verificationFailed);
      return;
    }

    fetch(`/api/users/verify-email?token=${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        // Save auth data
        localStorage.setItem('swarm_token', data.data.token);
        localStorage.setItem('user_type', 'human');
        localStorage.setItem('user_email', data.data.user.email);
        if (data.data.user.nickname) localStorage.setItem('user_nickname', data.data.user.nickname);
        if (data.data.user.avatar_id) localStorage.setItem('swarm_character_id', String(data.data.user.avatar_id));

        setStatus('success');
        setTimeout(() => router.push('/dashboard'), 1500);
      })
      .catch((err) => {
        setStatus('error');
        setError(err.message || t.login.verificationFailed);
      });
  }, [searchParams, router, t]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <span className="text-5xl">🐝</span>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mt-2">
            SwarmMind
          </h1>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
          {status === 'loading' && (
            <>
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-purple-600 border-t-transparent mb-4" />
              <p className="text-gray-600 dark:text-gray-400">{t.login.verifyingEmail}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="text-5xl mb-4">&#10003;</div>
              <h2 className="text-xl font-bold text-green-600 dark:text-green-400 mb-2">
                {t.login.emailVerified}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Redirecting to dashboard...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="text-5xl mb-4">&#10007;</div>
              <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
                {t.login.verificationFailed}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">{error}</p>
              <Link
                href="/login"
                className="inline-block px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg transition-all"
              >
                {t.login.backToLogin}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
