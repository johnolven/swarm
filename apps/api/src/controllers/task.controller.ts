import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as taskService from '../services/task.service';
import * as messageService from '../services/message.service';
import * as webhookService from '../services/webhook.service';
import { CreateTaskInput, UpdateTaskInput } from '@swarm/types';

/**
 * POST /api/teams/:teamId/tasks
 * Create a new task
 */
export async function createTask(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { teamId } = req.params;
    const data: CreateTaskInput = req.body;

    // Get creator info (agent or human user)
    const agentId = req.agent?.agent_id || null;
    const userId = req.user?.id || null;

    if (!data.title) {
      res.status(400).json({
        success: false,
        error: 'Title is required',
      });
      return;
    }

    const task = await taskService.createTask(teamId, agentId, userId, data);

    // Notify team members (only if created by agent)
    if (agentId) {
      await webhookService.notifyTeamMembers(
        teamId,
        'task.created',
        {
          task_id: task.id,
          task_title: task.title,
          created_by: req.agent!.name,
        },
        agentId
      );
    }

    res.status(201).json({
      success: true,
      data: task,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create task',
    });
  }
}

/**
 * GET /api/teams/:teamId/tasks
 * Get all tasks for a team
 */
export async function getTeamTasks(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { teamId } = req.params;
    const tasks = await taskService.getTeamTasks(teamId);

    res.json({
      success: true,
      data: tasks,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch tasks',
    });
  }
}

/**
 * GET /api/tasks/:id
 * Get task by ID
 */
export async function getTaskById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const task = await taskService.getTaskById(id);

    if (!task) {
      res.status(404).json({
        success: false,
        error: 'Task not found',
      });
      return;
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch task',
    });
  }
}

/**
 * PUT /api/tasks/:id
 * Update task
 */
export async function updateTask(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const data: UpdateTaskInput = req.body;
    const agentId = req.agent?.agent_id || null;
    const userId = req.user?.id || null;

    const task = await taskService.updateTask(id, agentId, userId, data);

    res.json({
      success: true,
      data: task,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update task',
    });
  }
}

/**
 * POST /api/tasks/:id/claim
 * Claim a task
 */
export async function claimTask(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const agentId = req.agent!.agent_id;

    const task = await taskService.claimTask(id, agentId, message);

    // Send system message
    await messageService.sendSystemMessage(
      id,
      `${req.agent!.name} claimed this task`
    );

    // Notify team members
    await webhookService.notifyTeamMembers(
      task.team_id,
      'task.assigned',
      {
        task_id: task.id,
        task_title: task.title,
        assigned_to: req.agent!.name,
      },
      agentId
    );

    res.json({
      success: true,
      data: task,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to claim task',
    });
  }
}

/**
 * POST /api/tasks/:id/unclaim
 * Unclaim a task
 */
export async function unclaimTask(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const agentId = req.agent!.agent_id;

    const task = await taskService.unclaimTask(id, agentId);

    // Send system message
    await messageService.sendSystemMessage(
      id,
      `${req.agent!.name} unclaimed this task`
    );

    res.json({
      success: true,
      data: task,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to unclaim task',
    });
  }
}

/**
 * POST /api/tasks/:id/complete
 * Mark task as complete
 */
export async function completeTask(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const agentId = req.agent!.agent_id;

    const task = await taskService.completeTask(id, agentId);

    // Send system message
    await messageService.sendSystemMessage(
      id,
      `${req.agent!.name} marked this task as complete`
    );

    // Notify team for review
    await webhookService.notifyTeamMembers(
      task.team_id,
      'task.review_completed',
      {
        task_id: task.id,
        task_title: task.title,
        completed_by: req.agent!.name,
      },
      agentId
    );

    res.json({
      success: true,
      data: task,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to complete task',
    });
  }
}

/**
 * POST /api/tasks/:id/collaborate
 * Request collaboration
 */
export async function requestCollaboration(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const { message, required_capabilities } = req.body;
    const agentId = req.agent!.agent_id;

    const result = await taskService.requestCollaboration(
      id,
      agentId,
      message,
      required_capabilities
    );

    // Send message in task chat
    await messageService.sendMessage(
      id,
      agentId,
      message,
      'collaboration_request'
    );

    // Notify matching agents
    for (const agent of result.matching_agents) {
      await webhookService.sendWebhookEvent(agent.id, 'task.collaboration_requested', {
        task_id: id,
        requesting_agent: req.agent!.name,
        message,
        required_capabilities,
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to request collaboration',
    });
  }
}

/**
 * DELETE /api/tasks/:id
 * Delete task
 */
export async function deleteTask(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const agentId = req.agent?.agent_id || null;
    const userId = req.user?.id || null;

    await taskService.deleteTask(id, agentId, userId);

    res.json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to delete task',
    });
  }
}

/**
 * POST /api/columns/:columnId/tasks/reorder
 * Reorder tasks within a column
 */
export async function reorderTasks(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { columnId } = req.params;
    const { taskOrders } = req.body;

    if (!taskOrders || !Array.isArray(taskOrders)) {
      res.status(400).json({
        success: false,
        error: 'taskOrders array is required',
      });
      return;
    }

    await taskService.reorderTasks(columnId, taskOrders);

    res.json({
      success: true,
      message: 'Tasks reordered successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to reorder tasks',
    });
  }
}
