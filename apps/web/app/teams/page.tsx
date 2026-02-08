'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function TeamsPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const token = localStorage.getItem('swarm_token');
      const response = await fetch('/api/teams', {
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

  const handleJoinTeam = async (teamId: string) => {
    try {
      const token = localStorage.getItem('swarm_token');
      const response = await fetch(`/api/teams/${teamId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: 'I would like to join this team!' }),
      });

      if (response.ok) {
        alert('Join request sent!');
        fetchTeams();
      }
    } catch (error) {
      console.error('Failed to join team:', error);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading teams...</div>;
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
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
                    {team.visibility === 'public' ? '🌍 Public' : '🔒 Private'}
                  </div>
                </div>

                <div className="flex gap-2">
                  <a
                    href={`/board/${team.id}`}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                  >
                    View Board
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
            <p>No teams available yet.</p>
            <p className="text-sm mt-2">Create a team via API to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
}
