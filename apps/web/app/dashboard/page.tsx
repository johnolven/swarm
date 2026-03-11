'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DebugPanel } from '@/components/DebugPanel';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LangToggle } from '@/components/LangToggle';
import { useLanguage } from '@/components/LanguageProvider';
import { CreateTeamModal } from '@/components/CreateTeamModal';

// Prefetch Phaser so it's cached when user opens Virtual Office
if (typeof window !== 'undefined') {
  import('phaser').catch(() => { /* ignore */ });
}
import { getToken, getUserType, isAuthenticated, logout } from '@/lib/auth';

interface Team {
  id: string;
  name: string;
  description?: string;
  visibility: string;
  created_at: Date;
}

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('private');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [invitationCount, setInvitationCount] = useState(0);
  const TEAMS_PER_PAGE = 9;

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    setUserType(getUserType() || 'agent');
    fetchTeams();
    fetchInvitationCount();
  }, [router]);

  const fetchTeams = async () => {
    try {
      const token = getToken();
      const response = await fetch('/api/teams', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTeams(data.data || []);
      }
    } catch {
      // Network error - teams will show empty
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitationCount = async () => {
    try {
      const token = getToken();
      const response = await fetch('/api/invitations', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setInvitationCount(data.data?.length || 0);
      }
    } catch {
      // Silently ignore - badge just won't show
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  // Filter teams by visibility and search query
  const filteredTeams = teams.filter(team => {
    const matchesVisibility = team.visibility === activeTab;
    const matchesSearch = team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         team.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesVisibility && matchesSearch;
  });

  // Calculate pagination
  const totalPages = Math.ceil(filteredTeams.length / TEAMS_PER_PAGE);
  const startIndex = (currentPage - 1) * TEAMS_PER_PAGE;
  const endIndex = startIndex + TEAMS_PER_PAGE;
  const paginatedTeams = filteredTeams.slice(startIndex, endIndex);

  // Reset to page 1 when changing tabs or search
  const handleTabChange = (tab: 'public' | 'private') => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center space-x-2">
              <span className="text-2xl sm:text-3xl">🐝</span>
              <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                SwarmMind
              </h1>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link
                href="/dashboard/invitations"
                className="relative text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium transition-colors"
                title={t.dashboard.invitations}
              >
                <span className="hidden sm:inline">✉️ {t.dashboard.invitations}</span>
                <span className="sm:hidden">✉️</span>
                {invitationCount > 0 && (
                  <span className="absolute -top-1 -right-2 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
                    {invitationCount}
                  </span>
                )}
              </Link>
              <Link
                href="/dashboard/profile"
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium transition-colors"
                title="Profile"
              >
                <span className="hidden sm:inline">{userType === 'human' ? `👤 ${t.dashboard.human}` : `🤖 ${t.dashboard.agent}`}</span>
                <span className="sm:hidden">{userType === 'human' ? '👤' : '🤖'}</span>
              </Link>
              <span className="hidden sm:inline"><LangToggle /></span>
              <ThemeToggle />
              <button
                type="button"
                onClick={handleLogout}
                className="px-2 sm:px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium"
              >
                <span className="hidden sm:inline">{t.dashboard.logout}</span>
                <span className="sm:hidden">↪</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2 dark:text-white">{t.dashboard.title}</h2>
          <p className="text-gray-600 dark:text-gray-400">{t.dashboard.subtitle}</p>
        </div>

        {/* Tabs and Search */}
        <div className="mb-6 space-y-4">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => handleTabChange('private')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'private'
                  ? 'border-b-2 border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              🔒 {t.dashboard.privateTeams} ({teams.filter(tm => tm.visibility === 'private').length})
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('public')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'public'
                  ? 'border-b-2 border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              🌐 {t.dashboard.publicTeams} ({teams.filter(tm => tm.visibility === 'public').length})
            </button>
          </div>

          {/* Search */}
          {filteredTeams.length > 3 && (
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={t.dashboard.searchPlaceholder}
                className="w-full px-4 py-3 pl-12 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              />
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">{t.dashboard.loadingTeams}</p>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedTeams.map((team) => (
              <div
                key={team.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all p-6 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">{team.name}</h3>
                  <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 text-xs font-medium rounded-full">
                    {team.visibility}
                  </span>
                </div>
                {team.description && (
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{team.description}</p>
                )}
                <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <Link
                    href={`/dashboard/board/${team.id}`}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                    </svg>
                    {t.dashboard.viewBoard}
                  </Link>
                  <Link
                    href={`/dashboard/space/${team.id}`}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Virtual Office
                  </Link>
                </div>
              </div>
              ))}

              {paginatedTeams.length === 0 && (
                <div className="col-span-full text-center py-12 bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
                  <div className="text-6xl mb-4">
                    {activeTab === 'public' ? '🌐' : '🔒'}
                  </div>
                  <h3 className="text-xl font-semibold mb-2 dark:text-white">
                    {searchQuery
                      ? t.dashboard.noTeamsFound
                      : t.dashboard.noTeamsYet.replace('{tab}', activeTab === 'public' ? t.dashboard.publicTeams.toLowerCase() : t.dashboard.privateTeams.toLowerCase())}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    {searchQuery
                      ? t.dashboard.adjustSearch
                      : t.dashboard.createFirstTeam}
                  </p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t.dashboard.showing} {startIndex + 1} {t.dashboard.to} {Math.min(endIndex, filteredTeams.length)} {t.dashboard.of} {filteredTeams.length} {t.dashboard.teams}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    ← {t.dashboard.previous}
                  </button>
                  <div className="flex gap-2">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          currentPage === page
                            ? 'bg-purple-600 text-white'
                            : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {t.dashboard.next} →
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <div className="mt-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-xl font-bold mb-4 dark:text-white">{t.dashboard.quickActions}</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all text-center"
            >
              <div className="text-3xl mb-2">➕</div>
              <div className="font-semibold dark:text-white">{t.dashboard.createTeam}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{t.dashboard.startNewTeam}</div>
            </button>
            <button
              type="button"
              onClick={fetchTeams}
              className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-center"
            >
              <div className="text-3xl mb-2">🔄</div>
              <div className="font-semibold dark:text-white">{t.dashboard.refreshTeams}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{t.dashboard.updateTeamList}</div>
            </button>
            <Link
              href="/api/health"
              target="_blank"
              className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all text-center"
            >
              <div className="text-3xl mb-2">🏥</div>
              <div className="font-semibold dark:text-white">{t.dashboard.apiStatus}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{t.dashboard.checkHealth}</div>
            </Link>
          </div>
        </div>
      </main>

      {/* Debug Panel */}
      <DebugPanel />

      {/* Create Team Modal */}
      <CreateTeamModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onTeamCreated={fetchTeams}
      />
    </div>
  );
}
