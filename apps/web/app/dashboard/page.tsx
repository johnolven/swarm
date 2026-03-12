'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LangToggle } from '@/components/LangToggle';
import { useLanguage } from '@/components/LanguageProvider';
import { CreateTeamModal } from '@/components/CreateTeamModal';

// Prefetch Phaser so it's cached when user opens Virtual Office
if (typeof window !== 'undefined') {
  import('phaser').catch(() => { /* ignore */ });
}
import { getToken, getUserType, isAuthenticated, logout } from '@/lib/auth';

interface TeamMember {
  id: string;
  agent_id?: string;
  user_id?: string;
  role: string;
}

interface Team {
  id: string;
  name: string;
  description?: string;
  visibility: string;
  created_at: Date;
  created_by?: string;
  created_by_user?: string;
  members?: TeamMember[];
}

function parseTokenPayload(token: string): { user_id?: string; agent_id?: string } | null {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

type Translations = ReturnType<typeof import('@/components/LanguageProvider').useLanguage>['t'];

const TEAMS_PER_PAGE = 8;

function TeamCard({ team, t, showVisibility }: { team: Team; t: Translations; showVisibility?: boolean }) {
  const router = useRouter();
  return (
    <div
      onClick={() => router.push(`/dashboard/space/${team.id}`)}
      className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-all hover:shadow-md cursor-pointer"
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate pr-2">
            {team.name}
          </h3>
          {showVisibility && (
            <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded ${
              team.visibility === 'private'
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
            }`}>
              {team.visibility}
            </span>
          )}
        </div>
        {team.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">{team.description}</p>
        )}
        <div className="flex items-center gap-1.5 mt-auto pt-3 border-t border-gray-100 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
          <Link
            href={`/dashboard/board/${team.id}`}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
            {t.dashboard.viewBoard}
          </Link>
          <Link
            href={`/dashboard/space/${team.id}`}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Office
          </Link>
        </div>
      </div>
    </div>
  );
}

function TeamSection({
  teams,
  title,
  icon,
  emptyText,
  t,
  action,
  showVisibility,
  visibilityTabs,
}: {
  teams: Team[];
  title: string;
  icon: React.ReactNode;
  emptyText: string;
  t: Translations;
  action?: React.ReactNode;
  showVisibility?: boolean;
  visibilityTabs?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');

  const filtered = useMemo(() => {
    let result = teams;
    if (visibilityTabs && visibilityFilter !== 'all') {
      result = result.filter(tm => tm.visibility === visibilityFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        tm => tm.name.toLowerCase().includes(q) || tm.description?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [teams, search, visibilityFilter, visibilityTabs]);

  const handleTabChange = (tab: 'all' | 'public' | 'private') => {
    setVisibilityFilter(tab);
    setPage(1);
  };

  const totalPages = Math.ceil(filtered.length / TEAMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * TEAMS_PER_PAGE, page * TEAMS_PER_PAGE);

  const handleSearch = (q: string) => {
    setSearch(q);
    setPage(1);
  };

  return (
    <section>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold dark:text-white flex items-center gap-2">
          {icon}
          {title}
          <span className="text-xs font-normal text-gray-400">({teams.length})</span>
        </h3>
        <div className="flex items-center gap-3">
          {teams.length > 4 && (
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={t.dashboard.searchPlaceholder}
                className="w-48 sm:w-56 px-3 py-1.5 pl-8 text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow"
              />
            </div>
          )}
          {action}
        </div>
      </div>

      {/* Visibility tabs */}
      {visibilityTabs && teams.length > 0 && (
        <div className="flex gap-1 mb-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1 w-fit">
          {(['all', 'public', 'private'] as const).map((tab) => {
            const count = tab === 'all' ? teams.length : teams.filter(tm => tm.visibility === tab).length;
            const label = tab === 'all'
              ? `${t.dashboard.teams}`
              : tab === 'private'
                ? t.dashboard.privateTeams
                : t.dashboard.publicTeams;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => handleTabChange(tab)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  visibilityFilter === tab
                    ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {teams.length === 0 ? (
        <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
          <p className="text-sm text-gray-500 dark:text-gray-400">{emptyText}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t.dashboard.noTeamsFound}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t.dashboard.adjustSearch}</p>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginated.map((team) => (
              <TeamCard key={team.id} team={team} t={t} showVisibility={showVisibility} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {(page - 1) * TEAMS_PER_PAGE + 1}-{Math.min(page * TEAMS_PER_PAGE, filtered.length)} {t.dashboard.of} {filtered.length}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2.5 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {t.dashboard.previous}
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                      page === p
                        ? 'bg-purple-600 text-white'
                        : 'border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-2.5 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {t.dashboard.next}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [invitationCount, setInvitationCount] = useState(0);

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

  // Determine current user's ID from JWT
  const currentUserId = useMemo(() => {
    const token = getToken();
    if (!token) return null;
    const payload = parseTokenPayload(token);
    return payload?.user_id || payload?.agent_id || null;
  }, []);

  // Separate "my teams" (member/creator) from "community" (public, not mine)
  const { myTeams, communityTeams } = useMemo(() => {
    const mine: Team[] = [];
    const community: Team[] = [];

    for (const team of teams) {
      const isMember = team.members?.some(
        m => m.user_id === currentUserId || m.agent_id === currentUserId
      );
      const isCreator = team.created_by_user === currentUserId || team.created_by === currentUserId;

      if (isMember || isCreator) {
        mine.push(team);
      } else {
        community.push(team);
      }
    }

    return { myTeams: mine, communityTeams: community };
  }, [teams, currentUserId]);

  const hasAnyTeam = myTeams.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 py-3 sm:px-6 lg:px-8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🐝</span>
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                SwarmMind
              </h1>
            </div>
            <div className="flex items-center gap-1 sm:gap-3">
              <Link
                href="/dashboard/invitations"
                className="relative p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                title={t.dashboard.invitations}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                {invitationCount > 0 && (
                  <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full">
                    {invitationCount}
                  </span>
                )}
              </Link>
              <Link
                href="/dashboard/profile"
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Profile"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </Link>
              <span className="hidden sm:inline"><LangToggle /></span>
              <ThemeToggle />
              <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 hidden sm:block" />
              <button
                type="button"
                onClick={handleLogout}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                title={t.dashboard.logout}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
              </button>
            </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-purple-600 border-t-transparent"></div>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{t.dashboard.loadingTeams}</p>
          </div>
        ) : (
          <>
            {/* Welcome CTA - only when user has NO teams */}
            {!hasAnyTeam && (
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="w-full group"
              >
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 p-8 sm:p-10 text-left hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl">
                  <div className="relative z-10 flex items-center justify-between">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
                        {t.dashboard.createTeam}
                      </h2>
                      <p className="text-purple-100 text-sm sm:text-base">
                        {t.dashboard.startNewTeam}
                      </p>
                    </div>
                    <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                      <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </div>
                  </div>
                  <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/5" />
                  <div className="absolute -right-2 -bottom-8 w-24 h-24 rounded-full bg-white/5" />
                </div>
              </button>
            )}

            {/* ── My Teams ── */}
            <TeamSection
              teams={myTeams}
              title={t.dashboard.myTeams}
              emptyText={t.dashboard.noTeamsYet.replace('{tab}', '')}
              t={t}
              showVisibility
              visibilityTabs
              icon={
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              }
              action={
                hasAnyTeam ? (
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    {t.dashboard.createTeam}
                  </button>
                ) : undefined
              }
            />

            {/* ── Community ── */}
            <TeamSection
              teams={communityTeams}
              title={t.dashboard.community}
              emptyText={t.dashboard.noTeamsYet.replace('{tab}', t.dashboard.community.toLowerCase())}
              t={t}
              icon={
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
              }
            />
          </>
        )}
      </main>

      <CreateTeamModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onTeamCreated={fetchTeams}
      />
    </div>
  );
}
