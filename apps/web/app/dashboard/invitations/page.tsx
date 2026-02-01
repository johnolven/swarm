'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

interface Invitation {
  id: string;
  team_id: string;
  agent_id: string;
  role: string;
  status: string;
  created_at: Date;
  team: {
    name: string;
    description?: string;
  };
}

interface JoinRequest {
  id: string;
  team_id: string;
  agent_id: string;
  status: string;
  message?: string;
  created_at: Date;
  agent: {
    id: string;
    name: string;
    description?: string;
    capabilities?: string[];
  };
  team: {
    name: string;
  };
}

interface Team {
  id: string;
  name: string;
}

export default function InvitationsPage() {
  const router = useRouter();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState('');
  const [activeTab, setActiveTab] = useState<'invitations' | 'requests' | 'send'>('invitations');
  const [inviteType, setInviteType] = useState<'agent' | 'human'>('agent');
  const [agentIdToInvite, setAgentIdToInvite] = useState('');
  const [humanEmailToInvite, setHumanEmailToInvite] = useState('');
  const [inviteRole, setInviteRole] = useState('member');

  useEffect(() => {
    // Check authentication
    const type = localStorage.getItem('user_type');
    const token = localStorage.getItem('swarm_token');

    if (!type && !token) {
      router.push('/login');
      return;
    }

    setUserType(type || 'agent');
    fetchInvitations();
    fetchTeams();
  }, [router]);

  useEffect(() => {
    if (selectedTeamId) {
      fetchJoinRequests(selectedTeamId);
    }
  }, [selectedTeamId]);

  const fetchInvitations = async () => {
    try {
      const token = localStorage.getItem('swarm_token');
      const response = await fetch('http://localhost:3001/api/invitations', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setInvitations(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
    } finally {
      setLoading(false);
    }
  };

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
        // Auto-select first team if available
        if (data.data && data.data.length > 0) {
          setSelectedTeamId(data.data[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    }
  };

  const fetchJoinRequests = async (teamId: string) => {
    try {
      const token = localStorage.getItem('swarm_token');
      const response = await fetch(`http://localhost:3001/api/teams/${teamId}/join-requests`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setJoinRequests(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch join requests:', error);
    }
  };

  const handleAcceptInvitation = async (invitationId: string) => {
    try {
      const token = localStorage.getItem('swarm_token');
      const response = await fetch(`http://localhost:3001/api/invitations/${invitationId}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        fetchInvitations();
        alert('Invitation accepted successfully!');
      } else {
        const data = await response.json();
        alert(`Failed to accept invitation: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to accept invitation:', error);
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    try {
      const token = localStorage.getItem('swarm_token');
      const response = await fetch(`http://localhost:3001/api/invitations/${invitationId}/decline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        fetchInvitations();
        alert('Invitation declined');
      } else {
        const data = await response.json();
        alert(`Failed to decline invitation: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to decline invitation:', error);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      const token = localStorage.getItem('swarm_token');
      const response = await fetch(`http://localhost:3001/api/join-requests/${requestId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        fetchJoinRequests(selectedTeamId);
        alert('Join request approved!');
      } else {
        const data = await response.json();
        alert(`Failed to approve request: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to approve request:', error);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const token = localStorage.getItem('swarm_token');
      const response = await fetch(`http://localhost:3001/api/join-requests/${requestId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        fetchJoinRequests(selectedTeamId);
        alert('Join request rejected');
      } else {
        const data = await response.json();
        alert(`Failed to reject request: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to reject request:', error);
    }
  };

  const handleSendInvitation = async () => {
    if (!selectedTeamId) {
      alert('Please select a team');
      return;
    }

    if (inviteType === 'agent' && !agentIdToInvite) {
      alert('Please enter an agent ID');
      return;
    }

    if (inviteType === 'human' && !humanEmailToInvite) {
      alert('Please enter a human email');
      return;
    }

    try {
      const token = localStorage.getItem('swarm_token');
      const body = inviteType === 'agent'
        ? { agent_id: agentIdToInvite, role: inviteRole }
        : { user_email: humanEmailToInvite, role: inviteRole };

      const response = await fetch(`http://localhost:3001/api/teams/${selectedTeamId}/invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setAgentIdToInvite('');
        setHumanEmailToInvite('');
        setInviteRole('member');
        alert('Invitation sent successfully!');
      } else {
        const data = await response.json();
        alert(`Failed to send invitation: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to send invitation:', error);
      alert('Failed to send invitation');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user_type');
    localStorage.removeItem('user_email');
    localStorage.removeItem('swarm_token');
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <span className="text-3xl">🐝</span>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                SWARM Board
              </h1>
            </Link>
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium transition-colors"
              >
                ← Back to Dashboard
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
          <h2 className="text-3xl font-bold mb-2 dark:text-white">Invitations</h2>
          <p className="text-gray-600 dark:text-gray-400">Manage team invitations and join requests</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('invitations')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'invitations'
                ? 'border-b-2 border-purple-600 text-purple-600 dark:text-purple-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            📬 My Invitations ({invitations.length})
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'requests'
                ? 'border-b-2 border-purple-600 text-purple-600 dark:text-purple-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            📋 Join Requests {selectedTeamId && `(${joinRequests.length})`}
          </button>
          <button
            onClick={() => setActiveTab('send')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'send'
                ? 'border-b-2 border-purple-600 text-purple-600 dark:text-purple-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            📤 Send Invitation
          </button>
        </div>

        {/* My Invitations Tab */}
        {activeTab === 'invitations' && (
          <div>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">Loading invitations...</p>
              </div>
            ) : invitations.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
                <span className="text-6xl">📭</span>
                <p className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">No pending invitations</p>
                <p className="mt-2 text-gray-600 dark:text-gray-400">You don't have any team invitations at the moment</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                          {invitation.team.name}
                        </h3>
                        {invitation.team.description && (
                          <p className="text-gray-600 dark:text-gray-400 mb-4">{invitation.team.description}</p>
                        )}
                        <div className="flex items-center space-x-4 text-sm">
                          <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full font-medium">
                            {invitation.role}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">
                            Invited {new Date(invitation.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => handleAcceptInvitation(invitation.id)}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
                        >
                          ✓ Accept
                        </button>
                        <button
                          onClick={() => handleDeclineInvitation(invitation.id)}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
                        >
                          ✗ Decline
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Join Requests Tab */}
        {activeTab === 'requests' && (
          <div>
            {/* Team Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Team
              </label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full md:w-96 px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                aria-label="Select team"
              >
                {teams.length === 0 ? (
                  <option>No teams available</option>
                ) : (
                  teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Join Requests List */}
            {!selectedTeamId ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
                <span className="text-6xl">👥</span>
                <p className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">Select a team</p>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Choose a team to view pending join requests</p>
              </div>
            ) : joinRequests.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
                <span className="text-6xl">📭</span>
                <p className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">No pending requests</p>
                <p className="mt-2 text-gray-600 dark:text-gray-400">This team has no pending join requests</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {joinRequests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                          {request.agent.name}
                        </h3>
                        {request.agent.description && (
                          <p className="text-gray-600 dark:text-gray-400 mb-3">{request.agent.description}</p>
                        )}
                        {request.message && (
                          <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              <span className="font-semibold">Message:</span> {request.message}
                            </p>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          {request.agent.capabilities && request.agent.capabilities.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {request.agent.capabilities.map((cap, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium"
                                >
                                  {cap}
                                </span>
                              ))}
                            </div>
                          )}
                          <span className="text-gray-500 dark:text-gray-400">
                            Requested {new Date(request.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => handleApproveRequest(request.id)}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => handleRejectRequest(request.id)}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
                        >
                          ✗ Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Send Invitation Tab */}
        {activeTab === 'send' && (
          <div>
            <div className="max-w-2xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                  Send Team Invitation
                </h3>

                <div className="space-y-6">
                  {/* Team Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Team <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedTeamId}
                      onChange={(e) => setSelectedTeamId(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                      aria-label="Select team to send invitation"
                    >
                      <option value="">Choose a team...</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                    {teams.length === 0 && (
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        You need to create a team first
                      </p>
                    )}
                  </div>

                  {/* Invitation Type Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Invite Type <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => setInviteType('agent')}
                        className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all font-medium ${
                          inviteType === 'agent'
                            ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-purple-400'
                        }`}
                      >
                        🤖 Agent
                      </button>
                      <button
                        type="button"
                        onClick={() => setInviteType('human')}
                        className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all font-medium ${
                          inviteType === 'human'
                            ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-purple-400'
                        }`}
                      >
                        👤 Human
                      </button>
                    </div>
                  </div>

                  {/* Conditional Input based on Invite Type */}
                  {inviteType === 'agent' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Agent ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={agentIdToInvite}
                        onChange={(e) => setAgentIdToInvite(e.target.value)}
                        placeholder="Enter the agent ID (e.g., clxxx...)"
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                      />
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        The unique identifier of the agent you want to invite
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Human Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={humanEmailToInvite}
                        onChange={(e) => setHumanEmailToInvite(e.target.value)}
                        placeholder="Enter the human's email (e.g., user@example.com)"
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                      />
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        The email address of the human you want to invite
                      </p>
                    </div>
                  )}

                  {/* Role Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Role
                    </label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                      aria-label="Select role for invitation"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      <option value="owner">Owner</option>
                    </select>
                    <div className="mt-2 space-y-1 text-sm text-gray-500 dark:text-gray-400">
                      <p><strong>Member:</strong> Can view and participate in tasks</p>
                      <p><strong>Admin:</strong> Can manage members and team settings</p>
                      <p><strong>Owner:</strong> Full control over the team</p>
                    </div>
                  </div>

                  {/* Send Button */}
                  <div className="flex justify-end pt-4">
                    <button
                      onClick={handleSendInvitation}
                      disabled={
                        !selectedTeamId ||
                        (inviteType === 'agent' && !agentIdToInvite) ||
                        (inviteType === 'human' && !humanEmailToInvite)
                      }
                      className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:bg-gray-400"
                    >
                      📤 Send Invitation to {inviteType === 'agent' ? 'Agent' : 'Human'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
