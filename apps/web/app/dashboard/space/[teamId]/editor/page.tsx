'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken } from '@/lib/auth';
import { MapEditor } from '@/components/space/MapEditor';
import { ThemeToggle } from '@/components/ThemeToggle';

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
        <div className="text-gray-500">Loading editor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Link
              href={`/dashboard/space/${teamId}`}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              &larr; Space
            </Link>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <h1 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {teamName} &mdash; Map Editor
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="text-xs text-green-600 font-medium">Saved!</span>
            )}
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
