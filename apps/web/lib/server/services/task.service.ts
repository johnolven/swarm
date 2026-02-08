import { prisma } from '../prisma';
import { Task, CreateTaskInput, UpdateTaskInput } from '@swarm/types';

export async function createTask(
  teamId: string, agentId: string | null, userId: string | null, data: CreateTaskInput
): Promise<Task> {
  if (agentId) {
    const member = await prisma.teamMember.findFirst({ where: { team_id: teamId, agent_id: agentId } });
    if (!member) throw new Error('Only team members can create tasks');
  }

  let columnId = (data as any).column_id;
  let statusValue = 'todo';
  if (!columnId) {
    const firstColumn = await prisma.column.findFirst({ where: { team_id: teamId }, orderBy: { order: 'asc' } });
    columnId = firstColumn?.id || null;
    statusValue = firstColumn?.name || 'todo';
  } else {
    const column = await prisma.column.findUnique({ where: { id: columnId } });
    statusValue = column?.name || 'todo';
  }

  const lastTask = await prisma.task.findFirst({ where: { column_id: columnId }, orderBy: { order: 'desc' } });
  const newOrder = lastTask ? lastTask.order + 1 : 0;

  return await prisma.task.create({
    data: {
      team_id: teamId, column_id: columnId, title: data.title, description: data.description,
      required_capabilities: data.required_capabilities || [], priority: data.priority || 'medium',
      due_date: data.due_date, created_by_id: agentId, created_by_user_id: userId,
      status: statusValue, order: newOrder,
    },
  });
}

export async function getTeamTasks(teamId: string): Promise<Task[]> {
  return await prisma.task.findMany({
    where: { team_id: teamId },
    include: {
      assigned_to: { select: { id: true, name: true, capabilities: true } },
      created_by: { select: { id: true, name: true } },
    },
    orderBy: [{ column_id: 'asc' }, { order: 'asc' }],
  });
}

export async function getTaskById(taskId: string): Promise<Task | null> {
  return await prisma.task.findUnique({
    where: { id: taskId },
    include: { team: true, assigned_to: true, created_by: true },
  });
}

export async function claimTask(taskId: string, agentId: string, _message?: string): Promise<Task> {
  return await prisma.$transaction(async (tx: any) => {
    const task = await tx.task.findUnique({ where: { id: taskId }, include: { team: true } });
    if (!task) throw new Error('Task not found');
    if (task.assigned_to_id) throw new Error('Task already claimed');

    const member = await tx.teamMember.findFirst({ where: { team_id: task.team_id, agent_id: agentId } });
    if (!member) throw new Error('Only team members can claim tasks');

    const agent = await tx.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new Error('Agent not found');

    const skipCapabilityCheck = process.env.SKIP_CAPABILITY_CHECK === 'true';
    if (!skipCapabilityCheck && task.required_capabilities && task.required_capabilities.length > 0) {
      const missingCapabilities = task.required_capabilities.filter(
        (cap: string) => !agent.capabilities.includes(cap)
      );
      if (missingCapabilities.length > 0) {
        throw new Error(`Agent missing required capabilities: ${missingCapabilities.join(', ')}`);
      }
    }

    const updatedTask = await tx.task.update({
      where: { id: taskId },
      data: { assigned_to_id: agentId, status: 'in_progress' },
      include: { assigned_to: true, team: true },
    });

    await tx.taskAssignment.create({
      data: { task_id: taskId, agent_id: agentId, status: 'claimed', claimed_at: new Date() },
    });

    return updatedTask;
  });
}

export async function unclaimTask(taskId: string, agentId: string): Promise<Task> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error('Task not found');
  if (task.assigned_to_id !== agentId) throw new Error('Can only unclaim tasks assigned to you');

  return await prisma.task.update({
    where: { id: taskId },
    data: { assigned_to_id: null, status: 'todo' },
  });
}

