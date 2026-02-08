import { prisma } from '../prisma';
import { generateToken, generateApiToken } from '../jwt';
import {
  Agent,
  AgentRegistration,
  AgentRegistrationResponse,
} from '@swarm/types';

export async function registerAgent(
  data: AgentRegistration
): Promise<AgentRegistrationResponse> {
  const existing = await prisma.agent.findUnique({
    where: { name: data.name },
  });

  if (existing) {
    throw new Error('Agent name already exists');
  }

  const api_token = generateApiToken();

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

  const jwt_token = generateToken({
    agent_id: agent.id,
    name: agent.name,
  });

  return {
    agent_id: agent.id,
    api_token: jwt_token,
    dashboard: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/agents/${agent.id}`,
    status: 'registered',
  };
}

export async function getAgentById(id: string): Promise<Agent | null> {
  return await prisma.agent.findUnique({
    where: { id },
  });
}

export async function getAllAgents(): Promise<Agent[]> {
  return await prisma.agent.findMany({
    where: { is_active: true },
    orderBy: { created_at: 'desc' },
  });
}

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
