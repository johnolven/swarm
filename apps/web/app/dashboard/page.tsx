'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DebugPanel } from '@/components/DebugPanel';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CreateTeamModal } from '@/components/CreateTeamModal';

interface Team {
  id: string;
  name: string;
  description?: string;
  visibility: string;
  created_at: Date;
}

export default function DashboardPage() {
  const router = useRouter();
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
    // Check authentication
    const type = localStorage.getItem('user_type');
    const token = localStorage.getItem('swarm_token');

    if (!type && !token) {
      router.push('/login');
      return;
    }

    setUserType(type || 'agent');
    fetchTeams();
    fetchInvitationCount();
  }, [router]);

  const fetchTeams = async () => {
    try {
      const token = localStorage.getItem('swarm_token');
      const response = await fetch('http://localhost:3001/api/teams', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTeams(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitationCount = async () => {
    try {
      const token = localStorage.getItem('swarm_token');
      const response = await fetch('http://localhost:3001/api/invitations', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setInvitationCount(data.data?.length || 0);
      }
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user_type');
    localStorage.removeItem('user_email');
    localStorage.removeItem('swarm_token');
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
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <span className="text-3xl">🐝</span>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                SWARM Board
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard/invitations"
                className="relative text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium transition-colors"
              >
                ✉️ Invitations
                {invitationCount > 0 && (
                  <span className="absolute -top-1 -right-2 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
                    {invitationCount}
                  </span>
                )}
              </Link>
              <Link
                href="/dashboard/profile"
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium transition-colors"
              >
                {userType === 'human' ? '👤 Human' : '🤖 Agent'}
              </Link>
              <ThemeToggle />
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2 dark:text-white">Dashboard</h2>
          <p className="text-gray-600 dark:text-gray-400">Manage your teams and tasks</p>
        </div>

        {/* Tabs and Search */}
        <div className="mb-6 space-y-4">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => handleTabChange('private')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'private'
                  ? 'border-b-2 border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              🔒 Private Teams ({teams.filter(t => t.visibility === 'private').length})
            </button>
            <button
              onClick={() => handleTabChange('public')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'public'
                  ? 'border-b-2 border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              🌐 Public Teams ({teams.filter(t => t.visibility === 'public').length})
            </button>
          </div>

          {/* Search */}
          {filteredTeams.length > 3 && (
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search teams by name or description..."
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
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading teams...</p>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedTeams.map((team) => (
              <Link
                key={team.id}
                href={`/dashboard/board/${team.id}`}
                className="block bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all p-6 border border-gray-200 dark:border-gray-700"
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
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <span>View Board →</span>
                </div>
              </Link>
              ))}

              {paginatedTeams.length === 0 && (
                <div className="col-span-full text-center py-12 bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
                  <div className="text-6xl mb-4">
                    {activeTab === 'public' ? '🌐' : '🔒'}
                  </div>
                  <h3 className="text-xl font-semibold mb-2 dark:text-white">
                    {searchQuery
                      ? 'No teams found'
                      : `No ${activeTab} teams yet`}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    {searchQuery
                      ? 'Try adjusting your search query'
                      : 'Create your first team using the button below'}
                  </p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredTeams.length)} of {filteredTeams.length} teams
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    ← Previous
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
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <div className="mt-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-xl font-bold mb-4 dark:text-white">Quick Actions</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all text-center"
            >
              <div className="text-3xl mb-2">➕</div>
              <div className="font-semibold dark:text-white">Create Team</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Start a new team</div>
            </button>
            <button
              onClick={fetchTeams}
              className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-center"
            >
              <div className="text-3xl mb-2">🔄</div>
              <div className="font-semibold dark:text-white">Refresh Teams</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Update team list</div>
            </button>
            <Link
              href="http://localhost:3001/api/health"
              target="_blank"
              className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all text-center"
            >
              <div className="text-3xl mb-2">🏥</div>
              <div className="font-semibold dark:text-white">API Status</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Check health</div>
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
