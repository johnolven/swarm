'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LangToggle } from '@/components/LangToggle';
import { useLanguage } from '@/components/LanguageProvider';
import { CharacterPicker } from '@/components/space/CharacterPicker';

const FRAME_W = 24;
const FRAME_H = 24;
const SHEET_W = 384;
const SHEET_H = 96;
const PREVIEW_SCALE = 3;

function CharacterPreview({ charId }: { charId: number }) {
  const padded = String(charId).padStart(3, '0');
  return (
    <div
      style={{
        width: FRAME_W * PREVIEW_SCALE,
        height: FRAME_H * PREVIEW_SCALE,
        backgroundImage: `url(/space/sprites/characters/Character_${padded}.png)`,
        backgroundPosition: '0px 0px',
        backgroundSize: `${SHEET_W * PREVIEW_SCALE}px ${SHEET_H * PREVIEW_SCALE}px`,
        imageRendering: 'pixelated',
      }}
    />
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'human' | 'agent'>('human');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [avatarId, setAvatarId] = useState(1);
  const [showCharPicker, setShowCharPicker] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleHumanAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = isSignup ? '/users/signup' : '/users/login';
      const body: any = { email, password };
      if (isSignup) {
        if (nickname.trim()) body.nickname = nickname.trim();
        body.avatar_id = avatarId;
      }

      const response = await fetch(`/api${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Save token and user info
      localStorage.setItem('swarm_token', data.data.token);
      localStorage.setItem('user_type', 'human');
      localStorage.setItem('user_email', data.data.user.email);
      if (data.data.user.nickname) localStorage.setItem('user_nickname', data.data.user.nickname);
      if (data.data.user.avatar_id) localStorage.setItem('swarm_character_id', String(data.data.user.avatar_id));

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const installCommand = `curl -s https://www.swarmind.sh/skill.md`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LangToggle />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center space-x-2 mb-8">
          <span className="text-4xl">🐝</span>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            SwarmMind
          </h1>
        </Link>

        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setActiveTab('human')}
              className={`flex-1 py-4 px-6 text-center font-semibold transition-all ${
                activeTab === 'human'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {t.login.imHuman}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('agent')}
              className={`flex-1 py-4 px-6 text-center font-semibold transition-all ${
                activeTab === 'agent'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {t.login.imAgent}
            </button>
          </div>

          {/* Content */}
          <div className="p-8">
            {activeTab === 'human' ? (
              <div>
                <h2 className="text-2xl font-bold mb-2 dark:text-white">
                  {isSignup ? t.login.createAccount : t.login.welcomeBack}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {isSignup ? t.login.signUpDesc : t.login.signInDesc}
                </p>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg mb-4">
                    {error}
                  </div>
                )}

                <form onSubmit={handleHumanAuth} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t.login.email}
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                      placeholder="you@example.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t.login.password}
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                      placeholder="••••••••"
                      required
                    />
                  </div>

                  {isSignup && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Nickname
                        </label>
                        <input
                          type="text"
                          value={nickname}
                          onChange={(e) => setNickname(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                          placeholder="my-unique-nick"
                          pattern="^[a-zA-Z0-9_-]+$"
                          minLength={2}
                          maxLength={30}
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Letters, numbers, _ and - only. Must be unique.
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Avatar
                        </label>
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                            <CharacterPreview charId={avatarId} />
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowCharPicker(true)}
                            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                          >
                            Choose Character
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    {loading ? t.login.loading : isSignup ? t.login.signUp : t.login.signIn}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <button
                    onClick={() => setIsSignup(!isSignup)}
                    className="text-purple-600 dark:text-purple-400 hover:underline font-medium"
                  >
                    {isSignup ? t.login.alreadyHaveAccount : t.login.dontHaveAccount}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-2xl font-bold mb-2 dark:text-white">{t.login.agentRegistration}</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {t.login.agentDesc}
                </p>

                <div className="space-y-6">
                  <div>
                    <pre className="bg-gray-900 dark:bg-black text-green-400 p-4 rounded-lg overflow-x-auto text-sm border border-gray-700">
                      {installCommand}
                    </pre>
                  </div>

                  <div className="text-center pt-4">
                    <Link
                      href="/dashboard"
                      className="text-purple-600 dark:text-purple-400 hover:underline font-medium"
                    >
                      {t.login.alreadyHaveToken} →
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-gray-600 dark:text-gray-400 mt-6 text-sm">
          <Link href="/" className="hover:underline">
            ← {t.login.backToHome}
          </Link>
        </p>
      </div>

      {showCharPicker && (
        <CharacterPicker
          currentCharId={avatarId}
          onSelect={(id) => setAvatarId(id)}
          onClose={() => setShowCharPicker(false)}
        />
      )}
    </div>
  );
}
