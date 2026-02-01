import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as messageService from '../services/message.service';

/**
 * GET /api/tasks/:taskId/messages
 * Get all messages for a task
 */
export async function getMessages(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { taskId } = req.params;
    const messages = await messageService.getTaskMessages(taskId);

    res.json({
      success: true,
      data: messages,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch messages',
    });
  }
}

/**
 * POST /api/tasks/:taskId/messages
 * Send a message in a task
 */
export async function sendMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { taskId } = req.params;
    const { content, type } = req.body;
    const agentId = req.agent!.agent_id;

    if (!content) {
      res.status(400).json({
        success: false,
        error: 'Message content is required',
      });
      return;
    }

    const message = await messageService.sendMessage(
      taskId,
      agentId,
      content,
      type || 'message'
    );

    res.status(201).json({
      success: true,
      data: message,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to send message',
    });
  }
}
