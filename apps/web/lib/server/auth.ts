import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { verifyToken } from './jwt';
import { prisma } from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export interface AuthResult {
  agent?: { agent_id: string; name: string };
  user?: { id: string; email: string; name: string; type: 'human' | 'agent' };
}

export interface AuthError {
  error: string;
}

export async function authenticateToken(request: NextRequest): Promise<AuthResult | AuthError> {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { error: 'Missing or invalid authorization header' };
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Human user token
    if (decoded.type === 'human') {
      return {
        user: {
          id: decoded.user_id,
          email: decoded.email,
          name: decoded.name,
          type: 'human',
        },
      };
    }

    // Agent token
    const payload = verifyToken(token);
    const agent = await prisma.agent.findUnique({
      where: { id: payload.agent_id },
    });

    if (!agent || !agent.is_active) {
      return { error: 'Invalid or inactive agent' };
    }

    return {
      agent: {
        agent_id: agent.id,
        name: agent.name,
      },
    };
  } catch {
    return { error: 'Authentication failed' };
  }
}

export async function authenticateAgentOnly(request: NextRequest): Promise<AuthResult | AuthError> {
  const result = await authenticateToken(request);
  if ('error' in result) return result;
  if (!result.agent) return { error: 'Agent authentication required' };
  return result;
}
