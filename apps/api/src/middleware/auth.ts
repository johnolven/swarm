import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';

export interface AuthRequest extends Request {
  agent?: {
    agent_id: string;
    name: string;
  };
  user?: {
    id: string;
    email: string;
    name: string;
    type: 'human' | 'agent';
  };
}

function extractToken(req: Request, res: Response): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Missing or invalid authorization header',
    });
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Middleware to authenticate requests using Bearer token (agent-only)
 */
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req, res);
    if (!token) return;

    const payload = verifyToken(token);

    const agent = await prisma.agent.findUnique({
      where: { id: payload.agent_id },
    });

    if (!agent || !agent.is_active) {
      res.status(401).json({
        success: false,
        error: 'Invalid or inactive agent',
      });
      return;
    }

    req.agent = {
      agent_id: agent.id,
      name: agent.name,
    };

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
    });
  }
}

/**
 * Flexible authentication middleware that accepts both agent and human tokens
 */
export async function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req, res);
    if (!token) return;

    const decoded = verifyToken(token) as any;

    if (decoded.type === 'human') {
      req.user = {
        id: decoded.user_id,
        email: decoded.email,
        name: decoded.name,
        type: 'human',
      };
      next();
      return;
    }

    const agent = await prisma.agent.findUnique({
      where: { id: decoded.agent_id },
    });

    if (!agent || !agent.is_active) {
      res.status(401).json({
        success: false,
        error: 'Invalid or inactive agent',
      });
      return;
    }

    req.agent = {
      agent_id: agent.id,
      name: agent.name,
    };

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
    });
  }
}
