import { z } from 'zod';

// ============================================================
// USER VALIDATION
// ============================================================

export const signupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(100).optional(),
  nickname: z.string().min(2, 'Nickname must be at least 2 characters').max(30).regex(/^[a-zA-Z0-9_-]+$/, 'Nickname can only contain letters, numbers, _ and -').optional(),
  avatar_id: z.number().int().min(1).max(41).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const updateEmailSchema = z.object({
  newEmail: z.string().email('Invalid email format'),
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const updateNameSchema = z.object({
  newName: z.string().min(1, 'Name is required').max(100),
});

export const updateNicknameSchema = z.object({
  nickname: z.string().min(2, 'Nickname must be at least 2 characters').max(30).regex(/^[a-zA-Z0-9_-]+$/, 'Nickname can only contain letters, numbers, _ and -'),
});

export const updateAvatarSchema = z.object({
  avatar_id: z.number().int().min(1).max(41),
});

// ============================================================
// AGENT VALIDATION
// ============================================================

export const registerAgentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(1000).optional(),
  capabilities: z.array(z.string().max(100)).min(1, 'At least one capability is required').max(50),
  personality: z.string().max(1000).optional(),
  webhook_url: z.string().url('Invalid webhook URL').optional().refine(
    (url) => {
      if (!url) return true;
      try {
        const parsed = new URL(url);
        // Block internal/private IPs
        const hostname = parsed.hostname.toLowerCase();
        const blocked = [
          'localhost', '127.0.0.1', '0.0.0.0', '::1',
          '169.254.', '10.', '172.16.', '172.17.', '172.18.',
          '172.19.', '172.20.', '172.21.', '172.22.', '172.23.',
          '172.24.', '172.25.', '172.26.', '172.27.', '172.28.',
          '172.29.', '172.30.', '172.31.', '192.168.',
        ];
        return !blocked.some((b) => hostname === b || hostname.startsWith(b));
      } catch {
        return false;
      }
    },
    { message: 'Webhook URL cannot point to internal/private addresses' }
  ),
});

// ============================================================
// TEAM VALIDATION
// ============================================================

export const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100),
  description: z.string().max(1000).optional(),
  visibility: z.enum(['public', 'private']).optional().default('public'),
  auto_accept: z.boolean().optional().default(false),
});

export const inviteSchema = z.object({
  agent_id: z.string().optional(),
  user_email: z.string().email().optional(),
  role: z.enum(['member', 'admin']).optional().default('member'),
}).refine((data) => data.agent_id || data.user_email, {
  message: 'Either agent_id or user_email is required',
});

// ============================================================
// TASK VALIDATION
// ============================================================

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(5000).optional(),
  required_capabilities: z.array(z.string().max(100)).max(20).optional().default([]),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  column_id: z.string().optional(),
  due_date: z.string().datetime().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  status: z.string().max(50).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  assigned_to: z.string().optional(),
  column_id: z.string().optional(),
  due_date: z.string().datetime().nullable().optional(),
});

export const reorderSchema = z.array(
  z.object({
    id: z.string(),
    order: z.number().int().min(0),
  })
).min(1);

// ============================================================
// COLUMN VALIDATION
// ============================================================

export const createColumnSchema = z.object({
  name: z.string().min(1, 'Column name is required').max(100),
  color: z.string().max(50).optional().default('bg-gray-100'),
});

// ============================================================
// MESSAGE VALIDATION
// ============================================================

export const sendMessageSchema = z.object({
  content: z.string().min(1, 'Message content is required').max(10000),
  type: z.enum(['message', 'system', 'collaboration_request']).optional().default('message'),
});

// ============================================================
// HELPER
// ============================================================

export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map((e) => e.message).join(', ');
    throw new Error(errors);
  }
  return result.data;
}
