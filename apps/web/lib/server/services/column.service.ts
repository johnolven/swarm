import { prisma } from '../prisma';

export async function getTeamColumns(teamId: string) {
  return await prisma.column.findMany({
    where: { team_id: teamId },
    orderBy: { order: 'asc' },
  });
}

export async function createColumn(
  teamId: string, agentId: string | null, userId: string | null, name: string, color: string = 'bg-gray-100'
) {
  let isAuthorized = false;
  if (agentId) {
    const member = await prisma.teamMember.findFirst({ where: { team_id: teamId, agent_id: agentId } });
    isAuthorized = !!member;
  }
  if (userId) {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    isAuthorized = team?.created_by_user === userId;
  }
  if (!isAuthorized) throw new Error('Only team members can create columns');

  const lastColumn = await prisma.column.findFirst({ where: { team_id: teamId }, orderBy: { order: 'desc' } });
  const order = lastColumn ? lastColumn.order + 1 : 0;

  return await prisma.column.create({
    data: { team_id: teamId, name, color, order },
  });
}

export async function updateColumn(
  columnId: string, agentId: string | null, userId: string | null, name?: string, color?: string
) {
  const column = await prisma.column.findUnique({ where: { id: columnId }, include: { team: true } });
  if (!column) throw new Error('Column not found');

  let isAuthorized = false;
  if (agentId) {
    const member = await prisma.teamMember.findFirst({ where: { team_id: column.team_id, agent_id: agentId } });
    isAuthorized = !!member;
  }
  if (userId) isAuthorized = column.team.created_by_user === userId;
  if (!isAuthorized) throw new Error('Only team members can update columns');

  return await prisma.column.update({
    where: { id: columnId },
    data: { ...(name && { name }), ...(color && { color }) },
  });
}

export async function deleteColumn(
  columnId: string, agentId: string | null, userId: string | null, migrationColumnId?: string
) {
  const column = await prisma.column.findUnique({
    where: { id: columnId },
    include: { tasks: true, team: { include: { columns: true } } },
  });
  if (!column) throw new Error('Column not found');

  let isAuthorized = false;
  if (agentId) {
    const member = await prisma.teamMember.findFirst({ where: { team_id: column.team_id, agent_id: agentId } });
    isAuthorized = !!member;
  }
  if (userId) isAuthorized = column.team.created_by_user === userId;
  if (!isAuthorized) throw new Error('Only team members can delete columns');
  if (column.team.columns.length === 1) throw new Error('Cannot delete the last column');

  if (column.tasks.length > 0) {
    if (!migrationColumnId) throw new Error('Cannot delete column with tasks without specifying migration column');
    await prisma.task.updateMany({ where: { column_id: columnId }, data: { column_id: migrationColumnId } });
  }

  await prisma.column.delete({ where: { id: columnId } });
  return { success: true };
}

export async function reorderColumns(
  teamId: string, agentId: string | null, userId: string | null, columnOrders: { id: string; order: number }[]
) {
  let isAuthorized = false;
  if (agentId) {
    const member = await prisma.teamMember.findFirst({ where: { team_id: teamId, agent_id: agentId } });
    isAuthorized = !!member;
  }
  if (userId) {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    isAuthorized = team?.created_by_user === userId;
  }
  if (!isAuthorized) throw new Error('Only team members can reorder columns');

  await prisma.$transaction(
    columnOrders.map(({ id, order }) => prisma.column.update({ where: { id }, data: { order } }))
  );

  return await getTeamColumns(teamId);
}
