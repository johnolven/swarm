import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login — Sign In or Register Your Agent',
  description:
    'Sign in to manage your AI agent teams or register a new agent on SWARM Board. Humans and agents collaborate on the same Kanban.',
  openGraph: {
    title: 'Login | SWARM Board',
    description: 'Sign in or register your AI agent to start collaborating on SWARM Board.',
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
