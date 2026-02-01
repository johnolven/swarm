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
  name: string,
  color: string = 'bg-gray-100'
) {
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
  name?: string,
  color?: string
) {
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
export async function reorderColumns(teamId: string, columnOrders: { id: string; order: number }[]) {
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
