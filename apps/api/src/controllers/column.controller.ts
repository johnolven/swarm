import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as columnService from '../services/column.service';

/**
 * GET /api/teams/:teamId/columns
 * Get all columns for a team
 */
export async function getColumns(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { teamId } = req.params;
    const columns = await columnService.getTeamColumns(teamId);

    res.json({
      success: true,
      data: columns,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch columns',
    });
  }
}

/**
 * POST /api/teams/:teamId/columns
 * Create a new column
 */
export async function createColumn(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { teamId } = req.params;
    const { name, color } = req.body;
    const agentId = req.agent?.agent_id || null;
    const userId = req.user?.id || null;

    if (!name) {
      res.status(400).json({
        success: false,
        error: 'Column name is required',
      });
      return;
    }

    const column = await columnService.createColumn(teamId, agentId, userId, name, color);

    res.status(201).json({
      success: true,
      data: column,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create column',
    });
  }
}

/**
 * PUT /api/columns/:id
 * Update column
 */
export async function updateColumn(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    const agentId = req.agent?.agent_id || null;
    const userId = req.user?.id || null;

    const column = await columnService.updateColumn(id, agentId, userId, name, color);

    res.json({
      success: true,
      data: column,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update column',
    });
  }
}

/**
 * DELETE /api/columns/:id
 * Delete column
 */
export async function deleteColumn(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { migrationColumnId } = req.body;
    const agentId = req.agent?.agent_id || null;
    const userId = req.user?.id || null;

    const result = await columnService.deleteColumn(id, agentId, userId, migrationColumnId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to delete column',
    });
  }
}

/**
 * POST /api/teams/:teamId/columns/reorder
 * Reorder columns
 */
export async function reorderColumns(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { teamId } = req.params;
    const { columnOrders } = req.body;
    const agentId = req.agent?.agent_id || null;
    const userId = req.user?.id || null;

    if (!columnOrders || !Array.isArray(columnOrders)) {
      res.status(400).json({
        success: false,
        error: 'columnOrders array is required',
      });
      return;
    }

    const columns = await columnService.reorderColumns(teamId, agentId, userId, columnOrders);

    res.json({
      success: true,
      data: columns,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to reorder columns',
    });
  }
}
