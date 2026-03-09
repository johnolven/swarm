'use client';

import { Board } from '@/components/kanban/Board';
import Link from 'next/link';
import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LangToggle } from '@/components/LangToggle';
import { useLanguage } from '@/components/LanguageProvider';
import { ActivityPanel } from '@/components/kanban/ActivityPanel';
import { getToken } from '@/lib/auth';

export default function BoardPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params);
  const router = useRouter();
  const { t } = useLanguage();
  const [showMenu, setShowMenu] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [teamName, setTeamName] = useState('Team Board');
  const [showActivity, setShowActivity] = useState(false);

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const token = getToken();
        const response = await fetch(`/api/teams/${teamId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const result = await response.json();
          setTeamName(result.data.name);
        }
      } catch {
        // ignore
      }
    };
    fetchTeam();
  }, [teamId]);

  const handleRename = async () => {
    if (!newTeamName.trim()) return;

    try {
      const token = getToken();
      await fetch(`/api/teams/${teamId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newTeamName }),
      });

      setShowRenameModal(false);
      setTeamName(newTeamName); // Update team name immediately
      setNewTeamName('');
    } catch {
      // ignore
    }
  };

  const handleDelete = async () => {
    try {
      const token = getToken();
      const response = await fetch(`/api/teams/${teamId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const result = await response.json();
        alert(result.error || 'Failed to delete team');
        return;
      }

      router.push('/dashboard');
    } catch {
      alert('Failed to delete team');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <Link href="/dashboard" className="text-2xl font-bold dark:text-white hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            🐝 {teamName}
          </Link>
          <div className="flex items-center gap-4">
            <LangToggle />
            <ThemeToggle />

            {/* Virtual Office */}
            <Link
              href={`/dashboard/space/${teamId}`}
              className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all border border-transparent hover:border-gray-300 dark:hover:border-gray-600"
              title="Virtual Office"
              aria-label="Virtual Office"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </Link>

            {/* Activity Log Toggle */}
            <button
              type="button"
              onClick={() => setShowActivity(!showActivity)}
              className={`p-2 rounded-lg transition-all border border-transparent hover:border-gray-300 dark:hover:border-gray-600 ${showActivity ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              title={t.activity.title}
              aria-label={t.activity.title}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            {/* Settings Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all border border-transparent hover:border-gray-300 dark:hover:border-gray-600"
                title={t.board.teamSettings}
                aria-label={t.board.teamSettings}
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-gray-700 rounded-lg shadow-xl border-2 border-gray-200 dark:border-gray-600 z-20 overflow-hidden">
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowRenameModal(true);
                      }}
                      className="w-full px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 transition-colors border-b border-gray-200 dark:border-gray-600"
                    >
                      <span className="flex items-center gap-2">
                        <span>✏️</span>
                        <span>{t.board.renameTeam}</span>
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowDeleteModal(true);
                      }}
                      className="w-full px-4 py-3 text-left text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <span>🗑️</span>
                        <span>{t.board.deleteTeam}</span>
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Board teamId={teamId} />
      </main>

      {/* Rename Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{t.board.renameTeam}</h3>
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder={t.board.enterNewName}
              className="w-full px-3 py-2 mb-4 border-2 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent transition-all"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRenameModal(false);
                  setNewTeamName('');
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors"
              >
                {t.board.cancel}
              </button>
              <button
                onClick={handleRename}
                disabled={!newTeamName.trim()}
                className="px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
              >
                {t.board.rename}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-xl font-bold text-red-600 dark:text-red-400">{t.board.deleteConfirmTitle}</h3>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
              {t.board.deleteConfirmMsg}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors"
              >
                {t.board.cancel}
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 font-medium transition-colors"
              >
                {t.board.deleteTeam}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Panel */}
      <ActivityPanel teamId={teamId} isOpen={showActivity} onClose={() => setShowActivity(false)} />
    </div>
  );
}
