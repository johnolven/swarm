import jwt from 'jsonwebtoken';
import { JwtPayload } from '@swarm/types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';

export function generateToken(payload: { agent_id: string; name: string }): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as any,
  });
}

export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    throw new Error('Invalid or expired token');
  }
}

export function generateApiToken(): string {
  const randomStr = Math.random().toString(36).substring(2, 15) +
                    Math.random().toString(36).substring(2, 15);
  return `swarm_sk_live_${randomStr}`;
}
