import {
  registerAgentSchema,
  signupSchema,
  loginSchema,
  createTeamSchema,
  createTaskSchema,
  sendMessageSchema,
  reorderSchema,
  validate,
} from '../lib/validation';

describe('Validation Schemas', () => {
  describe('registerAgentSchema', () => {
    it('should accept valid agent registration', () => {
      const data = validate(registerAgentSchema, {
        name: 'TestBot',
        capabilities: ['code-review', 'testing'],
        description: 'A helpful bot',
        personality: 'friendly',
      });
      expect(data.name).toBe('TestBot');
      expect(data.capabilities).toEqual(['code-review', 'testing']);
    });

    it('should accept minimal agent registration', () => {
      const data = validate(registerAgentSchema, {
        name: 'MinBot',
        capabilities: ['general'],
      });
      expect(data.name).toBe('MinBot');
      expect(data.capabilities).toEqual(['general']);
    });

    it('should reject registration without name', () => {
      expect(() =>
        validate(registerAgentSchema, { capabilities: ['test'] })
      ).toThrow();
    });

    it('should reject registration without capabilities', () => {
      expect(() =>
        validate(registerAgentSchema, { name: 'NoCapBot' })
      ).toThrow();
    });

    it('should reject registration with empty capabilities', () => {
      expect(() =>
        validate(registerAgentSchema, { name: 'EmptyBot', capabilities: [] })
      ).toThrow('At least one capability is required');
    });

    it('should reject registration with empty name', () => {
      expect(() =>
        validate(registerAgentSchema, { name: '', capabilities: ['test'] })
      ).toThrow();
    });

    it('should accept valid webhook URL', () => {
      const data = validate(registerAgentSchema, {
        name: 'WebhookBot',
        capabilities: ['notify'],
        webhook_url: 'https://example.com/webhook',
      });
      expect(data.webhook_url).toBe('https://example.com/webhook');
    });

    it('should reject localhost webhook URLs (SSRF)', () => {
      expect(() =>
        validate(registerAgentSchema, {
          name: 'SSRFBot',
          capabilities: ['hack'],
          webhook_url: 'http://localhost:6379/cmd',
        })
      ).toThrow('internal/private');
    });

    it('should reject 127.0.0.1 webhook URLs (SSRF)', () => {
      expect(() =>
        validate(registerAgentSchema, {
          name: 'SSRFBot2',
          capabilities: ['hack'],
          webhook_url: 'http://127.0.0.1:9200/_search',
        })
      ).toThrow('internal/private');
    });

    it('should reject private IP webhook URLs (SSRF)', () => {
      expect(() =>
        validate(registerAgentSchema, {
          name: 'SSRFBot3',
          capabilities: ['hack'],
          webhook_url: 'http://192.168.1.1/admin',
        })
      ).toThrow('internal/private');
    });

    it('should reject 10.x.x.x webhook URLs (SSRF)', () => {
      expect(() =>
        validate(registerAgentSchema, {
          name: 'SSRFBot4',
          capabilities: ['hack'],
          webhook_url: 'http://10.0.0.1/internal',
        })
      ).toThrow('internal/private');
    });

    it('should reject invalid URL format', () => {
      expect(() =>
        validate(registerAgentSchema, {
          name: 'BadURLBot',
          capabilities: ['test'],
          webhook_url: 'not-a-url',
        })
      ).toThrow();
    });

    it('should reject overly long name', () => {
      expect(() =>
        validate(registerAgentSchema, {
          name: 'A'.repeat(101),
          capabilities: ['test'],
        })
      ).toThrow();
    });
  });

  describe('signupSchema', () => {
    it('should accept valid signup data', () => {
      const data = validate(signupSchema, {
        email: 'test@example.com',
        password: 'securepassword123',
        name: 'Test User',
      });
      expect(data.email).toBe('test@example.com');
    });

    it('should reject invalid email format', () => {
      expect(() =>
        validate(signupSchema, { email: 'notanemail', password: 'password123' })
      ).toThrow('Invalid email');
    });

    it('should reject short password', () => {
      expect(() =>
        validate(signupSchema, { email: 'test@example.com', password: '123' })
      ).toThrow('at least 8 characters');
    });

    it('should accept signup without name (optional)', () => {
      const data = validate(signupSchema, {
        email: 'test@example.com',
        password: 'securepassword',
      });
      expect(data.name).toBeUndefined();
    });
  });

  describe('loginSchema', () => {
    it('should accept valid login data', () => {
      const data = validate(loginSchema, {
        email: 'test@example.com',
        password: 'anypassword',
      });
      expect(data.email).toBe('test@example.com');
    });

    it('should reject empty password', () => {
      expect(() =>
        validate(loginSchema, { email: 'test@example.com', password: '' })
      ).toThrow();
    });
  });

  describe('createTeamSchema', () => {
    it('should accept valid team with defaults', () => {
      const data = validate(createTeamSchema, { name: 'My Team' });
      expect(data.name).toBe('My Team');
      expect(data.visibility).toBe('public');
      expect(data.auto_accept).toBe(false);
    });

    it('should accept private team', () => {
      const data = validate(createTeamSchema, {
        name: 'Secret Team',
        visibility: 'private',
        auto_accept: true,
      });
      expect(data.visibility).toBe('private');
      expect(data.auto_accept).toBe(true);
    });

    it('should reject empty team name', () => {
      expect(() => validate(createTeamSchema, { name: '' })).toThrow();
    });

    it('should reject invalid visibility', () => {
      expect(() =>
        validate(createTeamSchema, { name: 'Team', visibility: 'hidden' })
      ).toThrow();
    });
  });

  describe('createTaskSchema', () => {
    it('should accept valid task with defaults', () => {
      const data = validate(createTaskSchema, { title: 'Fix bug' });
      expect(data.title).toBe('Fix bug');
      expect(data.priority).toBe('medium');
      expect(data.required_capabilities).toEqual([]);
    });

    it('should accept task with all fields', () => {
      const data = validate(createTaskSchema, {
        title: 'Review PR',
        description: 'Review pull request #42',
        priority: 'high',
        required_capabilities: ['code-review'],
        column_id: 'col-123',
      });
      expect(data.priority).toBe('high');
      expect(data.required_capabilities).toEqual(['code-review']);
    });

    it('should reject empty title', () => {
      expect(() => validate(createTaskSchema, { title: '' })).toThrow();
    });

    it('should reject invalid priority', () => {
      expect(() =>
        validate(createTaskSchema, { title: 'Test', priority: 'urgent' })
      ).toThrow();
    });
  });

  describe('sendMessageSchema', () => {
    it('should accept valid message', () => {
      const data = validate(sendMessageSchema, { content: 'Hello!' });
      expect(data.content).toBe('Hello!');
      expect(data.type).toBe('message');
    });

    it('should reject empty content', () => {
      expect(() => validate(sendMessageSchema, { content: '' })).toThrow();
    });

    it('should reject overly long message', () => {
      expect(() =>
        validate(sendMessageSchema, { content: 'A'.repeat(10001) })
      ).toThrow();
    });
  });

  describe('reorderSchema', () => {
    it('should accept valid reorder data', () => {
      const data = validate(reorderSchema, [
        { id: 'task-1', order: 0 },
        { id: 'task-2', order: 1 },
      ]);
      expect(data).toHaveLength(2);
    });

    it('should reject empty array', () => {
      expect(() => validate(reorderSchema, [])).toThrow();
    });

    it('should reject negative order', () => {
      expect(() =>
        validate(reorderSchema, [{ id: 'task-1', order: -1 }])
      ).toThrow();
    });

    it('should reject missing id', () => {
      expect(() => validate(reorderSchema, [{ order: 0 }])).toThrow();
    });
  });
});
