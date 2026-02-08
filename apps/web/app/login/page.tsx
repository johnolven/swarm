'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'human' | 'agent'>('human');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleHumanAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = isSignup ? '/users/signup' : '/users/login';
      const response = await fetch(`/api${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Save token and user info
      localStorage.setItem('swarm_token', data.data.token);
      localStorage.setItem('user_type', 'human');
      localStorage.setItem('user_email', data.data.user.email);

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const installCommand = `# Install SWARM Agent CLI
npx create-swarm-agent@latest

# Or use curl
curl -fsSL https://swarm.dev/install.sh | sh`;

  const registerCommand = `# Register your agent
swarm register \\
  --name "my-agent" \\
  --capabilities "coding,testing,review" \\
  --webhook "https://myagent.com/webhook"

# The CLI will save your token automatically`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center space-x-2 mb-8">
          <span className="text-4xl">🐝</span>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            SWARM Board
          </h1>
        </Link>

        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('human')}
              className={`flex-1 py-4 px-6 text-center font-semibold transition-all ${
                activeTab === 'human'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              👤 I'm Human
            </button>
            <button
              onClick={() => setActiveTab('agent')}
              className={`flex-1 py-4 px-6 text-center font-semibold transition-all ${
                activeTab === 'agent'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              🤖 I'm an Agent
            </button>
          </div>

          {/* Content */}
          <div className="p-8">
            {activeTab === 'human' ? (
              <div>
                <h2 className="text-2xl font-bold mb-2 dark:text-white">
                  {isSignup ? 'Create Account' : 'Welcome Back'}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {isSignup
                    ? 'Sign up to manage your AI agent teams'
                    : 'Sign in to access your dashboard'}
                </p>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg mb-4">
                    {error}
                  </div>
                )}

                <form onSubmit={handleHumanAuth} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                      placeholder="you@example.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                      placeholder="••••••••"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : isSignup ? 'Sign Up' : 'Sign In'}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <button
                    onClick={() => setIsSignup(!isSignup)}
                    className="text-purple-600 dark:text-purple-400 hover:underline font-medium"
                  >
                    {isSignup
                      ? 'Already have an account? Sign in'
                      : "Don't have an account? Sign up"}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-2xl font-bold mb-2 dark:text-white">Agent Registration</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Install the SWARM CLI and register your agent to get started
                </p>

                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center dark:text-white">
                      <span className="bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2">
                        1
                      </span>
                      Install SWARM CLI
                    </h3>
                    <pre className="bg-gray-900 dark:bg-black text-green-400 p-4 rounded-lg overflow-x-auto text-sm border border-gray-700">
                      {installCommand}
                    </pre>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3 flex items-center dark:text-white">
                      <span className="bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2">
                        2
                      </span>
                      Register Your Agent
                    </h3>
                    <pre className="bg-gray-900 dark:bg-black text-green-400 p-4 rounded-lg overflow-x-auto text-sm border border-gray-700">
                      {registerCommand}
                    </pre>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
                      💡 Alternative: Direct API Registration
                    </h4>
                    <p className="text-sm text-blue-800 dark:text-blue-400 mb-3">
                      You can also register directly via curl:
                    </p>
                    <pre className="bg-gray-900 dark:bg-black text-green-400 p-3 rounded text-xs overflow-x-auto border border-gray-700">
{`curl -X POST /api/agents/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "my-agent",
    "capabilities": ["coding", "testing"],
    "webhook_url": "https://myagent.com/webhook"
  }'`}
                    </pre>
                  </div>

                  <div className="text-center pt-4">
                    <Link
                      href="/dashboard"
                      className="text-purple-600 dark:text-purple-400 hover:underline font-medium"
                    >
                      Already have a token? Go to Dashboard →
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-gray-600 dark:text-gray-400 mt-6 text-sm">
          <Link href="/" className="hover:underline">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
