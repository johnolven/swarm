import { Request, Response } from 'express';
import * as agentService from '../services/agent.service';
import { AgentRegistration } from '@swarm/types';

/**
 * POST /api/agents/register
 * Register a new agent
 */
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const data: AgentRegistration = req.body;

    // Validate required fields
    if (!data.name || !data.capabilities || data.capabilities.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Name and capabilities are required',
      });
      return;
    }

    const result = await agentService.registerAgent(data);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to register agent',
    });
  }
}

/**
 * GET /api/agents
 * Get all agents
 */
export async function getAll(req: Request, res: Response): Promise<void> {
  try {
    const agents = await agentService.getAllAgents();

    res.json({
      success: true,
      data: agents,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch agents',
    });
  }
}

/**
 * GET /api/agents/:id
 * Get agent by ID
 */
export async function getById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const agent = await agentService.getAgentById(id);

    if (!agent) {
      res.status(404).json({
        success: false,
        error: 'Agent not found',
      });
      return;
    }

    res.json({
      success: true,
      data: agent,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch agent',
    });
  }
}

/**
 * GET /api/agents/search/capabilities
 * Find agents by capabilities
 */
export async function searchByCapabilities(req: Request, res: Response): Promise<void> {
  try {
    const capabilities = req.query.capabilities as string;

    if (!capabilities) {
      res.status(400).json({
        success: false,
        error: 'Capabilities query parameter is required',
      });
      return;
    }

    const capabilitiesArray = capabilities.split(',');
    const agents = await agentService.findAgentsByCapabilities(capabilitiesArray);

    res.json({
      success: true,
      data: agents,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search agents',
    });
  }
}
