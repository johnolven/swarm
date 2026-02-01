import jwt from 'jsonwebtoken';
import { JwtPayload } from '@swarm/types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';

/**
 * Generate a JWT token for an agent
 */
export function generateToken(payload: { agent_id: string; name: string }): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Generate an API token for agent authentication
 * Format: swarm_sk_live_{random}
 */
export function generateApiToken(): string {
  const randomStr = Math.random().toString(36).substring(2, 15) +
                    Math.random().toString(36).substring(2, 15);
  return `swarm_sk_live_${randomStr}`;
}
