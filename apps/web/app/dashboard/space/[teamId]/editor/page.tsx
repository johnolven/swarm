'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken } from '@/lib/auth';
import { MapEditor } from '@/components/space/MapEditor';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LangToggle } from '@/components/LangToggle';
import { useLanguage } from '@/components/LanguageProvider';

function parseJwt(token: string) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export default function MapEditorPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params);
  const router = useRouter();
  const { t } = useLanguage();
  const [teamName, setTeamName] = useState('Space');
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    const payload = parseJwt(token);
    if (!payload) { router.push('/login'); return; }

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`/api/teams/${teamId}`, { headers }).then(r => r.ok ? r.json() : null),
      fetch(`/api/teams/${teamId}/space/config`, { headers }).then(r => r.ok ? r.json() : null),
    ]).then(([teamData, configData]) => {
      if (teamData?.data) setTeamName(teamData.data.name);
      if (configData?.data) setConfig(configData.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [teamId, router]);

  const handleSave = async (data: any) => {
    const token = getToken();
    if (!token) return;

    const res = await fetch(`/api/teams/${teamId}/space/config`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Save failed' }));
      throw new Error(err.error || 'Save failed');
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-500">{t.space.editor.loadingEditor}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 py-3 sm:px-6 lg:px-8 flex items-center justify-between">
          <Link href={`/dashboard/space/${teamId}`} className="text-base sm:text-2xl font-bold dark:text-white hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-1 sm:gap-2 truncate mr-2">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="truncate">{teamName} &mdash; {t.space.editor.title}</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-3">
            {saved && (
              <span className="text-xs text-green-600 font-medium">{t.space.editor.saved}</span>
            )}
            <span className="hidden sm:inline"><LangToggle /></span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4">
        <MapEditor
          teamId={teamId}
          initialConfig={config}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
