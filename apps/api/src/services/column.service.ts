import { prisma } from '../lib/prisma';

/**
 * Get all columns for a team
 */
export async function getTeamColumns(teamId: string) {
  return await prisma.column.findMany({
    where: { team_id: teamId },
    orderBy: { order: 'asc' },
  });
}

/**
 * Create a new column
 */
export async function createColumn(
  teamId: string,
  agentId: string | null,
  userId: string | null,
  name: string,
  color: string = 'bg-gray-100'
) {
  // Authorization check
  let isAuthorized = false;

  // Check agent permissions
  if (agentId) {
    const member = await prisma.teamMember.findFirst({
      where: {
        team_id: teamId,
        agent_id: agentId,
      },
    });
    isAuthorized = !!member;
  }

  // Check user permissions (human creator)
  if (userId) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });
    const isTeamCreator = team?.created_by_user === userId;
    isAuthorized = isTeamCreator;
  }

  if (!isAuthorized) {
    throw new Error('Only team members can create columns');
  }

  // Get the highest order number
  const lastColumn = await prisma.column.findFirst({
    where: { team_id: teamId },
    orderBy: { order: 'desc' },
  });

  const order = lastColumn ? lastColumn.order + 1 : 0;

  return await prisma.column.create({
    data: {
      team_id: teamId,
      name,
      color,
      order,
    },
  });
}

/**
 * Update column name and/or color
 */
export async function updateColumn(
  columnId: string,
  agentId: string | null,
  userId: string | null,
  name?: string,
  color?: string
) {
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
    throw new Error('Only team members can update columns');
  }

  return await prisma.column.update({
    where: { id: columnId },
    data: {
      ...(name && { name }),
      ...(color && { color }),
    },
  });
}

/**
 * Delete column and optionally migrate tasks
 */
export async function deleteColumn(
  columnId: string,
  agentId: string | null,
  userId: string | null,
  migrationColumnId?: string
) {
  const column = await prisma.column.findUnique({
    where: { id: columnId },
    include: {
      tasks: true,
      team: {
        include: {
          columns: true,
        },
      },
    },
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
    throw new Error('Only team members can delete columns');
  }

  // Check if this is the last column
  if (column.team.columns.length === 1) {
    throw new Error('Cannot delete the last column');
  }

  // If there are tasks in this column, we need to migrate them
  if (column.tasks.length > 0) {
    if (!migrationColumnId) {
      throw new Error('Cannot delete column with tasks without specifying migration column');
    }

    // Migrate all tasks to the new column
    await prisma.task.updateMany({
      where: { column_id: columnId },
      data: { column_id: migrationColumnId },
    });
  }

  // Delete the column
  await prisma.column.delete({
    where: { id: columnId },
  });

  return { success: true };
}

/**
 * Reorder columns
 */
export async function reorderColumns(
  teamId: string,
  agentId: string | null,
  userId: string | null,
  columnOrders: { id: string; order: number }[]
) {
  // Authorization check
  let isAuthorized = false;

  // Check agent permissions
  if (agentId) {
    const member = await prisma.teamMember.findFirst({
      where: {
        team_id: teamId,
        agent_id: agentId,
      },
    });
    isAuthorized = !!member;
  }

  // Check user permissions (human creator)
  if (userId) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });
    const isTeamCreator = team?.created_by_user === userId;
    isAuthorized = isTeamCreator;
  }

  if (!isAuthorized) {
    throw new Error('Only team members can reorder columns');
  }

  // Update each column's order
  const updates = columnOrders.map(({ id, order }) =>
    prisma.column.update({
      where: { id },
      data: { order },
    })
  );

  await prisma.$transaction(updates);

  return await getTeamColumns(teamId);
}

/**
 * Create default columns for a new team
 */
export async function createDefaultColumns(teamId: string) {
  const defaultColumns = [
    { name: 'Todo', color: 'bg-blue-100', order: 0 },
    { name: 'Doing', color: 'bg-yellow-100', order: 1 },
    { name: 'Done', color: 'bg-green-100', order: 2 },
  ];

  const columns = await prisma.$transaction(
    defaultColumns.map((col) =>
      prisma.column.create({
        data: {
          team_id: teamId,
          name: col.name,
          color: col.color,
          order: col.order,
        },
      })
    )
  );

  return columns;
}
