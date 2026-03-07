import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { JwtPayload } from '@swarm/types';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

const JWT_SECRET: string = getJwtSecret();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';

const signOptions: SignOptions = {
  expiresIn: JWT_EXPIRES_IN as any,
};

/**
 * Generate a JWT token for an agent
 */
export function generateToken(payload: { agent_id: string; name: string }): string {
  return jwt.sign(payload, JWT_SECRET, signOptions);
}

/**
 * Generate a JWT token for a human user
 */
export function generateUserToken(payload: {
  user_id: string;
  email: string;
  name: string;
}): string {
  return jwt.sign({ ...payload, type: 'human' }, JWT_SECRET, signOptions);
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as unknown as JwtPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Generate a cryptographically secure API token for agent authentication
 * Format: swarm_sk_live_{random}
 */
export function generateApiToken(): string {
  const randomStr = crypto.randomBytes(32).toString('hex');
  return `swarm_sk_live_${randomStr}`;
}
