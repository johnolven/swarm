'use client';

import { UserPresence } from './types';

interface PresenceListProps {
  users: UserPresence[];
}

const stateColors: Record<string, string> = {
  idle: 'bg-green-500',
  walking: 'bg-green-400',
  working: 'bg-yellow-500',
  chatting: 'bg-blue-500',
  afk: 'bg-gray-400',
};

export function PresenceList({ users }: PresenceListProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
        Online ({users.length})
      </h3>
      <div className="space-y-1.5 max-h-60 overflow-y-auto">
        {users.map((user) => (
          <div
            key={user.id}
            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <span
              className={`w-2 h-2 rounded-full ${stateColors[user.state] || 'bg-gray-400'}`}
            />
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold"
              style={{ backgroundColor: user.avatar.color }}
            >
              {user.type === 'agent' ? 'A' : 'U'}
            </span>
            <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
              {user.name}
            </span>
            {user.current_zone && (
              <span className="text-[10px] text-gray-400 ml-auto truncate">
                {user.current_zone}
              </span>
            )}
          </div>
        ))}
        {users.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-2">No one online</p>
        )}
      </div>
    </div>
  );
}
