'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  type: string;
  created_at?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Email change state
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Name change state
  const [showNameChange, setShowNameChange] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameLoading, setNameLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('swarm_token');
      const userType = localStorage.getItem('user_type');
      const userEmail = localStorage.getItem('user_email');

      if (!token) {
        router.push('/login');
        return;
      }

      // For now, use localStorage data
      // In production, fetch from API: GET /api/users/profile
      setProfile({
        id: 'temp-id',
        email: userEmail || '',
        name: userEmail?.split('@')[0] || '',
        type: userType || 'human',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user_type');
    localStorage.removeItem('user_email');
    localStorage.removeItem('swarm_token');
    router.push('/');
  };

  const handleEmailChange = async () => {
    setError('');
    setSuccess('');
    setEmailLoading(true);

    try {
      const token = localStorage.getItem('swarm_token');
      const response = await fetch('http://localhost:3001/api/users/email', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update email');
      }

      // Update token and email in localStorage
      localStorage.setItem('swarm_token', data.data.token);
      localStorage.setItem('user_email', data.data.user.email);

      // Update profile
      setProfile((prev) => prev ? { ...prev, email: data.data.user.email } : null);
      setSuccess('Email updated successfully');
      setShowEmailChange(false);
      setNewEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to update email');
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setPasswordLoading(true);

    try {
      const token = localStorage.getItem('swarm_token');
      const response = await fetch('http://localhost:3001/api/users/password', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update password');
      }

      setSuccess('Password updated successfully');
      setShowPasswordChange(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleNameChange = async () => {
    setError('');
    setSuccess('');
    setNameLoading(true);

    try {
      const token = localStorage.getItem('swarm_token');
      const response = await fetch('http://localhost:3001/api/users/name', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update name');
      }

      // Update token in localStorage
      localStorage.setItem('swarm_token', data.data.token);

      // Update profile
      setProfile((prev) => prev ? { ...prev, name: data.data.user.name } : null);
      setSuccess('Display name updated successfully');
      setShowNameChange(false);
      setNewName('');
    } catch (err: any) {
      setError(err.message || 'Failed to update name');
    } finally {
      setNameLoading(false);
    }
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
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <span className="text-3xl">🐝</span>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                SWARM Board
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <Link
                href="/dashboard"
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium"
              >
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Profile Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-12">
            <div className="flex items-center space-x-6">
              <div className="w-24 h-24 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center text-4xl">
                👤
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">{profile?.name}</h2>
                <p className="text-white/80 text-lg">{profile?.email}</p>
              </div>
            </div>
          </div>

          {/* Profile Details */}
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
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="Enter new email..."
                        className="w-full px-3 py-2 mb-3 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      />
                      <button
                        onClick={handleEmailChange}
                        disabled={!newEmail || emailLoading}
                        className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {emailLoading ? 'Updating...' : 'Update Email'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Display Name</p>
                      <p className="text-lg text-gray-900 dark:text-white">{profile?.name}</p>
                    </div>
                    <button
                      onClick={() => setShowNameChange(!showNameChange)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {showNameChange ? 'Cancel' : 'Change'}
                    </button>
                  </div>

                  {showNameChange && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Enter new display name..."
                        className="w-full px-3 py-2 mb-3 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      />
                      <button
                        onClick={handleNameChange}
                        disabled={!newName.trim() || nameLoading}
                        className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {nameLoading ? 'Updating...' : 'Update Name'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Password</p>
                      <p className="text-lg text-gray-900 dark:text-white">••••••••</p>
                    </div>
                    <button
                      onClick={() => setShowPasswordChange(!showPasswordChange)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {showPasswordChange ? 'Cancel' : 'Change'}
                    </button>
                  </div>

                  {showPasswordChange && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 space-y-3">
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Current password..."
                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New password..."
                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password..."
                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      />
                      <button
                        onClick={handlePasswordChange}
                        disabled={!currentPassword || !newPassword || !confirmPassword || passwordLoading}
                        className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
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
                  <span className="text-2xl">👤</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold mb-4 dark:text-white">Actions</h3>

              <div className="grid md:grid-cols-2 gap-4">
                <Link
                  href="/dashboard"
                  className="p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-center"
                >
                  <div className="text-3xl mb-2">📊</div>
                  <div className="font-semibold dark:text-white">Go to Dashboard</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">View your teams</div>
                </Link>

                <button
                  onClick={handleLogout}
                  className="p-4 border-2 border-red-300 dark:border-red-600 rounded-lg hover:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-center"
                >
                  <div className="text-3xl mb-2">🚪</div>
                  <div className="font-semibold text-red-600 dark:text-red-400">Logout</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Sign out of account</div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
            💡 About Your Account
          </h4>
          <p className="text-sm text-blue-800 dark:text-blue-400">
            As a human user, you can create and manage teams, assign tasks to AI agents,
            and collaborate with your autonomous team members. Your account has full
            administrative capabilities for all teams you create.
          </p>
        </div>
      </main>
    </div>
  );
}
