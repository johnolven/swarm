'use client';

import React, { useState, useRef, useCallback } from 'react';
import useSWR from 'swr';
import { Task } from '@swarm/types';
import { TaskCard } from './TaskCard';
import { TaskEditModal } from './TaskEditModal';
import { useLanguage } from '@/components/LanguageProvider';
import { authFetcher, getToken } from '@/lib/auth';

interface BoardProps {
  teamId: string;
}

interface Column {
  id: string;
  name: string;
  color: string;
  order: number;
}

export function Board({ teamId }: BoardProps) {
  const { t } = useLanguage();
  const { data: tasks, error: tasksError, mutate: mutateTasks, isLoading: tasksLoading } = useSWR<Task[]>(
    `/api/teams/${teamId}/tasks`,
    authFetcher,
    { revalidateOnFocus: true }
  );

  const { data: columns, error: columnsError, mutate: mutateColumns, isLoading: columnsLoading } = useSWR<Column[]>(
    `/api/teams/${teamId}/columns`,
    authFetcher,
    { revalidateOnFocus: true }
  );

  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [newColumnName, setNewColumnName] = useState('');
  const [showNewColumnForm, setShowNewColumnForm] = useState(false);
  const [deletingColumn, setDeletingColumn] = useState<string | null>(null);
  const [migrationColumnId, setMigrationColumnId] = useState<string>('');
  const [creatingTaskInColumn, setCreatingTaskInColumn] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<Column | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{ columnId: string; position: 'left' | 'right' } | null>(null);
  const [taskDropIndicator, setTaskDropIndicator] = useState<{ taskId: string; position: 'top' | 'bottom' } | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [mouseDownPos, setMouseDownPos] = useState<{ x: number; y: number } | null>(null);

  // Touch drag and drop
  const touchDragTask = useRef<Task | null>(null);
  const touchDragCol = useRef<Column | null>(null);
  const touchCloneRef = useRef<HTMLElement | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const touchDragging = useRef(false);
  const columnRefs = useRef<Map<string, HTMLElement>>(new Map());
  const columnHeaderRefs = useRef<Map<string, HTMLElement>>(new Map());
  const touchTargetTask = useRef<{ id: string; position: 'top' | 'bottom' } | null>(null);
  const touchTargetCol = useRef<{ id: string; position: 'left' | 'right' } | null>(null);

  // --- Task touch handlers ---
  const handleTouchStart = useCallback((e: React.TouchEvent, task: Task) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    touchDragTask.current = task;
    touchDragCol.current = null;
    touchDragging.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    if (!touchDragTask.current && !touchDragCol.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPos.current.x);
    const dy = Math.abs(touch.clientY - touchStartPos.current.y);

    // Start drag after 10px movement
    if (!touchDragging.current && (dx > 10 || dy > 10)) {
      touchDragging.current = true;
      if (touchDragTask.current) setDraggedTask(touchDragTask.current);
      if (touchDragCol.current) setDraggedColumn(touchDragCol.current);
      const el = e.currentTarget as HTMLElement;
      const clone = el.cloneNode(true) as HTMLElement;
      clone.style.position = 'fixed';
      clone.style.width = el.offsetWidth + 'px';
      clone.style.opacity = '0.85';
      clone.style.zIndex = '1000';
      clone.style.pointerEvents = 'none';
      clone.style.transform = 'rotate(2deg) scale(1.02)';
      clone.style.boxShadow = '0 8px 25px rgba(0,0,0,0.3)';
      document.body.appendChild(clone);
      touchCloneRef.current = clone;
    }

    if (touchDragging.current && touchCloneRef.current) {
      e.preventDefault();
      touchCloneRef.current.style.left = (touch.clientX - 40) + 'px';
      touchCloneRef.current.style.top = (touch.clientY - 20) + 'px';

      if (touchDragTask.current) {
        // Detect column and task position
        let foundColumn: string | null = null;
        let foundTask: { id: string; position: 'top' | 'bottom' } | null = null;

        columnRefs.current.forEach((el, colId) => {
          const rect = el.getBoundingClientRect();
          if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
              touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
            foundColumn = colId;

            // Find which task card we're over
            const taskEls = el.querySelectorAll('[data-task-id]');
            taskEls.forEach((taskEl) => {
              const taskRect = taskEl.getBoundingClientRect();
              if (touch.clientY >= taskRect.top && touch.clientY <= taskRect.bottom) {
                const mid = taskRect.top + taskRect.height / 2;
                const taskId = taskEl.getAttribute('data-task-id')!;
                if (taskId !== touchDragTask.current?.id) {
                  foundTask = { id: taskId, position: touch.clientY < mid ? 'top' : 'bottom' };
                }
              }
            });
          }
        });
        setDragOverColumn(foundColumn);
        touchTargetTask.current = foundTask;
        setTaskDropIndicator(foundTask);
      }

      if (touchDragCol.current) {
        // Detect column drop position
        let foundTarget: { id: string; position: 'left' | 'right' } | null = null;
        columnHeaderRefs.current.forEach((el, colId) => {
          if (colId === touchDragCol.current?.id) return;
          const rect = el.getBoundingClientRect();
          if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
              touch.clientY >= rect.top - 50 && touch.clientY <= rect.bottom + 50) {
            const mid = rect.left + rect.width / 2;
            foundTarget = { id: colId, position: touch.clientX < mid ? 'left' : 'right' };
          }
        });
        touchTargetCol.current = foundTarget;
        setDropIndicator(foundTarget);
      }
    }
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (touchCloneRef.current) {
      document.body.removeChild(touchCloneRef.current);
      touchCloneRef.current = null;
    }

    // --- Task drop ---
    if (touchDragging.current && touchDragTask.current) {
      const task = touchDragTask.current;
      const draggedColumnId = (task as any).column_id;
      const targetTask = touchTargetTask.current;
      const targetColumnId = dragOverColumn;

      if (targetTask) {
        // Dropping on a specific task (reorder or cross-column with position)
        const allTasks = tasks || [];
        const dropTask = allTasks.find(tk => tk.id === targetTask.id);
        if (dropTask) {
          const dropColumnId = (dropTask as any).column_id;
          try {
            const token = getToken();
            if (draggedColumnId !== dropColumnId) {
              // Move to other column first
              await fetch(`/api/tasks/${task.id}`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ column_id: dropColumnId }),
              });
            }
            // Reorder within target column
            const columnTasks = (allTasks as any[])
              .filter(tk => tk.column_id === dropColumnId && tk.id !== task.id)
              .sort((a, b) => (a.order || 0) - (b.order || 0));
            let insertIndex = columnTasks.findIndex(tk => tk.id === targetTask.id);
            if (targetTask.position === 'bottom') insertIndex += 1;
            columnTasks.splice(insertIndex, 0, task);
            const taskOrders = columnTasks.map((tk, i) => ({ id: tk.id, order: i }));
            await fetch(`/api/columns/${dropColumnId}/tasks/reorder`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ taskOrders }),
            });
            mutateTasks();
          } catch { /* ignore */ }
        }
      } else if (targetColumnId && draggedColumnId !== targetColumnId) {
        // Drop on empty area of different column
        try {
          const token = getToken();
          await fetch(`/api/tasks/${task.id}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ column_id: targetColumnId }),
          });
          mutateTasks();
        } catch { /* ignore */ }
      }
    }

    // --- Column drop ---
    if (touchDragging.current && touchDragCol.current && touchTargetCol.current) {
      const draggedCol = touchDragCol.current;
      const target = touchTargetCol.current;
      try {
        const sortedCols = [...(columns || [])].sort((a, b) => a.order - b.order);
        const dragIdx = sortedCols.findIndex(c => c.id === draggedCol.id);
        sortedCols.splice(dragIdx, 1);
        let targetIdx = sortedCols.findIndex(c => c.id === target.id);
        if (target.position === 'right') targetIdx += 1;
        sortedCols.splice(targetIdx, 0, draggedCol);
        const columnOrders = sortedCols.map((col, i) => ({ id: col.id, order: i }));
        const token = getToken();
        await fetch(`/api/teams/${teamId}/columns/reorder`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ columnOrders }),
        });
        mutateColumns();
      } catch { /* ignore */ }
    }

    touchDragTask.current = null;
    touchDragCol.current = null;
    touchStartPos.current = null;
    touchDragging.current = false;
    touchTargetTask.current = null;
    touchTargetCol.current = null;
    setDraggedTask(null);
    setDraggedColumn(null);
    setDragOverColumn(null);
    setTaskDropIndicator(null);
    setDropIndicator(null);
  }, [dragOverColumn, tasks, columns, mutateTasks, mutateColumns, teamId]);

  // --- Column touch handlers ---
  const handleColumnTouchStart = useCallback((e: React.TouchEvent, column: Column) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    touchDragCol.current = column;
    touchDragTask.current = null;
    touchDragging.current = false;
  }, []);

  // Listen for task updates
  React.useEffect(() => {
    const handleTaskUpdate = () => {
      mutateTasks();
    };

    window.addEventListener('task-updated', handleTaskUpdate);
    return () => window.removeEventListener('task-updated', handleTaskUpdate);
  }, [mutateTasks]);

  const getTasksByColumn = (columnId: string) => {
    return (tasks || [])
      .filter((task: any) => task.column_id === columnId)
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
  };

  const handleUpdateColumnName = async (columnId: string) => {
    if (!editingName.trim()) return;

    try {
      const token = getToken();
      await fetch(`/api/columns/${columnId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: editingName }),
      });

      mutateColumns();
      setEditingColumn(null);
      setEditingName('');
    } catch (error) {
      console.error('Failed to update column:', error);
    }
  };

  const handleCreateColumn = async () => {
    if (!newColumnName.trim()) return;

    try {
      const token = getToken();
      await fetch(`/api/teams/${teamId}/columns`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newColumnName,
          color: 'bg-purple-100'
        }),
      });

      mutateColumns();
      setNewColumnName('');
      setShowNewColumnForm(false);
    } catch (error) {
      console.error('Failed to create column:', error);
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    const tasksInColumn = getTasksByColumn(columnId);

    if (columns && columns.length === 1) {
      alert(t.board.cannotDeleteLast);
      return;
    }

    if (tasksInColumn.length > 0) {
      setDeletingColumn(columnId);
      return;
    }

    try {
      const token = getToken();
      await fetch(`/api/columns/${columnId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      mutateColumns();
    } catch (error) {
      console.error('Failed to delete column:', error);
    }
  };

  const confirmDeleteColumn = async () => {
    if (!deletingColumn || !migrationColumnId) return;

    try {
      const token = getToken();
      await fetch(`/api/columns/${deletingColumn}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ migrationColumnId }),
      });

      mutateColumns();
      mutateTasks();
      setDeletingColumn(null);
      setMigrationColumnId('');
    } catch (error) {
      console.error('Failed to delete column:', error);
    }
  };

  const handleCreateTask = async (columnId: string) => {
    if (!newTaskTitle.trim()) return;

    try {
      const token = getToken();
      await fetch(`/api/teams/${teamId}/tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newTaskTitle,
          description: newTaskDescription,
          column_id: columnId,
          priority: newTaskPriority,
        }),
      });

      mutateTasks();
      setCreatingTaskInColumn(null);
      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskPriority('medium');
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  // Task drag and drop handlers
  const handleTaskDragStart = (e: React.DragEvent, task: Task) => {
    e.stopPropagation(); // Prevent column drag
    setDraggedTask(task);
  };

  const handleTaskDragEnd = (e: React.DragEvent) => {
    e.stopPropagation(); // Prevent column drag
    setDraggedTask(null);
    setDragOverColumn(null);
    setTaskDropIndicator(null);
  };

  const handleTaskMouseDown = (e: React.MouseEvent, _task: Task) => {
    setMouseDownPos({ x: e.clientX, y: e.clientY });
  };

  const handleTaskMouseUp = (e: React.MouseEvent, task: Task) => {
    if (!mouseDownPos) return;

    const deltaX = Math.abs(e.clientX - mouseDownPos.x);
    const deltaY = Math.abs(e.clientY - mouseDownPos.y);

    // If mouse didn't move much (less than 5px), it's a click
    if (deltaX < 5 && deltaY < 5) {
      setEditingTask(task);
    }

    setMouseDownPos(null);
  };

  const handleTaskDragOver = (e: React.DragEvent, targetTask: Task) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedTask || draggedTask.id === targetTask.id) {
      setTaskDropIndicator(null);
      return;
    }

    // Calculate which half of the task is being hovered
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const position = e.clientY < midpoint ? 'top' : 'bottom';

    setTaskDropIndicator({ taskId: targetTask.id, position });
  };

  const handleTaskDropOnTask = async (targetTask: Task) => {
    if (!draggedTask || draggedTask.id === targetTask.id) {
      setTaskDropIndicator(null);
      return;
    }

    const draggedColumnId = (draggedTask as any).column_id;
    const targetColumnId = (targetTask as any).column_id;

    try {
      const token = getToken();

      // If moving to a different column
      if (draggedColumnId !== targetColumnId) {
        await fetch(`/api/tasks/${draggedTask.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            column_id: targetColumnId,
          }),
        });
      } else {
        // Reordering within the same column
        const columnTasks = getTasksByColumn(targetColumnId);
        const draggedIndex = columnTasks.findIndex(tk => tk.id === draggedTask.id);
        // Remove dragged task
        columnTasks.splice(draggedIndex, 1);

        // Calculate new target index after removal
        let newTargetIndex = columnTasks.findIndex(tk => tk.id === targetTask.id);

        // If dropping on bottom, insert after the target
        if (taskDropIndicator?.position === 'bottom') {
          newTargetIndex += 1;
        }

        // Insert at the calculated position
        columnTasks.splice(newTargetIndex, 0, draggedTask);

        // Update order for all tasks in the column
        const taskOrders = columnTasks.map((task, index) => ({
          id: task.id,
          order: index,
        }));

        await fetch(`/api/columns/${targetColumnId}/tasks/reorder`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ taskOrders }),
        });
      }

      mutateTasks();
      setDraggedTask(null);
      setDragOverColumn(null);
      setTaskDropIndicator(null);
    } catch (error) {
      console.error('Failed to move task:', error);
    }
  };

  const handleTaskDrop = async (targetColumnId: string) => {
    if (!draggedTask) {
      setDraggedTask(null);
      setDragOverColumn(null);
      return;
    }

    const draggedColumnId = (draggedTask as any).column_id;

    // If dropping in the same column without a specific task target, do nothing
    if (draggedColumnId === targetColumnId) {
      setDraggedTask(null);
      setDragOverColumn(null);
      return;
    }

    try {
      const token = getToken();
      await fetch(`/api/tasks/${draggedTask.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          column_id: targetColumnId,
        }),
      });

      mutateTasks();
      setDraggedTask(null);
      setDragOverColumn(null);
    } catch (error) {
      console.error('Failed to move task:', error);
    }
  };

  // Column drag and drop handlers
  const handleColumnDragStart = (column: Column) => {
    setDraggedColumn(column);
  };

  const handleColumnDragEnd = () => {
    setDraggedColumn(null);
    setDropIndicator(null);
  };

  const handleColumnDragOver = (e: React.DragEvent, targetColumn: Column) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn.id === targetColumn.id) {
      setDropIndicator(null);
      return;
    }

    // Calculate which side of the column is being hovered
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;
    const position = e.clientX < midpoint ? 'left' : 'right';

    setDropIndicator({ columnId: targetColumn.id, position });
  };

  const handleColumnDrop = async (targetColumn: Column) => {
    if (!draggedColumn || draggedColumn.id === targetColumn.id) {
      setDropIndicator(null);
      return;
    }

    try {
      const sortedColumns = [...(columns || [])].sort((a, b) => a.order - b.order);
      const draggedIndex = sortedColumns.findIndex(c => c.id === draggedColumn.id);

      // Remove dragged column
      sortedColumns.splice(draggedIndex, 1);

      // Calculate new target index after removal
      let newTargetIndex = sortedColumns.findIndex(c => c.id === targetColumn.id);

      // If dropping on the right side, insert after the target
      if (dropIndicator?.position === 'right') {
        newTargetIndex += 1;
      }

      // Insert at the calculated position
      sortedColumns.splice(newTargetIndex, 0, draggedColumn);

      // Update order for all columns
      const columnOrders = sortedColumns.map((col, index) => ({
        id: col.id,
        order: index,
      }));

      const token = getToken();
      await fetch(`/api/teams/${teamId}/columns/reorder`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ columnOrders }),
      });

      mutateColumns();
      setDraggedColumn(null);
      setDropIndicator(null);
    } catch (error) {
      console.error('Failed to reorder columns:', error);
    }
  };

  if (tasksError || columnsError) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-500 dark:text-red-400 mb-2">{t.board.errorLoading}</div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {tasksError?.message || columnsError?.message}
        </p>
      </div>
    );
  }

  if (tasksLoading || columnsLoading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">{t.board.loadingBoard}</p>
      </div>
    );
  }

  const sortedColumns = columns ? [...columns].sort((a, b) => a.order - b.order) : [];

  return (
    <>
      <div className="flex gap-4 py-6 overflow-x-auto h-screen">
        {sortedColumns.length > 0 && sortedColumns.map((column) => (
          <div
            key={column.id}
            className={`flex-shrink-0 w-80 relative ${draggedColumn?.id === column.id ? 'opacity-50' : ''}`}
            draggable={!editingColumn}
            onDragStart={() => handleColumnDragStart(column)}
            onDragEnd={handleColumnDragEnd}
            onDragOver={(e) => handleColumnDragOver(e, column)}
            onDrop={() => handleColumnDrop(column)}
          >
            {/* Drop indicator - left side */}
            {dropIndicator?.columnId === column.id && dropIndicator.position === 'left' && (
              <div className="absolute -left-1 top-0 bottom-0 w-1.5 bg-purple-500 z-10 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
            )}

            {/* Drop indicator - right side */}
            {dropIndicator?.columnId === column.id && dropIndicator.position === 'right' && (
              <div className="absolute -right-1 top-0 bottom-0 w-1.5 bg-purple-500 z-10 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
            )}

            {/* Column Header */}
            <div
              ref={(el) => { if (el) columnHeaderRefs.current.set(column.id, el); }}
              className={`${column.color} dark:bg-gray-700 rounded-t-lg px-4 py-3 cursor-move touch-none select-none`}
              onTouchStart={(e) => handleColumnTouchStart(e, column)}
              onTouchMove={(e) => handleTouchMove(e)}
              onTouchEnd={() => handleTouchEnd()}
              onTouchCancel={() => handleTouchEnd()}
            >
              <div className="flex items-center justify-between">
                {editingColumn === column.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => handleUpdateColumnName(column.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdateColumnName(column.id);
                      if (e.key === 'Escape') setEditingColumn(null);
                    }}
                    placeholder={t.board.columnName}
                    className="flex-1 px-2 py-1 border rounded dark:bg-gray-600 dark:text-white dark:placeholder-gray-400 dark:border-gray-500"
                    autoFocus
                  />
                ) : (
                  <div className="flex items-center gap-2 flex-1">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-gray-500 dark:text-gray-400 flex-shrink-0">
                      <circle cx="5" cy="3" r="1.5" /><circle cx="11" cy="3" r="1.5" />
                      <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
                      <circle cx="5" cy="13" r="1.5" /><circle cx="11" cy="13" r="1.5" />
                    </svg>
                    <h3 className="font-semibold dark:text-white">{column.name}</h3>
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      ({getTasksByColumn(column.id).length})
                    </span>
                  </div>
                )}
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setEditingColumn(column.id);
                      setEditingName(column.name);
                    }}
                    className="p-1 hover:bg-white/50 dark:hover:bg-gray-600 rounded"
                    title={t.board.editColumnName}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteColumn(column.id)}
                    className="p-1 hover:bg-white/50 dark:hover:bg-gray-600 rounded"
                    title={t.board.deleteColumn}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>

            {/* Column Content - Drop Zone for Tasks */}
            <div
              ref={(el) => { if (el) columnRefs.current.set(column.id, el); }}
              className={`bg-gray-50 dark:bg-gray-800 rounded-b-lg p-4 min-h-[600px] transition-all duration-200 ${
                dragOverColumn === column.id ? 'bg-purple-100 dark:bg-purple-900/30 ring-2 ring-purple-400 ring-inset' : ''
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverColumn(column.id);
              }}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={() => handleTaskDrop(column.id)}
            >
              <div className="space-y-3">
                {getTasksByColumn(column.id).map((task) => (
                  <div
                    key={task.id}
                    className="relative"
                    data-task-id={task.id}
                  >
                    {/* Drop indicator - top */}
                    {taskDropIndicator?.taskId === task.id && taskDropIndicator.position === 'top' && (
                      <div className="absolute -top-2 left-0 right-0 h-1 bg-purple-500 z-10 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.6)]">
                        <div className="absolute -left-1 -top-1 w-3 h-3 bg-purple-500 rounded-full" />
                        <div className="absolute -right-1 -top-1 w-3 h-3 bg-purple-500 rounded-full" />
                      </div>
                    )}

                    <div
                      className={`relative ${draggedTask?.id === task.id ? 'opacity-50' : ''}`}
                    >
                      {/* Mobile drag handle */}
                      <div
                        className="md:hidden absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center z-10 cursor-grab active:cursor-grabbing touch-none select-none"
                        onTouchStart={(e) => handleTouchStart(e, task)}
                        onTouchMove={(e) => handleTouchMove(e)}
                        onTouchEnd={() => handleTouchEnd()}
                        onTouchCancel={() => handleTouchEnd()}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-gray-400">
                          <circle cx="5" cy="3" r="1.5" /><circle cx="11" cy="3" r="1.5" />
                          <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
                          <circle cx="5" cy="13" r="1.5" /><circle cx="11" cy="13" r="1.5" />
                        </svg>
                      </div>
                      {/* Desktop: full card is draggable */}
                      <div
                        draggable
                        onDragStart={(e) => handleTaskDragStart(e, task)}
                        onDragEnd={(e) => handleTaskDragEnd(e)}
                        onDragOver={(e) => handleTaskDragOver(e, task)}
                        onDrop={() => handleTaskDropOnTask(task)}
                        onMouseDown={(e) => handleTaskMouseDown(e, task)}
                        onMouseUp={(e) => handleTaskMouseUp(e, task)}
                        className="cursor-pointer"
                      >
                        <TaskCard
                          task={task}
                          onUpdate={() => mutateTasks()}
                        />
                      </div>
                    </div>

                    {/* Drop indicator - bottom */}
                    {taskDropIndicator?.taskId === task.id && taskDropIndicator.position === 'bottom' && (
                      <div className="absolute -bottom-2 left-0 right-0 h-1 bg-purple-500 z-10 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.6)]">
                        <div className="absolute -left-1 -top-1 w-3 h-3 bg-purple-500 rounded-full" />
                        <div className="absolute -right-1 -top-1 w-3 h-3 bg-purple-500 rounded-full" />
                      </div>
                    )}
                  </div>
                ))}

                {/* Create Task Form */}
                {creatingTaskInColumn === column.id ? (
                  <div className="bg-white dark:bg-gray-700 p-3 rounded-lg border-2 border-purple-500">
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder={t.board.taskTitle}
                      className="w-full px-2 py-1 mb-2 border rounded dark:bg-gray-600 dark:text-white dark:placeholder-gray-400 dark:border-gray-500"
                      autoFocus
                    />
                    <textarea
                      value={newTaskDescription}
                      onChange={(e) => setNewTaskDescription(e.target.value)}
                      placeholder={t.board.descriptionOptional}
                      className="w-full px-2 py-1 mb-2 border rounded dark:bg-gray-600 dark:text-white dark:placeholder-gray-400 dark:border-gray-500"
                      rows={2}
                    />
                    <select
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value as 'low' | 'medium' | 'high')}
                      className="w-full px-2 py-1 mb-2 border rounded dark:bg-gray-600 dark:text-white dark:border-gray-500"
                      aria-label="Task priority"
                    >
                      <option value="low" className="dark:bg-gray-700 dark:text-white">🟢 {t.board.lowPriority}</option>
                      <option value="medium" className="dark:bg-gray-700 dark:text-white">🟡 {t.board.mediumPriority}</option>
                      <option value="high" className="dark:bg-gray-700 dark:text-white">🔴 {t.board.highPriority}</option>
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCreateTask(column.id)}
                        className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                      >
                        {t.board.create}
                      </button>
                      <button
                        onClick={() => {
                          setCreatingTaskInColumn(null);
                          setNewTaskTitle('');
                          setNewTaskDescription('');
                          setNewTaskPriority('medium');
                        }}
                        className="px-3 py-1 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                      >
                        {t.board.cancel}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setCreatingTaskInColumn(column.id)}
                    className="w-full p-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                  >
                    {t.board.addTask}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Add New Column */}
        {showNewColumnForm ? (
          <div className="flex-shrink-0 w-80">
            <div className="bg-gray-200 dark:bg-gray-700 rounded-lg p-4">
              <input
                type="text"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateColumn();
                  if (e.key === 'Escape') setShowNewColumnForm(false);
                }}
                placeholder={t.board.columnName}
                className="w-full px-3 py-2 mb-3 border rounded dark:bg-gray-600 dark:text-white dark:placeholder-gray-400 dark:border-gray-500"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateColumn}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  {t.board.create}
                </button>
                <button
                  onClick={() => {
                    setShowNewColumnForm(false);
                    setNewColumnName('');
                  }}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                >
                  {t.board.cancel}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-shrink-0 w-80">
            <button
              onClick={() => setShowNewColumnForm(true)}
              className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors h-32 flex items-center justify-center"
            >
              <div className="text-center">
                <div className="text-3xl mb-2">+</div>
                <div>{t.board.addColumn}</div>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Delete Column Confirmation Modal */}
      {deletingColumn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4 dark:text-white">{t.board.deleteColumnTitle}</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              {t.board.deleteColumnMsg.replace('{count}', String(getTasksByColumn(deletingColumn).length))}
            </p>
            <select
              value={migrationColumnId}
              onChange={(e) => setMigrationColumnId(e.target.value)}
              className="w-full px-3 py-2 mb-4 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-500"
            >
              <option value="" className="dark:bg-gray-700 dark:text-white">{t.board.selectColumn}</option>
              {columns?.filter((c) => c.id !== deletingColumn)
                .map((c) => (
                  <option key={c.id} value={c.id} className="dark:bg-gray-700 dark:text-white">
                    {c.name}
                  </option>
                ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setDeletingColumn(null);
                  setMigrationColumnId('');
                }}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-500"
              >
                {t.board.cancel}
              </button>
              <button
                onClick={confirmDeleteColumn}
                disabled={!migrationColumnId}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t.board.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Edit Modal */}
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          isOpen={!!editingTask}
          onClose={() => setEditingTask(null)}
          onUpdate={() => {
            mutateTasks();
            setEditingTask(null);
          }}
        />
      )}
    </>
  );
}
