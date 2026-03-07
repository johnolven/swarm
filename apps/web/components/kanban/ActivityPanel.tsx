'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { useLanguage } from '@/components/LanguageProvider';
import { getToken } from '@/lib/auth';

interface ActivityEntry {
  id: string;
  actor_name: string;
  actor_type: string;
  action: string;
  entity_type: string;
  entity_name: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

const activityFetcher = async (url: string) => {
  const token = getToken();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch activity');
  return res.json();
};

function formatTimeAgo(dateStr: string, t: any): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return t.activity.justNow;
  if (diffMin < 60) return t.activity.minutesAgo.replace('{n}', String(diffMin));
  if (diffHr < 24) return t.activity.hoursAgo.replace('{n}', String(diffHr));
  return t.activity.daysAgo.replace('{n}', String(diffDay));
}

function getActionIcon(action: string): string {
  if (action.includes('created')) return '+';
  if (action.includes('deleted')) return '\u00d7';
  if (action.includes('updated')) return '\u270e';
  if (action.includes('moved')) return '\u2192';
  if (action.includes('claimed')) return '\u2713';
  if (action.includes('completed')) return '\u2605';
  if (action.includes('assigned')) return '\u2190';
  if (action.includes('invited') || action.includes('joined') || action.includes('approved')) return '\u2795';
  if (action.includes('removed') || action.includes('rejected') || action.includes('declined')) return '\u2212';
  if (action.includes('unclaimed')) return '\u21ba';
  if (action.includes('collaboration')) return '\u{1f91d}';
  return '\u2022';
}

function getActionColor(action: string): string {
  if (action.includes('created')) return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
  if (action.includes('deleted') || action.includes('removed') || action.includes('rejected') || action.includes('declined')) return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
  if (action.includes('completed')) return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400';
  if (action.includes('moved') || action.includes('updated') || action.includes('reordered')) return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
  return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400';
}

interface ActivityPanelProps {
  teamId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ActivityPanel({ teamId, isOpen, onClose }: ActivityPanelProps) {
  const { t } = useLanguage();
  const [allActivities, setAllActivities] = useState<ActivityEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);

  const { data, error, isLoading } = useSWR(
    isOpen ? `/api/teams/${teamId}/activity?limit=50` : null,
    activityFetcher,
    { revalidateOnFocus: false, refreshInterval: 30000 }
  );

  const activities: ActivityEntry[] = data?.data || [];
  const displayActivities = allActivities.length > 0 ? allActivities : activities;

  const resolveAction = (entry: ActivityEntry): string => {
    const parts = entry.action.split('.');
    let resolved: any = t;
    for (const part of parts) {
      resolved = resolved?.[part];
    }
    return typeof resolved === 'string' ? resolved : entry.action.replace('activity.', '');
  };

  const loadMore = async () => {
    if (!cursor && activities.length > 0) {
      const lastDate = activities[activities.length - 1].created_at;
      try {
        const token = getToken();
        const res = await fetch(`/api/teams/${teamId}/activity?limit=50&cursor=${lastDate}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await res.json();
        if (result.success) {
          setAllActivities([...activities, ...result.data]);
          setCursor(result.nextCursor);
        }
      } catch { /* ignore */ }
    } else if (cursor) {
      try {
        const token = getToken();
        const res = await fetch(`/api/teams/${teamId}/activity?limit=50&cursor=${cursor}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await res.json();
        if (result.success) {
          setAllActivities([...displayActivities, ...result.data]);
          setCursor(result.nextCursor);
        }
      } catch { /* ignore */ }
    }
  };

  const hasMore = cursor !== null || (data?.nextCursor !== null && data?.nextCursor !== undefined);

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t.activity.title}
        </h2>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Activity list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8 text-sm">
            {t.activity.loading}
          </div>
        )}

        {error && (
          <div className="text-center text-red-500 py-8 text-sm">
            {t.activity.error}
          </div>
        )}

        {!isLoading && !error && displayActivities.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8 text-sm">
            {t.activity.empty}
          </div>
        )}

        {displayActivities.map((entry) => (
          <div key={entry.id} className="flex gap-3 text-sm">
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${getActionColor(entry.action)}`}>
              {getActionIcon(entry.action)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-800 dark:text-gray-200 leading-snug">
                <span className="font-semibold">{entry.actor_name}</span>
                {' '}
                <span className="text-gray-600 dark:text-gray-400">
                  {resolveAction(entry)}
                </span>
                {entry.entity_name && (
                  <>
                    {' '}
                    <span className="font-medium text-gray-900 dark:text-gray-100">{entry.entity_name}</span>
                  </>
                )}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {formatTimeAgo(entry.created_at, t)}
              </p>
            </div>
          </div>
        ))}

        {/* Load more */}
        {hasMore && displayActivities.length > 0 && (
          <button
            onClick={loadMore}
            className="w-full py-2 text-sm text-purple-600 dark:text-purple-400 hover:underline"
          >
            {t.activity.loadMore}
          </button>
        )}
      </div>
    </div>
  );
}
