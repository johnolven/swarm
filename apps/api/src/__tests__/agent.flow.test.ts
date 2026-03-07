import { prismaMock } from './prisma.mock';
import { generateToken, generateApiToken, verifyToken, generateUserToken } from '../lib/jwt';
import * as agentService from '../services/agent.service';

describe('Agent Registration Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('JWT Token Generation', () => {
    it('should generate a valid agent token', () => {
      const token = generateToken({ agent_id: 'agent-123', name: 'TestBot' });
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should generate a valid human user token', () => {
      const token = generateUserToken({
        user_id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      });
      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(3);
    });

    it('should verify an agent token and return payload', () => {
      const token = generateToken({ agent_id: 'agent-123', name: 'TestBot' });
      const payload = verifyToken(token);
      expect(payload.agent_id).toBe('agent-123');
      expect(payload.name).toBe('TestBot');
    });

    it('should verify a human token and include type', () => {
      const token = generateUserToken({
        user_id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      });
      const payload = verifyToken(token) as any;
      expect(payload.type).toBe('human');
      expect(payload.user_id).toBe('user-123');
      expect(payload.email).toBe('test@example.com');
    });

    it('should throw on invalid token', () => {
      expect(() => verifyToken('invalid-token')).toThrow('Invalid or expired token');
    });

    it('should throw on tampered token', () => {
      const token = generateToken({ agent_id: 'agent-123', name: 'TestBot' });
      const tampered = token.slice(0, -5) + 'XXXXX';
      expect(() => verifyToken(tampered)).toThrow('Invalid or expired token');
    });
  });

  describe('API Token Generation', () => {
    it('should generate tokens with correct prefix', () => {
      const token = generateApiToken();
      expect(token).toMatch(/^swarm_sk_live_/);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set(Array.from({ length: 100 }, () => generateApiToken()));
      expect(tokens.size).toBe(100);
    });

    it('should generate tokens with sufficient length', () => {
      const token = generateApiToken();
      // prefix (14) + 64 hex chars from 32 bytes
      expect(token.length).toBe(14 + 64);
    });
  });

  describe('Agent Service - registerAgent', () => {
    const validAgentData = {
      name: 'TestBot',
      description: 'A test bot',
      capabilities: ['code-review', 'testing'],
      personality: 'helpful',
    };

    it('should register a new agent successfully', async () => {
      prismaMock.agent.findUnique.mockResolvedValue(null); // no existing agent
      prismaMock.agent.create.mockResolvedValue({
        id: 'agent-new-123',
        name: 'TestBot',
        description: 'A test bot',
        capabilities: ['code-review', 'testing'],
        personality: 'helpful',
        api_token: 'swarm_sk_live_abc123',
        webhook_url: null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await agentService.registerAgent(validAgentData);

      expect(result.agent_id).toBe('agent-new-123');
      expect(result.api_token).toBeDefined();
      expect(result.status).toBe('registered');
      expect(result.dashboard).toContain('/agents/agent-new-123');

      // Verify prisma was called correctly
      expect(prismaMock.agent.findUnique).toHaveBeenCalledWith({
        where: { name: 'TestBot' },
      });
      expect(prismaMock.agent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'TestBot',
          capabilities: ['code-review', 'testing'],
          is_active: true,
        }),
      });
    });

    it('should return a valid JWT as api_token', async () => {
      prismaMock.agent.findUnique.mockResolvedValue(null);
      prismaMock.agent.create.mockResolvedValue({
        id: 'agent-jwt-test',
        name: 'JWTBot',
        capabilities: ['testing'],
        api_token: 'swarm_sk_live_xxx',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await agentService.registerAgent({
        name: 'JWTBot',
        capabilities: ['testing'],
      });

      // The api_token returned should be a JWT, not the raw api_token
      const decoded = verifyToken(result.api_token);
      expect(decoded.agent_id).toBe('agent-jwt-test');
      expect(decoded.name).toBe('JWTBot');
    });

    it('should reject duplicate agent names', async () => {
      prismaMock.agent.findUnique.mockResolvedValue({
        id: 'existing-agent',
        name: 'TestBot',
      });

      await expect(
        agentService.registerAgent(validAgentData)
      ).rejects.toThrow('Agent name already exists');
    });

    it('should store the generated api_token in the database', async () => {
      prismaMock.agent.findUnique.mockResolvedValue(null);
      prismaMock.agent.create.mockImplementation(async ({ data }: any) => ({
        id: 'agent-token-test',
        ...data,
        created_at: new Date(),
        updated_at: new Date(),
      }));

      await agentService.registerAgent(validAgentData);

      const createCall = prismaMock.agent.create.mock.calls[0][0];
      expect(createCall.data.api_token).toMatch(/^swarm_sk_live_/);
      expect(createCall.data.api_token.length).toBeGreaterThan(30);
    });
  });

  describe('Agent Service - getAgentById', () => {
    it('should return agent when found', async () => {
      const mockAgent = {
        id: 'agent-123',
        name: 'TestBot',
        capabilities: ['testing'],
        is_active: true,
      };
      prismaMock.agent.findUnique.mockResolvedValue(mockAgent);

      const result = await agentService.getAgentById('agent-123');
      expect(result).toEqual(mockAgent);
    });

    it('should return null when agent not found', async () => {
      prismaMock.agent.findUnique.mockResolvedValue(null);

      const result = await agentService.getAgentById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('Agent Service - getAllAgents', () => {
    it('should return only active agents', async () => {
      const mockAgents = [
        { id: '1', name: 'Bot1', is_active: true },
        { id: '2', name: 'Bot2', is_active: true },
      ];
      prismaMock.agent.findMany.mockResolvedValue(mockAgents);

      const result = await agentService.getAllAgents();
      expect(result).toHaveLength(2);
      expect(prismaMock.agent.findMany).toHaveBeenCalledWith({
        where: { is_active: true },
        orderBy: { created_at: 'desc' },
      });
    });
  });

  describe('Agent Service - findAgentsByCapabilities', () => {
    it('should filter agents by capabilities', async () => {
      prismaMock.agent.findMany.mockResolvedValue([
        { id: '1', name: 'CodeBot', capabilities: ['code-review', 'testing'] },
      ]);

      const result = await agentService.findAgentsByCapabilities(['code-review']);
      expect(result).toHaveLength(1);
      expect(prismaMock.agent.findMany).toHaveBeenCalledWith({
        where: {
          is_active: true,
          capabilities: { hasEvery: ['code-review'] },
        },
      });
    });
  });

  describe('Agent Service - updateAgentStatus', () => {
    it('should deactivate an agent', async () => {
      prismaMock.agent.update.mockResolvedValue({
        id: 'agent-123',
        is_active: false,
      });

      const result = await agentService.updateAgentStatus('agent-123', false);
      expect(result.is_active).toBe(false);
    });
  });

  describe('Agent Service - deleteAgent (soft delete)', () => {
    it('should soft delete by setting is_active to false', async () => {
      prismaMock.agent.update.mockResolvedValue({
        id: 'agent-123',
        is_active: false,
      });

      await agentService.deleteAgent('agent-123');
      expect(prismaMock.agent.update).toHaveBeenCalledWith({
        where: { id: 'agent-123' },
        data: { is_active: false },
      });
    });
  });
});
