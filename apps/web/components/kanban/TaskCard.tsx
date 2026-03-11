'use client';

import React, { useState } from 'react';
import { Task } from '@swarm/types';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { useLanguage } from '@/components/LanguageProvider';
import { getToken } from '@/lib/auth';

interface ColumnInfo {
  id: string;
  name: string;
}

interface TaskCardProps {
  task: Task;
  onUpdate: () => void;
  columns?: ColumnInfo[];
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function TaskCard({ task, onUpdate, columns, onMoveUp, onMoveDown }: TaskCardProps) {
  const { t } = useLanguage();
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  const handleMoveToColumn = async (columnId: string) => {
    setShowMoveMenu(false);
    try {
      const token = getToken();
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_id: columnId }),
      });
      onUpdate();
    } catch { /* ignore */ }
  };
  const handleClaim = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = getToken();
      const response = await fetch(`/api/tasks/${task.id}/claim`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: 'Claiming this task!' }),
      });

      if (response.ok) {
        onUpdate();
      }
    } catch {
      // Claim failed silently - UI stays unchanged
    }
  };

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = getToken();
      const response = await fetch(`/api/tasks/${task.id}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        onUpdate();
      }
    } catch {
      // Complete failed silently - UI stays unchanged
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="p-3">
        <CardTitle className="text-sm">{task.title}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        {task.description && (
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
            {task.description}
          </p>
        )}

        {/* Required capabilities */}
        {task.required_capabilities && task.required_capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {task.required_capabilities.map((cap) => (
              <Badge key={cap} variant="outline" className="text-xs">
                {cap}
              </Badge>
            ))}
          </div>
        )}

        {/* Priority badge */}
        {task.priority && (
          <Badge
            variant={task.priority === 'high' ? 'warning' : task.priority === 'medium' ? 'default' : 'secondary'}
            className="mb-2"
          >
            {task.priority === 'high' && `🔴 ${t.board.high}`}
            {task.priority === 'medium' && `🟡 ${t.board.medium}`}
            {task.priority === 'low' && `🟢 ${t.board.low}`}
          </Badge>
        )}

        {/* Assigned agent */}
        {task.assigned_to && (
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-2">
            🤖 {task.assigned_to.name || t.board.assigned}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-3 flex gap-2">
          {task.status === 'todo' && !task.assigned_to && (
            <button
              type="button"
              onClick={handleClaim}
              className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {t.board.claim}
            </button>
          )}
          {task.status === 'in_progress' && (
            <button
              type="button"
              onClick={handleComplete}
              className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
            >
              {t.board.complete}
            </button>
          )}
        </div>

        {/* Mobile move controls */}
        {columns && columns.length > 0 && (
          <div className="mt-2 flex items-center gap-1 sm:hidden">
            {onMoveUp && (
              <button type="button" onClick={(e) => { e.stopPropagation(); onMoveUp(); }} className="p-1 text-xs bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600">
                ▲
              </button>
            )}
            {onMoveDown && (
              <button type="button" onClick={(e) => { e.stopPropagation(); onMoveDown(); }} className="p-1 text-xs bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600">
                ▼
              </button>
            )}
            <div className="relative flex-1">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowMoveMenu(!showMoveMenu); }}
                className="w-full px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50"
              >
                Move to...
              </button>
              {showMoveMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMoveMenu(false)} />
                  <div className="absolute bottom-full left-0 mb-1 w-full bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 z-20 overflow-hidden">
                    {columns.filter(c => c.id !== (task as any).column_id).map(col => (
                      <button
                        key={col.id}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleMoveToColumn(col.id); }}
                        className="w-full px-3 py-2 text-left text-xs text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-purple-900/30"
                      >
                        {col.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
