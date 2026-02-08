import { prisma } from '../lib/prisma';
import { Task, CreateTaskInput, UpdateTaskInput } from '@swarm/types';

/**
 * Create a new task
 */
export async function createTask(
  teamId: string,
  agentId: string | null,
  userId: string | null,
  data: CreateTaskInput
): Promise<Task> {
  // Verify agent is member of team (only for agents)
  if (agentId) {
    const member = await prisma.teamMember.findFirst({
      where: {
        team_id: teamId,
        agent_id: agentId,
      },
    });

    if (!member) {
      throw new Error('Only team members can create tasks');
    }
  }

  // If no column_id provided, get the first column (default)
  let columnId = (data as any).column_id;
  let statusValue = 'todo'; // default

  if (!columnId) {
    const firstColumn = await prisma.column.findFirst({
      where: { team_id: teamId },
      orderBy: { order: 'asc' },
    });
    columnId = firstColumn?.id || null;
    statusValue = firstColumn?.name || 'todo';
  } else {
    // Get column name for status
    const column = await prisma.column.findUnique({
      where: { id: columnId },
    });
    statusValue = column?.name || 'todo';
  }

  // Get the highest order in the column to add task at the end
  const lastTask = await prisma.task.findFirst({
    where: { column_id: columnId },
    orderBy: { order: 'desc' },
  });
  const newOrder = lastTask ? lastTask.order + 1 : 0;

  return await prisma.task.create({
    data: {
      team_id: teamId,
      column_id: columnId,
      title: data.title,
      description: data.description,
      required_capabilities: data.required_capabilities || [],
      priority: data.priority || 'medium',
      due_date: data.due_date,
      created_by_id: agentId,
      created_by_user_id: userId,
      status: statusValue, // Status is column name
      order: newOrder,
    },
  });
}

/**
 * Get all tasks for a team
 */
export async function getTeamTasks(teamId: string): Promise<Task[]> {
  return await prisma.task.findMany({
    where: { team_id: teamId },
    include: {
      assigned_to: {
        select: {
          id: true,
          name: true,
          capabilities: true,
        },
      },
      created_by: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ column_id: 'asc' }, { order: 'asc' }],
  });
}

/**
 * Get task by ID
 */
export async function getTaskById(taskId: string): Promise<Task | null> {
  return await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      team: true,
      assigned_to: true,
      created_by: true,
    },
  });
}

/**
 * Claim a task
 */
export async function claimTask(
  taskId: string,
  agentId: string,
  message?: string
): Promise<Task> {
  return await prisma.$transaction(async (tx: any) => {
    // Get task
    const task = await tx.task.findUnique({
      where: { id: taskId },
      include: { team: true },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    // Check if already assigned
    if (task.assigned_to_id) {
      throw new Error('Task already claimed');
    }

    // Verify agent is team member
    const member = await tx.teamMember.findFirst({
      where: {
        team_id: task.team_id,
        agent_id: agentId,
      },
    });

    if (!member) {
      throw new Error('Only team members can claim tasks');
    }

    // Get agent to verify capabilities
    const agent = await tx.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    // Check if agent has required capabilities (skip in dev mode if configured)
    const skipCapabilityCheck = process.env.SKIP_CAPABILITY_CHECK === 'true';

    if (!skipCapabilityCheck && task.required_capabilities && task.required_capabilities.length > 0) {
      const missingCapabilities = task.required_capabilities.filter(
        (cap: string) => !agent.capabilities.includes(cap)
      );

      if (missingCapabilities.length > 0) {
        throw new Error(
          `Agent missing required capabilities: ${missingCapabilities.join(', ')}. ` +
          `Agent has: [${agent.capabilities.join(', ')}]. Task requires: [${task.required_capabilities.join(', ')}]`
        );
      }
    }

    // Claim task
    const updatedTask = await tx.task.update({
      where: { id: taskId },
      data: {
        assigned_to_id: agentId,
        status: 'in_progress',
      },
      include: {
        assigned_to: true,
        team: true,
      },
    });

    // Create task assignment record
    await tx.taskAssignment.create({
      data: {
        task_id: taskId,
        agent_id: agentId,
        status: 'claimed',
        claimed_at: new Date(),
      },
    });

    return updatedTask;
  });
}

/**
 * Unclaim a task
 */
export async function unclaimTask(taskId: string, agentId: string): Promise<Task> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  if (task.assigned_to_id !== agentId) {
    throw new Error('Can only unclaim tasks assigned to you');
  }

  return await prisma.task.update({
    where: { id: taskId },
    data: {
      assigned_to_id: null,
      status: 'todo',
    },
  });
}

/**
 * Update task progress
 */
export async function updateTask(
  taskId: string,
  agentId: string | null,
  userId: string | null,
  data: UpdateTaskInput
): Promise<Task> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  // Authorization check: assigned agent, team admin, or task creator (human)
  let isAuthorized = false;

  if (agentId) {
    const isAssigned = task.assigned_to_id === agentId;
    const member = await prisma.teamMember.findFirst({
      where: {
        team_id: task.team_id,
        agent_id: agentId,
        role: { in: ['owner', 'admin'] },
      },
    });
    isAuthorized = isAssigned || !!member;
  }

  if (userId) {
    // Humans who created the task can update it
    const isCreator = task.created_by_user_id === userId;
    // Or humans who created the team
    const team = await prisma.team.findUnique({
      where: { id: task.team_id },
    });
    const isTeamCreator = team?.created_by_user === userId;
    isAuthorized = isCreator || isTeamCreator;
  }

  if (!isAuthorized) {
    throw new Error('Not authorized to update this task');
  }

  // Set status to column name
  let statusToSet = data.status;
  if ((data as any).column_id) {
    const column = await prisma.column.findUnique({
      where: { id: (data as any).column_id },
    });

    if (column) {
      // Status is the column name
      statusToSet = column.name;
    }
  }

  return await prisma.task.update({
    where: { id: taskId },
    data: {
      title: data.title,
      description: data.description,
      status: statusToSet,
      priority: data.priority,
      due_date: data.due_date,
      assigned_to_id: data.assigned_to,
      column_id: (data as any).column_id,
    },
  });
}

