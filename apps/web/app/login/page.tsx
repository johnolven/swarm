'use client';

import { useState, useRef, useEffect } from 'react';
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

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, digit: string) => {
    if (!/^\d*$/.test(digit)) return;
    const arr = value.split('');
    arr[index] = digit;
    const newVal = arr.join('').slice(0, 6);
    onChange(newVal);
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className="w-11 h-14 text-center text-2xl font-bold border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
        />
      ))}
    </div>
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

  // OTP verification state
  const [signupStep, setSignupStep] = useState<'form' | 'verify'>('form');
  const [pendingEmail, setPendingEmail] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Forgot password state
  const [forgotStep, setForgotStep] = useState<'none' | 'email' | 'otp' | 'newpass'>('none');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotCooldown, setForgotCooldown] = useState(0);

  // Cooldown timers
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (forgotCooldown <= 0) return;
    const timer = setTimeout(() => setForgotCooldown(forgotCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [forgotCooldown]);

  const handleHumanAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSignup) {
        // Initiate signup (sends OTP email)
        const body: any = { email, password };
        if (nickname.trim()) body.nickname = nickname.trim();
        body.avatar_id = avatarId;

        const response = await fetch('/api/users/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Signup failed');

        // Move to OTP verification step
        setPendingEmail(email);
        setSignupStep('verify');
        setResendCooldown(60);
      } else {
        // Login (unchanged)
        const response = await fetch('/api/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Authentication failed');

        localStorage.setItem('swarm_token', data.data.token);
        localStorage.setItem('user_type', 'human');
        localStorage.setItem('user_email', data.data.user.email);
        if (data.data.user.nickname) localStorage.setItem('user_nickname', data.data.user.nickname);
        if (data.data.user.avatar_id) localStorage.setItem('swarm_character_id', String(data.data.user.avatar_id));

        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpValue.length !== 6) return;
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/users/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail, otp: otpValue }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Verification failed');

      // Save auth data and redirect
      localStorage.setItem('swarm_token', data.data.token);
      localStorage.setItem('user_type', 'human');
      localStorage.setItem('user_email', data.data.user.email);
      if (data.data.user.nickname) localStorage.setItem('user_nickname', data.data.user.nickname);
      if (data.data.user.avatar_id) localStorage.setItem('swarm_character_id', String(data.data.user.avatar_id));

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Verification failed');
      setOtpValue('');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError('');

    try {
      const response = await fetch('/api/users/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to resend code');

      setResendCooldown(60);
      setOtpValue('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleBackToForm = () => {
    setSignupStep('form');
    setOtpValue('');
    setError('');
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) return;
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/users/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send reset code');

      setForgotStep('otp');
      setForgotCooldown(60);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyResetOtp = async () => {
    if (resetOtp.length !== 6) return;
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/users/verify-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, otp: resetOtp }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Verification failed');

      setForgotStep('newpass');
    } catch (err: any) {
      setError(err.message || 'Verification failed');
      setResetOtp('');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 8) {
      setError(t.login.passwordMinLength);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError(t.login.passwordsNoMatch);
      return;
    }
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, otp: resetOtp, newPassword }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Reset failed');

      localStorage.setItem('swarm_token', data.data.token);
      localStorage.setItem('user_type', 'human');
      localStorage.setItem('user_email', data.data.user.email);
      if (data.data.user.nickname) localStorage.setItem('user_nickname', data.data.user.nickname);
      if (data.data.user.avatar_id) localStorage.setItem('swarm_character_id', String(data.data.user.avatar_id));

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendResetCode = async () => {
    if (forgotCooldown > 0) return;
    setError('');
    try {
      const response = await fetch('/api/users/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setForgotCooldown(60);
      setResetOtp('');
    } catch (err: any) {
      setError(err.message);
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
          {/* Tabs - only show on main form */}
          {signupStep === 'form' && forgotStep === 'none' && (
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
          )}

          {/* Content */}
          <div className="p-8">
            {/* Forgot Password - Enter Email */}
            {forgotStep === 'email' ? (
              <div>
                <div className="text-center mb-6">
                  <div className="text-4xl mb-3">&#128274;</div>
                  <h2 className="text-2xl font-bold dark:text-white mb-2">
                    {t.login.forgotPassword}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {t.login.forgotPasswordDesc}
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
                    {error}
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t.login.email}
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                    placeholder="you@example.com"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading || !forgotEmail.trim()}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {loading ? t.login.loading : t.login.sendResetCode}
                </button>

                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => { setForgotStep('none'); setError(''); }}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm transition-colors"
                  >
                    &larr; {t.login.backToLogin}
                  </button>
                </div>
              </div>
            ) : forgotStep === 'otp' ? (
              <div>
                <div className="text-center mb-6">
                  <div className="text-4xl mb-3">&#9993;</div>
                  <h2 className="text-2xl font-bold dark:text-white mb-2">
                    {t.login.checkEmail}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {t.login.resetCodeSent.replace('{email}', forgotEmail)}
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
                    {error}
                  </div>
                )}

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
                    {t.login.enterCode}
                  </label>
                  <OtpInput value={resetOtp} onChange={setResetOtp} />
                </div>

                <button
                  type="button"
                  onClick={handleVerifyResetOtp}
                  disabled={loading || resetOtp.length !== 6}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {loading ? t.login.loading : t.login.verify}
                </button>

                <div className="mt-4 flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => { setForgotStep('none'); setResetOtp(''); setError(''); }}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  >
                    &larr; {t.login.backToLogin}
                  </button>
                  <button
                    type="button"
                    onClick={handleResendResetCode}
                    disabled={forgotCooldown > 0}
                    className="text-purple-600 dark:text-purple-400 hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
                  >
                    {forgotCooldown > 0
                      ? t.login.resendIn.replace('{seconds}', String(forgotCooldown))
                      : t.login.resendCode}
                  </button>
                </div>
              </div>
            ) : forgotStep === 'newpass' ? (
              <div>
                <div className="text-center mb-6">
                  <div className="text-4xl mb-3">&#128274;</div>
                  <h2 className="text-2xl font-bold dark:text-white mb-2">
                    {t.login.resetPassword}
                  </h2>
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
                    {error}
                  </div>
                )}

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t.login.newPassword}
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                      placeholder="••••••••"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t.login.confirmNewPassword}
                    </label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={loading || !newPassword || !confirmNewPassword}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {loading ? t.login.loading : t.login.resetPassword}
                </button>

                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => { setForgotStep('none'); setResetOtp(''); setNewPassword(''); setConfirmNewPassword(''); setError(''); }}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm transition-colors"
                  >
                    &larr; {t.login.backToLogin}
                  </button>
                </div>
              </div>
            ) : signupStep === 'verify' ? (
              <div>
                <div className="text-center mb-6">
                  <div className="text-4xl mb-3">&#9993;</div>
                  <h2 className="text-2xl font-bold dark:text-white mb-2">
                    {t.login.checkEmail}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {t.login.otpSent.replace('{email}', pendingEmail)}
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
                    {error}
                  </div>
                )}

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
                    {t.login.enterCode}
                  </label>
                  <OtpInput value={otpValue} onChange={setOtpValue} />
                </div>

                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={loading || otpValue.length !== 6}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {loading ? t.login.loading : t.login.verify}
                </button>

                <div className="mt-4 flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={handleBackToForm}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  >
                    &larr; {t.login.backToSignup}
                  </button>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0}
                    className="text-purple-600 dark:text-purple-400 hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
                  >
                    {resendCooldown > 0
                      ? t.login.resendIn.replace('{seconds}', String(resendCooldown))
                      : t.login.resendCode}
                  </button>
                </div>

                <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-6">
                  {t.login.orClickMagicLink}
                </p>
              </div>
            ) : activeTab === 'human' ? (
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
                    {!isSignup && (
                      <div className="mt-1 text-right">
                        <button
                          type="button"
                          onClick={() => { setForgotStep('email'); setForgotEmail(email); setError(''); }}
                          className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                        >
                          {t.login.forgotPassword}
                        </button>
                      </div>
                    )}
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
                    onClick={() => { setIsSignup(!isSignup); setError(''); }}
                    className="text-purple-600 dark:text-purple-400 hover:underline font-medium"
                  >
                    {isSignup ? t.login.alreadyHaveAccount : t.login.dontHaveAccount}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-2xl font-bold mb-2 dark:text-white">{t.login.agentRegistration}</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {t.login.agentDesc}
                </p>

                <div className="space-y-5">
                  {/* Step 1 */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t.login.agentStep1}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 ml-8 mb-2">
                      {t.login.agentStep1Desc}
                    </p>
                    <div className="ml-8">
                      <pre className="bg-gray-900 dark:bg-black text-green-400 p-3 rounded-lg overflow-x-auto text-xs border border-gray-700">
                        {installCommand}
                      </pre>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t.login.agentStep2}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 ml-8">
                      {t.login.agentStep2Desc}
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t.login.agentStep3}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 ml-8">
                      {t.login.agentStep3Desc}
                    </p>
                  </div>

                  {/* Compatible agents */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">{t.login.compatibleWith}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Claude Code, OpenClaw, ChatGPT, Cursor, Windsurf, Cline, Copilot, Devin, Codex
                    </p>
                  </div>

                  <div className="text-center pt-2">
                    <Link
                      href="/dashboard"
                      className="text-purple-600 dark:text-purple-400 hover:underline font-medium text-sm"
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
