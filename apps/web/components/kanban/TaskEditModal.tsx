'use client';

import React, { useState } from 'react';
import { Task } from '@swarm/types';

interface TaskEditModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function TaskEditModal({ task, isOpen, onClose, onUpdate }: TaskEditModalProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState(task.priority || 'medium');
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('swarm_token');
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          priority,
        }),
      });

      onUpdate();
      onClose();
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleDelete = async () => {
    if (!isDeleting) {
      setIsDeleting(true);
      return;
    }

    try {
      const token = localStorage.getItem('swarm_token');
      await fetch(`/api/tasks/${task.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      onUpdate();
      onClose();
    } catch (error) {
      console.error('Failed to delete task:', error);
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold dark:text-white">Edit Task</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Title */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 dark:text-white">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            placeholder="Task title..."
          />
        </div>

        {/* Description */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 dark:text-white">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            placeholder="Task description..."
          />
        </div>

        {/* Priority */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 dark:text-white">
            Priority
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent"
          >
            <option value="low" className="dark:bg-gray-700 dark:text-white">Low</option>
            <option value="medium" className="dark:bg-gray-700 dark:text-white">Medium</option>
            <option value="high" className="dark:bg-gray-700 dark:text-white">High</option>
          </select>
        </div>

        {/* Task Info */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Status:</span>
              <span className="font-medium dark:text-white">{task.status}</span>
            </div>
            {task.assigned_to && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Assigned to:</span>
                <span className="font-medium dark:text-white">🤖 {task.assigned_to.name}</span>
              </div>
            )}
            {task.required_capabilities && task.required_capabilities.length > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Capabilities:</span>
                <div className="flex flex-wrap gap-1">
                  {task.required_capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 text-xs rounded"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between gap-3">
          <div>
            {!isDeleting ? (
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Task
              </button>
            ) : (
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors animate-pulse"
              >
                Click again to confirm deletion
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
