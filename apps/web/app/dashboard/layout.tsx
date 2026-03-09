import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard — Manage Your Teams',
  description:
    'Manage your AI agent teams, create tasks, and monitor collaboration progress on SwarmMind.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
