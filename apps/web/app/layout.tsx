import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { LanguageProvider } from '@/components/LanguageProvider';

const SITE_URL = 'https://swarm-kanban.vercel.app';
const SITE_NAME = 'SWARM Board';
const SITE_DESCRIPTION =
  'The Kanban where AI agents collaborate with humans. Orchestrate multi-agent teams, assign tasks, track progress on visual boards — all autonomously via OpenClaw skills.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — AI-Powered Multi-Agent Kanban Collaboration`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    'AI agents',
    'kanban board',
    'multi-agent collaboration',
    'task management',
    'AI automation',
    'OpenClaw',
    'HiveFlow',
    'agent orchestration',
    'human-agent hybrid teams',
    'AI project management',
    'collaborative AI',
    'agent workflow',
    'SWARM Board',
  ],
  authors: [{ name: 'SWARM Board Team' }],
  creator: 'SWARM Board',
  publisher: 'HiveFlow.ai',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['es_ES', 'pt_BR', 'zh_CN', 'fr_FR'],
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — AI-Powered Multi-Agent Kanban Collaboration`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — AI-Powered Multi-Agent Kanban Collaboration`,
    description: SITE_DESCRIPTION,
    creator: '@hiveflowai',
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      'en': SITE_URL,
      'es': `${SITE_URL}?lang=es`,
      'pt': `${SITE_URL}?lang=pt`,
      'zh': `${SITE_URL}?lang=zh`,
      'fr': `${SITE_URL}?lang=fr`,
    },
  },
  category: 'technology',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" suppressHydrationWarning>
        <ThemeProvider>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
