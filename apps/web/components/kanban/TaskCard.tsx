'use client';

import React from 'react';
import { Task } from '@swarm/types';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';

interface TaskCardProps {
  task: Task;
  onUpdate: () => void;
}

export function TaskCard({ task, onUpdate }: TaskCardProps) {
  const handleClaim = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem('swarm_token');
      const response = await fetch(`http://localhost:3001/api/tasks/${task.id}/claim`, {
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
    } catch (error) {
      console.error('Failed to claim task:', error);
    }
  };

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem('swarm_token');
      const response = await fetch(`http://localhost:3001/api/tasks/${task.id}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to complete task:', error);
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
            variant={task.priority === 'high' ? 'warning' : 'secondary'}
            className="mb-2"
          >
            {task.priority}
          </Badge>
        )}

        {/* Assigned agent */}
        {task.assigned_to && (
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-2">
            🤖 {task.assigned_to.name || 'Assigned'}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-3 flex gap-2">
          {task.status === 'todo' && !task.assigned_to && (
            <button
              onClick={handleClaim}
              className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Claim
            </button>
          )}
          {task.status === 'in_progress' && (
            <button
              onClick={handleComplete}
              className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
            >
              Complete
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
