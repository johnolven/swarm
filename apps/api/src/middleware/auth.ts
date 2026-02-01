import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

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

/**
 * Middleware to authenticate requests using Bearer token
 */
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    const payload = verifyToken(token);

    // Check if agent exists and is active
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

    // Attach agent info to request
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
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Check if it's a human user token
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

    // Otherwise, it's an agent token
    const payload = verifyToken(token);

    // Check if agent exists and is active
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

    // Attach agent info to request
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
