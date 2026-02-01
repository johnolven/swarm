'use client';

import { useState } from 'react';

const API_URL = 'http://localhost:3001/api';

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('agents');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Form states
  const [agentName, setAgentName] = useState('test-agent-' + Math.random().toString(36).substring(7));
  const [agentCapabilities, setAgentCapabilities] = useState('research,analysis,coding');
  const [agentPersonality, setAgentPersonality] = useState('Helpful and efficient');
  const [teamName, setTeamName] = useState('My Test Team');
  const [teamVisibility, setTeamVisibility] = useState('public');
  const [taskTitle, setTaskTitle] = useState('Write blog post');
  const [taskCapabilities, setTaskCapabilities] = useState('writing,research');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');

  const getToken = () => localStorage.getItem('swarm_token') || '';
  const setToken = (token: string) => localStorage.setItem('swarm_token', token);

  const apiCall = async (method: string, endpoint: string, body?: any, requireAuth = true) => {
    setLoading(true);
    try {
      const headers: any = {
        'Content-Type': 'application/json',
      };

      if (requireAuth) {
        const token = getToken();
        if (!token) {
          setResponse({ error: 'No token found. Register an agent first!' });
          return;
        }
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await res.json();
      setResponse({ status: res.status, data });

      // Save token if registering
      if (endpoint === '/agents/register' && data.data?.api_token) {
        setToken(data.data.api_token);
      }

      // Notify Board when task is created/updated
      if (res.ok && endpoint.includes('/tasks')) {
        window.dispatchEvent(new CustomEvent('task-updated'));
      }
    } catch (error: any) {
      setResponse({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'agents', label: '🤖 Agents' },
    { id: 'teams', label: '👥 Teams' },
    { id: 'tasks', label: '📋 Tasks' },
    { id: 'invitations', label: '✉️ Invitations' },
    { id: 'messages', label: '💬 Messages' },
  ];

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 bg-purple-600 text-white p-4 rounded-full shadow-lg hover:bg-purple-700 transition-all hover:scale-110"
        title="Debug Panel"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* Debug Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black bg-opacity-50" onClick={() => setIsOpen(false)}>
          <div
            className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white dark:bg-gray-900 shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-purple-600 text-white p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">🔧 API Debug Panel</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            {/* Token Status */}
            <div className="p-4 bg-gray-100 dark:bg-gray-800 text-sm">
              <div className="font-semibold mb-1">🔑 Auth Token:</div>
              <div className="font-mono text-xs break-all">
                {getToken() || '❌ No token (register an agent first)'}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 font-medium whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-b-2 border-purple-600 text-purple-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="p-4">
              {/* AGENTS TAB */}
              {activeTab === 'agents' && (
                <div className="space-y-4">
                  <div className="border rounded p-4">
                    <h3 className="font-bold mb-3">📝 Register Agent</h3>
                    <input
                      className="w-full p-2 border rounded mb-2"
                      placeholder="Agent Name"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                    />
                    <input
                      className="w-full p-2 border rounded mb-2"
                      placeholder="Capabilities (comma-separated)"
                      value={agentCapabilities}
                      onChange={(e) => setAgentCapabilities(e.target.value)}
                    />
                    <input
                      className="w-full p-2 border rounded mb-2"
                      placeholder="Personality"
                      value={agentPersonality}
                      onChange={(e) => setAgentPersonality(e.target.value)}
                    />
                    <button
                      onClick={() =>
                        apiCall('POST', '/agents/register', {
                          name: agentName,
                          capabilities: agentCapabilities.split(',').map((s) => s.trim()),
                          personality: agentPersonality,
                        }, false)
                      }
                      className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600"
                    >
                      Register Agent
                    </button>
                  </div>

                  <div className="border rounded p-4">
                    <h3 className="font-bold mb-3">👀 Get All Agents</h3>
                    <button
                      onClick={() => apiCall('GET', '/agents')}
                      className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
                    >
                      Fetch All Agents
                    </button>
                  </div>

                  <div className="border rounded p-4">
                    <h3 className="font-bold mb-3">🔍 Search by Capabilities</h3>
                    <input
                      className="w-full p-2 border rounded mb-2"
                      placeholder="Capabilities (comma-separated)"
                      defaultValue="research,analysis"
                    />
                    <button
                      onClick={() => apiCall('GET', '/agents/search/capabilities?capabilities=research,analysis')}
                      className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
                    >
                      Search Agents
                    </button>
                  </div>
                </div>
              )}

              {/* TEAMS TAB */}
              {activeTab === 'teams' && (
                <div className="space-y-4">
                  <div className="border rounded p-4">
                    <h3 className="font-bold mb-3">➕ Create Team</h3>
                    <input
                      className="w-full p-2 border rounded mb-2"
                      placeholder="Team Name"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                    />
                    <select
                      className="w-full p-2 border rounded mb-2"
                      value={teamVisibility}
                      onChange={(e) => setTeamVisibility(e.target.value)}
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                    </select>
                    <button
                      onClick={() =>
                        apiCall('POST', '/teams', {
                          name: teamName,
                          description: 'Created via debug panel',
                          visibility: teamVisibility,
                          auto_accept: true,
                        })
                      }
                      className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600"
                    >
                      Create Team
                    </button>
                  </div>

                  <div className="border rounded p-4">
                    <h3 className="font-bold mb-3">👀 Get All Teams</h3>
                    <button
                      onClick={() => apiCall('GET', '/teams')}
                      className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
                    >
                      Fetch All Teams
                    </button>
                  </div>

                  <div className="border rounded p-4">
                    <h3 className="font-bold mb-3">🚪 Join Team</h3>
                    <input
                      className="w-full p-2 border rounded mb-2"
                      placeholder="Team ID"
                      value={selectedTeamId}
                      onChange={(e) => setSelectedTeamId(e.target.value)}
                    />
                    <button
                      onClick={() =>
                        apiCall('POST', `/teams/${selectedTeamId}/join`, {
                          message: 'I want to join!',
                        })
                      }
                      className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600"
                    >
                      Request to Join
                    </button>
                  </div>
                </div>
              )}

              {/* TASKS TAB */}
              {activeTab === 'tasks' && (
                <div className="space-y-4">
                  <div className="border rounded p-4">
                    <h3 className="font-bold mb-3">➕ Create Task</h3>
                    <input
                      className="w-full p-2 border rounded mb-2"
                      placeholder="Team ID"
                      value={selectedTeamId}
                      onChange={(e) => setSelectedTeamId(e.target.value)}
                    />
                    <input
                      className="w-full p-2 border rounded mb-2"
                      placeholder="Task Title"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                    />
                    <input
                      className="w-full p-2 border rounded mb-2"
                      placeholder="Required Capabilities"
                      value={taskCapabilities}
                      onChange={(e) => setTaskCapabilities(e.target.value)}
                    />
                    <button
                      onClick={() =>
                        apiCall('POST', `/teams/${selectedTeamId}/tasks`, {
                          title: taskTitle,
                          description: 'Created via debug panel',
                          required_capabilities: taskCapabilities.split(',').map((s) => s.trim()),
                          priority: 'medium',
                        })
                      }
                      className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600"
                    >
                      Create Task
                    </button>
                  </div>

                  <div className="border rounded p-4">
                    <h3 className="font-bold mb-3">👀 Get Team Tasks</h3>
                    <input
                      className="w-full p-2 border rounded mb-2"
                      placeholder="Team ID"
                      value={selectedTeamId}
                      onChange={(e) => setSelectedTeamId(e.target.value)}
                    />
                    <button
                      onClick={() => apiCall('GET', `/teams/${selectedTeamId}/tasks`)}
                      className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
                    >
                      Fetch Tasks
                    </button>
                  </div>

                  <div className="border rounded p-4">
                    <h3 className="font-bold mb-3">✋ Claim Task</h3>
                    <input
                      className="w-full p-2 border rounded mb-2"
                      placeholder="Task ID"
                      value={selectedTaskId}
                      onChange={(e) => setSelectedTaskId(e.target.value)}
                    />
                    <button
                      onClick={() =>
                        apiCall('POST', `/tasks/${selectedTaskId}/claim`, {
                          message: 'I can do this!',
                        })
                      }
                      className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600"
                    >
                      Claim Task
                    </button>
                  </div>

                  <div className="border rounded p-4">
                    <h3 className="font-bold mb-3">✅ Complete Task</h3>
                    <input
                      className="w-full p-2 border rounded mb-2"
                      placeholder="Task ID"
                      value={selectedTaskId}
                      onChange={(e) => setSelectedTaskId(e.target.value)}
                    />
                    <button
                      onClick={() => apiCall('POST', `/tasks/${selectedTaskId}/complete`, {})}
                      className="w-full bg-purple-500 text-white p-2 rounded hover:bg-purple-600"
                    >
                      Complete Task
                    </button>
                  </div>
                </div>
              )}

              {/* INVITATIONS TAB */}
              {activeTab === 'invitations' && (
                <div className="space-y-4">
                  <div className="border rounded p-4">
                    <h3 className="font-bold mb-3">📬 Get My Invitations</h3>
                    <button
                      onClick={() => apiCall('GET', '/invitations')}
                      className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
                    >
                      Fetch Invitations
                    </button>
                  </div>
                </div>
              )}

              {/* MESSAGES TAB */}
              {activeTab === 'messages' && (
                <div className="space-y-4">
                  <div className="border rounded p-4">
                    <h3 className="font-bold mb-3">💬 Get Task Messages</h3>
                    <input
                      className="w-full p-2 border rounded mb-2"
                      placeholder="Task ID"
                      value={selectedTaskId}
                      onChange={(e) => setSelectedTaskId(e.target.value)}
                    />
                    <button
                      onClick={() => apiCall('GET', `/tasks/${selectedTaskId}/messages`)}
                      className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
                    >
                      Fetch Messages
                    </button>
                  </div>

                  <div className="border rounded p-4">
                    <h3 className="font-bold mb-3">✍️ Send Message</h3>
                    <input
                      className="w-full p-2 border rounded mb-2"
                      placeholder="Task ID"
                      value={selectedTaskId}
                      onChange={(e) => setSelectedTaskId(e.target.value)}
                    />
                    <textarea
                      className="w-full p-2 border rounded mb-2"
                      placeholder="Message content"
                      rows={3}
                    />
                    <button
                      onClick={() =>
                        apiCall('POST', `/tasks/${selectedTaskId}/messages`, {
                          content: 'Test message from debug panel',
                        })
                      }
                      className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600"
                    >
                      Send Message
                    </button>
                  </div>
                </div>
              )}

              {/* Response Display */}
              {response && (
                <div className="mt-6 border rounded p-4 bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold">📡 Response:</h3>
                    <button
                      onClick={() => setResponse(null)}
                      className="text-sm text-red-500 hover:text-red-700"
                    >
                      Clear
                    </button>
                  </div>
                  <pre className="text-xs overflow-x-auto bg-black text-green-400 p-3 rounded">
                    {JSON.stringify(response, null, 2)}
                  </pre>
                </div>
              )}

              {loading && (
                <div className="mt-4 text-center text-blue-500">
                  ⏳ Loading...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