/**
 * Request collaboration on a task
 */
export async function requestCollaboration(
  taskId: string,
  agentId: string,
  message: string,
  requiredCapabilities?: string[]
): Promise<any> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  if (task.assigned_to_id !== agentId) {
    throw new Error('Only assigned agent can request collaboration');
  }

  // Find matching agents in the team
  const teamMembers = await prisma.teamMember.findMany({
    where: {
      team_id: task.team_id,
      agent_id: { not: agentId },
    },
    include: {
      agent: true,
    },
  });

  let matchingAgents = teamMembers.map((m: any) => m.agent);

  // Filter by capabilities if specified
  if (requiredCapabilities && requiredCapabilities.length > 0) {
    matchingAgents = matchingAgents.filter((agent: any) =>
      requiredCapabilities.some((cap: string) => agent.capabilities.includes(cap))
    );
  }

  return {
    task_id: taskId,
    message,
    matching_agents: matchingAgents.map((a: any) => ({
      id: a.id,
      name: a.name,
      capabilities: a.capabilities,
    })),
  };
}

/**
 * Add collaborator to task
 */
export async function addCollaborator(
  taskId: string,
  agentId: string,
  collaboratorId: string
): Promise<any> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  // Verify both agents are team members
  const members = await prisma.teamMember.findMany({
    where: {
      team_id: task.team_id,
      agent_id: { in: [agentId, collaboratorId] },
    },
  });

  if (members.length !== 2) {
    throw new Error('Both agents must be team members');
  }

  // Check if already collaborating
  const existing = await prisma.taskAssignment.findFirst({
    where: {
      task_id: taskId,
      agent_id: collaboratorId,
    },
  });

  if (existing) {
    throw new Error('Agent is already collaborating on this task');
  }

  return await prisma.taskAssignment.create({
    data: {
      task_id: taskId,
      agent_id: collaboratorId,
      status: 'claimed',
      claimed_at: new Date(),
    },
  });
}

/**
 * Complete task
 */
export async function completeTask(
  taskId: string,
  agentId: string
): Promise<Task> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  if (task.assigned_to_id !== agentId) {
    throw new Error('Only assigned agent can complete task');
  }

  return await prisma.task.update({
    where: { id: taskId },
    data: {
      status: 'review',
      completed_at: new Date(),
    },
  });
}

/**
 * Delete task
 */
export async function deleteTask(
  taskId: string,
  agentId: string | null,
  userId: string | null
): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  // Authorization check
  let isAuthorized = false;

  // Check agent permissions
  if (agentId) {
    const isCreator = task.created_by_id === agentId;
    const member = await prisma.teamMember.findFirst({
      where: {
        team_id: task.team_id,
        agent_id: agentId,
        role: { in: ['owner', 'admin'] },
      },
    });
    isAuthorized = isCreator || !!member;
  }

  // Check user permissions
  if (userId) {
    // Humans who created the task can delete it
    const isCreator = task.created_by_user_id === userId;
    // Or humans who created the team
    const team = await prisma.team.findUnique({
      where: { id: task.team_id },
    });
    const isTeamCreator = team?.created_by_user === userId;
    isAuthorized = isCreator || isTeamCreator;
  }

  if (!isAuthorized) {
    throw new Error('Not authorized to delete this task');
  }

  // Delete task and related records in a transaction
  await prisma.$transaction(async (tx: any) => {
    // Delete task assignments first
    await tx.taskAssignment.deleteMany({
      where: { task_id: taskId },
    });

    // Delete the task
    await tx.task.delete({
      where: { id: taskId },
    });
  });
}

/**
 * Reorder tasks within a column
 */
export async function reorderTasks(
  columnId: string,
  agentId: string | null,
  userId: string | null,
  taskOrders: Array<{ id: string; order: number }>
): Promise<void> {
  // Get column to find team ID
  const column = await prisma.column.findUnique({
    where: { id: columnId },
    include: { team: true },
  });

  if (!column) {
    throw new Error('Column not found');
  }

  // Authorization check
  let isAuthorized = false;

  // Check agent permissions
  if (agentId) {
    const member = await prisma.teamMember.findFirst({
      where: {
        team_id: column.team_id,
        agent_id: agentId,
      },
    });
    isAuthorized = !!member;
  }

  // Check user permissions (human creator)
  if (userId) {
    const isTeamCreator = column.team.created_by_user === userId;
    isAuthorized = isTeamCreator;
  }

  if (!isAuthorized) {
    throw new Error('Only team members can reorder tasks');
  }

  await prisma.$transaction(
    taskOrders.map((taskOrder) =>
      prisma.task.update({
        where: { id: taskOrder.id },
        data: { order: taskOrder.order },
      })
    )
  );
}
