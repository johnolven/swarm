import { prismaMock } from './prisma.mock';
import { authenticate, authenticateToken, AuthRequest } from '../middleware/auth';
import { generateToken, generateUserToken } from '../lib/jwt';
import { Response, NextFunction } from 'express';

function createMockReqRes(authHeader?: string) {
  const req = {
    headers: {
      authorization: authHeader,
    },
  } as unknown as AuthRequest;

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;

  const next: NextFunction = jest.fn();

  return { req, res, next };
}

describe('Auth Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticate (agent-only)', () => {
    it('should reject requests without Authorization header', async () => {
      const { req, res, next } = createMockReqRes();

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Missing or invalid authorization header' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject requests without Bearer prefix', async () => {
      const { req, res, next } = createMockReqRes('Token abc123');

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid JWT tokens', async () => {
      const { req, res, next } = createMockReqRes('Bearer invalid-token');

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Authentication failed' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject inactive agents', async () => {
      const token = generateToken({ agent_id: 'agent-123', name: 'TestBot' });
      prismaMock.agent.findUnique.mockResolvedValue({
        id: 'agent-123',
        name: 'TestBot',
        is_active: false,
      });

      const { req, res, next } = createMockReqRes(`Bearer ${token}`);
      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Invalid or inactive agent' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject non-existent agents', async () => {
      const token = generateToken({ agent_id: 'nonexistent', name: 'Ghost' });
      prismaMock.agent.findUnique.mockResolvedValue(null);

      const { req, res, next } = createMockReqRes(`Bearer ${token}`);
      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should authenticate valid active agents and attach info to req', async () => {
      const token = generateToken({ agent_id: 'agent-123', name: 'TestBot' });
      prismaMock.agent.findUnique.mockResolvedValue({
        id: 'agent-123',
        name: 'TestBot',
        is_active: true,
      });

      const { req, res, next } = createMockReqRes(`Bearer ${token}`);
      await authenticate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.agent).toEqual({
        agent_id: 'agent-123',
        name: 'TestBot',
      });
    });
  });

  describe('authenticateToken (agent + human)', () => {
    it('should authenticate human users', async () => {
      const token = generateUserToken({
        user_id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      });

      const { req, res, next } = createMockReqRes(`Bearer ${token}`);
      await authenticateToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        type: 'human',
      });
      expect(req.agent).toBeUndefined();
    });

    it('should authenticate agents via authenticateToken', async () => {
      const token = generateToken({ agent_id: 'agent-456', name: 'AgentBot' });
      prismaMock.agent.findUnique.mockResolvedValue({
        id: 'agent-456',
        name: 'AgentBot',
        is_active: true,
      });

      const { req, res, next } = createMockReqRes(`Bearer ${token}`);
      await authenticateToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.agent).toEqual({
        agent_id: 'agent-456',
        name: 'AgentBot',
      });
      expect(req.user).toBeUndefined();
    });

    it('should reject inactive agents via authenticateToken', async () => {
      const token = generateToken({ agent_id: 'agent-dead', name: 'DeadBot' });
      prismaMock.agent.findUnique.mockResolvedValue({
        id: 'agent-dead',
        name: 'DeadBot',
        is_active: false,
      });

      const { req, res, next } = createMockReqRes(`Bearer ${token}`);
      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject requests with no auth header', async () => {
      const { req, res, next } = createMockReqRes();

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
