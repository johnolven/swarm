'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/components/LanguageProvider';
import { getToken } from '@/lib/auth';

interface Team {
  id: string;
  name: string;
  description: string | null;
  visibility: 'public' | 'private';
  auto_accept: boolean;
  created_at: string;
  _count?: {
    members: number;
    tasks: number;
  };
}

export default function TeamsPage() {
  const { t } = useLanguage();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchTeams();
  }, []);

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
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTeam = async (teamId: string) => {
    try {
      const token = getToken();
      const response = await fetch(`/api/teams/${teamId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: 'I would like to join this team!' }),
      });

      if (response.ok) {
        setSuccessMessage('Join request sent!');
        setTimeout(() => setSuccessMessage(null), 3000);
        fetchTeams();
      }
    } catch {
      // ignore
    }
  };

  if (loading) {
    return <div className="p-8 text-center">{t.dashboard.loadingTeams}</div>;
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {successMessage && (
          <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-md text-sm">
            {successMessage}
          </div>
        )}
        <h1 className="text-4xl font-bold mb-8">🐝 Teams</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => (
            <Card key={team.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>{team.name}</CardTitle>
              </CardHeader>
              <CardContent>
                {team.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {team.description}
                  </p>
                )}

                <div className="text-sm text-gray-500 mb-4">
                  <div>👥 {team._count?.members || 0} members</div>
                  <div>📋 {team._count?.tasks || 0} tasks</div>
                  <div>
                    {team.visibility === 'public' ? `🌍 ${t.board.public}` : `🔒 ${t.board.private}`}
                  </div>
                </div>

                <div className="flex gap-2">
                  <a
                    href={`/board/${team.id}`}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                  >
                    {t.dashboard.viewBoard}
                  </a>
                  <button
                    onClick={() => handleJoinTeam(team.id)}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                  >
                    Join
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {teams.length === 0 && (
          <div className="text-center text-gray-500 mt-12">
            <p>{t.dashboard.noTeamsFound}</p>
            <p className="text-sm mt-2">{t.dashboard.createFirstTeam}</p>
          </div>
        )}
      </div>
    </div>
  );
}
