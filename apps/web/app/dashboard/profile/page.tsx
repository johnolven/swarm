'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LangToggle } from '@/components/LangToggle';
import { getToken, getUserType, logout } from '@/lib/auth';
import { CharacterPicker } from '@/components/space/CharacterPicker';

const FRAME_W = 24;
const FRAME_H = 24;
const SHEET_W = 384;
const SHEET_H = 96;
const PREVIEW_SCALE = 4;

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

interface UserProfile {
  id: string;
  email: string;
  name: string;
  nickname: string | null;
  avatar_id: number;
  type: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showEmailChange, setShowEmailChange] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [showNameChange, setShowNameChange] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameLoading, setNameLoading] = useState(false);

  const [showNicknameChange, setShowNicknameChange] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [nicknameLoading, setNicknameLoading] = useState(false);

  const [showCharPicker, setShowCharPicker] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = getToken();
      if (!token) { router.push('/login'); return; }

      const res = await fetch('/api/users/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.data);
      } else {
        // Fallback
        const userEmail = localStorage.getItem('user_email');
        setProfile({
          id: '',
          email: userEmail || '',
          name: userEmail?.split('@')[0] || '',
          nickname: null,
          avatar_id: 1,
          type: getUserType() || 'human',
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => { logout(); router.push('/'); };

  const handleEmailChange = async () => {
    setError(''); setSuccess(''); setEmailLoading(true);
    try {
      const token = getToken();
      const response = await fetch('/api/users/email', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      localStorage.setItem('swarm_token', data.data.token);
      localStorage.setItem('user_email', data.data.user.email);
      setProfile(prev => prev ? { ...prev, email: data.data.user.email } : null);
      setSuccess('Email updated successfully');
      setShowEmailChange(false); setNewEmail('');
    } catch (err: any) { setError(err.message); } finally { setEmailLoading(false); }
  };

  const handlePasswordChange = async () => {
    setError(''); setSuccess('');
    if (newPassword !== confirmPassword) { setError('New passwords do not match'); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    setPasswordLoading(true);
    try {
      const token = getToken();
      const response = await fetch('/api/users/password', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSuccess('Password updated successfully');
      setShowPasswordChange(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: any) { setError(err.message); } finally { setPasswordLoading(false); }
  };

  const handleNameChange = async () => {
    setError(''); setSuccess(''); setNameLoading(true);
    try {
      const token = getToken();
      const response = await fetch('/api/users/name', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      localStorage.setItem('swarm_token', data.data.token);
      setProfile(prev => prev ? { ...prev, name: data.data.user.name } : null);
      setSuccess('Display name updated');
      setShowNameChange(false); setNewName('');
    } catch (err: any) { setError(err.message); } finally { setNameLoading(false); }
  };

  const handleNicknameChange = async () => {
    setError(''); setSuccess(''); setNicknameLoading(true);
    try {
      const token = getToken();
      const response = await fetch('/api/users/nickname', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: newNickname }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      localStorage.setItem('swarm_token', data.data.token);
      localStorage.setItem('user_nickname', data.data.user.nickname);
      setProfile(prev => prev ? { ...prev, nickname: data.data.user.nickname } : null);
      setSuccess('Nickname updated');
      setShowNicknameChange(false); setNewNickname('');
    } catch (err: any) { setError(err.message); } finally { setNicknameLoading(false); }
  };

  const handleAvatarSelect = async (charId: number) => {
    setError(''); setSuccess(''); setAvatarLoading(true);
    try {
      const token = getToken();
      const response = await fetch('/api/users/avatar', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_id: charId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      localStorage.setItem('swarm_character_id', String(charId));
      setProfile(prev => prev ? { ...prev, avatar_id: charId } : null);
      setSuccess('Avatar updated');
    } catch (err: any) { setError(err.message); } finally { setAvatarLoading(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 py-3 sm:px-6 lg:px-8 flex items-center justify-between">
          <Link href="/dashboard" className="text-base sm:text-2xl font-bold dark:text-white hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-1 sm:gap-2 truncate mr-2">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="truncate">Profile</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-3">
            <span className="hidden sm:inline"><LangToggle /></span>
            <ThemeToggle />
            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 hidden sm:block" />
            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 sm:p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Logout"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Profile Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-12">
            <div className="flex items-center space-x-6">
              <div className="bg-white/20 rounded-xl p-3 backdrop-blur-sm">
                <CharacterPreview charId={profile?.avatar_id || 1} />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white mb-1">
                  {profile?.nickname || profile?.name}
                </h2>
                {profile?.nickname && (
                  <p className="text-white/70 text-sm">{profile?.name}</p>
                )}
                <p className="text-white/80 text-lg">{profile?.email}</p>
              </div>
            </div>
          </div>

          <div className="px-8 py-8 space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg">
                {success}
              </div>
            )}

            <div>
              <h3 className="text-xl font-bold mb-4 dark:text-white">Account Information</h3>
              <div className="space-y-4">

                {/* Avatar */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avatar</p>
                      <div className="mt-2">
                        <CharacterPreview charId={profile?.avatar_id || 1} />
                      </div>
                    </div>
                    <button
                      onClick={() => setShowCharPicker(true)}
                      disabled={avatarLoading}
                      className="px-3 py-1 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      {avatarLoading ? 'Saving...' : 'Change'}
                    </button>
                  </div>
                </div>

                {/* Nickname */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Display Name (nickname)</p>
                      <p className="text-lg text-gray-900 dark:text-white">
                        {profile?.nickname || <span className="text-gray-400 italic">Not set</span>}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowNicknameChange(!showNicknameChange)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {showNicknameChange ? 'Cancel' : 'Change'}
                    </button>
                  </div>
                  {showNicknameChange && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                      <input
                        type="text"
                        value={newNickname}
                        onChange={(e) => setNewNickname(e.target.value)}
                        placeholder="my-unique-nick"
                        pattern="^[a-zA-Z0-9_-]+$"
                        minLength={2}
                        maxLength={30}
                        className="w-full px-3 py-2 mb-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        Letters, numbers, _ and - only. Must be unique across all users and agents.
                      </p>
                      <button
                        onClick={handleNicknameChange}
                        disabled={!newNickname.trim() || nicknameLoading}
                        className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {nicknameLoading ? 'Updating...' : 'Update Nickname'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Email */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Email Address</p>
                      <p className="text-lg text-gray-900 dark:text-white">{profile?.email}</p>
                    </div>
                    <button
                      onClick={() => setShowEmailChange(!showEmailChange)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {showEmailChange ? 'Cancel' : 'Change'}
                    </button>
                  </div>
                  {showEmailChange && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                      <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Enter new email..."
                        className="w-full px-3 py-2 mb-3 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent" />
                      <button onClick={handleEmailChange} disabled={!newEmail || emailLoading}
                        className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                        {emailLoading ? 'Updating...' : 'Update Email'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Display Name */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Display Name</p>
                      <p className="text-lg text-gray-900 dark:text-white">{profile?.name}</p>
                    </div>
                    <button onClick={() => setShowNameChange(!showNameChange)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                      {showNameChange ? 'Cancel' : 'Change'}
                    </button>
                  </div>
                  {showNameChange && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                      <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Enter new display name..."
                        className="w-full px-3 py-2 mb-3 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent" />
                      <button onClick={handleNameChange} disabled={!newName.trim() || nameLoading}
                        className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                        {nameLoading ? 'Updating...' : 'Update Name'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Password */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Password</p>
                      <p className="text-lg text-gray-900 dark:text-white">••••••••</p>
                    </div>
                    <button onClick={() => setShowPasswordChange(!showPasswordChange)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                      {showPasswordChange ? 'Cancel' : 'Change'}
                    </button>
                  </div>
                  {showPasswordChange && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 space-y-3">
                      <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password..."
                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent" />
                      <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password..."
                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent" />
                      <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password..."
                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent" />
                      <button onClick={handlePasswordChange} disabled={!currentPassword || !newPassword || !confirmPassword || passwordLoading}
                        className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                        {passwordLoading ? 'Updating...' : 'Update Password'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Account Type</p>
                    <p className="text-lg text-gray-900 dark:text-white capitalize">{profile?.type}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold mb-4 dark:text-white">Actions</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <Link href="/dashboard"
                  className="p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-center">
                  <div className="text-3xl mb-2">📊</div>
                  <div className="font-semibold dark:text-white">Go to Dashboard</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">View your teams</div>
                </Link>
                <button onClick={handleLogout}
                  className="p-4 border-2 border-red-300 dark:border-red-600 rounded-lg hover:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-center">
                  <div className="text-3xl mb-2">🚪</div>
                  <div className="font-semibold text-red-600 dark:text-red-400">Logout</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Sign out of account</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {showCharPicker && (
        <CharacterPicker
          currentCharId={profile?.avatar_id || 1}
          onSelect={handleAvatarSelect}
          onClose={() => setShowCharPicker(false)}
        />
      )}
    </div>
  );
}
