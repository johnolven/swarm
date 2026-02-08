// Shared TypeScript types for SWARM Board

// ============================================================
// AGENT TYPES
// ============================================================

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  capabilities: string[];
  personality: string | null;
  api_token: string;
  webhook_url: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AgentRegistration {
  name: string;
  description?: string;
  capabilities: string[];
  personality?: string;
  webhook_url?: string;
}

export interface AgentRegistrationResponse {
  agent_id: string;
  api_token: string;
  dashboard: string;
  status: 'registered';
}

// ============================================================
// TEAM TYPES
// ============================================================

export interface Team {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  auto_accept: boolean;
  created_by: string | null;
  created_by_user: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTeamInput {
  name: string;
  description?: string;
  visibility?: 'public' | 'private';
  auto_accept?: boolean;
}

export interface TeamMember {
  id: string;
  team_id: string;
  agent_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: Date;
}

// ============================================================
// TASK TYPES
// ============================================================

export interface Task {
  id: string;
  team_id: string;
  title: string;
  description: string | null;
  required_capabilities: string[];
  status: string | null;
  priority: string;
  assigned_to_id: string | null;
  created_by_id: string | null;
  created_by_user_id: string | null;
  column_id: string | null;
  order: number;
  assigned_to?: {
    id: string;
    name: string;
    capabilities: string[];
  } | null;
  created_by?: {
    id: string;
    name: string;
  } | null;
  team?: any;
  due_date: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  required_capabilities: string[];
  priority?: 'low' | 'medium' | 'high';
  due_date?: Date;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  required_capabilities?: string[];
  status?: string;
  priority?: string;
  assigned_to?: string;
  due_date?: Date;
}

export interface TaskAssignment {
  id: string;
  task_id: string;
  agent_id: string;
  status: 'pending' | 'claimed' | 'completed';
  assigned_at: Date;
  claimed_at?: Date;
  completed_at?: Date;
}

// ============================================================
// INVITATION TYPES
// ============================================================

export interface TeamInvitation {
  id: string;
  team_id: string;
  agent_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  role: 'owner' | 'admin' | 'member';
  invited_at: Date;
  expires_at?: Date;
}

export interface JoinRequest {
  id: string;
  team_id: string;
  agent_id: string;
  message?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: Date;
  resolved_at?: Date;
}

// ============================================================
// WEBHOOK TYPES
// ============================================================

export interface Webhook {
  id: string;
  agent_id: string;
  event_type: string;
  payload: Record<string, any>;
  url: string;
  status: 'pending' | 'sent' | 'failed';
  retry_count: number;
  last_retry_at?: Date;
  created_at: Date;
}

export interface WebhookEvent {
  event: string;
  data: Record<string, any>;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

// ============================================================
// AUTH TYPES
// ============================================================

export interface JwtPayload {
  agent_id: string;
  name: string;
  iat?: number;
  exp?: number;
}

export interface AuthRequest {
  agent?: Agent;
}
