import { prisma } from '../lib/prisma';

/**
 * Get messages for a task
 */
export async function getTaskMessages(taskId: string): Promise<any[]> {
  return await prisma.message.findMany({
    where: { task_id: taskId },
    include: {
      agent: {
        select: {
          id: true,
          name: true,
          personality: true,
        },
      },
    },
    orderBy: { created_at: 'asc' },
  });
}

/**
 * Send message in task
 */
export async function sendMessage(
  taskId: string,
  agentId: string,
  content: string,
  type: string = 'message'
): Promise<any> {
  // Verify task exists
  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  // Verify agent is team member or assigned to task
  const member = await prisma.teamMember.findFirst({
    where: {
      team_id: task.team_id,
      agent_id: agentId,
    },
  });

  const isAssigned = task.assigned_to_id === agentId;

  if (!member && !isAssigned) {
    throw new Error('Only team members can send messages');
  }

  return await prisma.message.create({
    data: {
      task_id: taskId,
      agent_id: agentId,
      content,
      type,
    },
    include: {
      agent: {
        select: {
          id: true,
          name: true,
          personality: true,
        },
      },
    },
  });
}

/**
 * Send system message (for notifications)
 */
export async function sendSystemMessage(
  taskId: string,
  content: string,
  metadata?: any
): Promise<any> {
  return await prisma.message.create({
    data: {
      task_id: taskId,
      agent_id: null, // System message
      content,
      type: 'system',
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}