export async function updateTask(
  taskId: string, agentId: string | null, userId: string | null, data: UpdateTaskInput
): Promise<Task> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error('Task not found');

  let isAuthorized = false;
  if (agentId) {
    const isAssigned = task.assigned_to_id === agentId;
    const member = await prisma.teamMember.findFirst({
      where: { team_id: task.team_id, agent_id: agentId, role: { in: ['owner', 'admin'] } },
    });
    isAuthorized = isAssigned || !!member;
  }
  if (userId) {
    const isCreator = task.created_by_user_id === userId;
    const team = await prisma.team.findUnique({ where: { id: task.team_id } });
    isAuthorized = isCreator || team?.created_by_user === userId;
  }
  if (!isAuthorized) throw new Error('Not authorized to update this task');

  let statusToSet = data.status;
  if ((data as any).column_id) {
    const column = await prisma.column.findUnique({ where: { id: (data as any).column_id } });
    if (column) statusToSet = column.name;
  }

  return await prisma.task.update({
    where: { id: taskId },
    data: {
      title: data.title, description: data.description, status: statusToSet,
      priority: data.priority, due_date: data.due_date, assigned_to_id: data.assigned_to,
      column_id: (data as any).column_id,
    },
  });
}

export async function requestCollaboration(
  taskId: string, agentId: string, message: string, requiredCapabilities?: string[]
): Promise<any> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error('Task not found');
  if (task.assigned_to_id !== agentId) throw new Error('Only assigned agent can request collaboration');

  const teamMembers = await prisma.teamMember.findMany({
    where: { team_id: task.team_id, agent_id: { not: agentId } },
    include: { agent: true },
  });

  let matchingAgents = teamMembers.map((m: any) => m.agent);
  if (requiredCapabilities && requiredCapabilities.length > 0) {
    matchingAgents = matchingAgents.filter((agent: any) =>
      requiredCapabilities.some((cap: string) => agent.capabilities.includes(cap))
    );
  }

  return {
    task_id: taskId, message,
    matching_agents: matchingAgents.map((a: any) => ({ id: a.id, name: a.name, capabilities: a.capabilities })),
  };
}

export async function completeTask(taskId: string, agentId: string): Promise<Task> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error('Task not found');
  if (task.assigned_to_id !== agentId) throw new Error('Only assigned agent can complete task');

  return await prisma.task.update({
    where: { id: taskId },
    data: { status: 'review', completed_at: new Date() },
  });
}

export async function deleteTask(taskId: string, agentId: string | null, userId: string | null): Promise<void> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error('Task not found');

  let isAuthorized = false;
  if (agentId) {
    const isCreator = task.created_by_id === agentId;
    const member = await prisma.teamMember.findFirst({
      where: { team_id: task.team_id, agent_id: agentId, role: { in: ['owner', 'admin'] } },
    });
    isAuthorized = isCreator || !!member;
  }
  if (userId) {
    const isCreator = task.created_by_user_id === userId;
    const team = await prisma.team.findUnique({ where: { id: task.team_id } });
    isAuthorized = isCreator || team?.created_by_user === userId;
  }
  if (!isAuthorized) throw new Error('Not authorized to delete this task');

  await prisma.$transaction(async (tx: any) => {
    await tx.taskAssignment.deleteMany({ where: { task_id: taskId } });
    await tx.task.delete({ where: { id: taskId } });
  });
}

export async function reorderTasks(
  columnId: string, agentId: string | null, userId: string | null,
  taskOrders: Array<{ id: string; order: number }>
): Promise<void> {
  const column = await prisma.column.findUnique({ where: { id: columnId }, include: { team: true } });
  if (!column) throw new Error('Column not found');

  let isAuthorized = false;
  if (agentId) {
    const member = await prisma.teamMember.findFirst({ where: { team_id: column.team_id, agent_id: agentId } });
    isAuthorized = !!member;
  }
  if (userId) isAuthorized = column.team.created_by_user === userId;
  if (!isAuthorized) throw new Error('Only team members can reorder tasks');

  await prisma.$transaction(
    taskOrders.map((taskOrder) =>
      prisma.task.update({ where: { id: taskOrder.id }, data: { order: taskOrder.order } })
    )
  );
}
