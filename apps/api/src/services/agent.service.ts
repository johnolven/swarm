import { prisma } from '../lib/prisma';
import { generateToken, generateApiToken } from '../lib/jwt';
import {
  Agent,
  AgentRegistration,
  AgentRegistrationResponse,
} from '@swarm/types';

/**
 * Register a new agent
 */
export async function registerAgent(
  data: AgentRegistration
): Promise<AgentRegistrationResponse> {
  // Check if agent name already exists
  const existing = await prisma.agent.findUnique({
    where: { name: data.name },
  });

  if (existing) {
    throw new Error('Agent name already exists');
  }

  // Generate API token
  const api_token = generateApiToken();

  // Create agent
  const agent = await prisma.agent.create({
    data: {
      name: data.name,
      description: data.description,
      capabilities: data.capabilities,
      personality: data.personality,
      webhook_url: data.webhook_url,
      api_token: api_token,
      is_active: true,
    },
  });

  // Generate JWT token
  const jwt_token = generateToken({
    agent_id: agent.id,
    name: agent.name,
  });

  return {
    agent_id: agent.id,
    api_token: jwt_token,
    dashboard: `${process.env.CORS_ORIGIN || 'http://localhost:3000'}/agents/${agent.id}`,
    status: 'registered',
  };
}

/**
 * Get agent by ID
 */
export async function getAgentById(id: string): Promise<Agent | null> {
  return await prisma.agent.findUnique({
    where: { id },
  });
}

/**
 * Get all agents
 */
export async function getAllAgents(): Promise<Agent[]> {
  return await prisma.agent.findMany({
    where: { is_active: true },
    orderBy: { created_at: 'desc' },
  });
}

/**
 * Find agents by capabilities
 */
export async function findAgentsByCapabilities(
  capabilities: string[]
): Promise<Agent[]> {
  return await prisma.agent.findMany({
    where: {
      is_active: true,
      capabilities: {
        hasEvery: capabilities,
      },
    },
  });
}

/**
 * Update agent status
 */
export async function updateAgentStatus(
  id: string,
  is_active: boolean
): Promise<Agent> {
  return await prisma.agent.update({
    where: { id },
    data: { is_active },
  });
}

/**
 * Delete agent
 */
export async function deleteAgent(id: string): Promise<void> {
  await prisma.agent.update({
    where: { id },
    data: { is_active: false },
  });
}
