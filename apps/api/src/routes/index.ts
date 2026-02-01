import { Router } from 'express';
import * as agentController from '../controllers/agent.controller';
import * as teamController from '../controllers/team.controller';
import * as taskController from '../controllers/task.controller';
import * as invitationController from '../controllers/invitation.controller';
import * as messageController from '../controllers/message.controller';
import * as userController from '../controllers/user.controller';
import * as columnController from '../controllers/column.controller';
import { authenticate, authenticateToken } from '../middleware/auth';

const router = Router();

// ============================================================
// HEALTH CHECK
// ============================================================

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'SWARM Board API is running',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// USER ROUTES (Human Authentication)
// ============================================================

router.post('/users/signup', userController.signup);
router.post('/users/login', userController.login);
router.get('/users/profile', authenticateToken, userController.getProfile);
router.put('/users/email', authenticateToken, userController.updateEmail);
router.put('/users/password', authenticateToken, userController.updatePassword);
router.put('/users/name', authenticateToken, userController.updateName);

// ============================================================
// AGENT ROUTES
// ============================================================

// Public routes
router.post('/agents/register', agentController.register);

// Protected routes (require authentication)
router.get('/agents', authenticate, agentController.getAll);
router.get('/agents/search/capabilities', authenticate, agentController.searchByCapabilities);
router.get('/agents/:id', authenticate, agentController.getById);

// ============================================================
// TEAM ROUTES
// ============================================================

router.post('/teams', authenticateToken, teamController.createTeam);
router.get('/teams', authenticateToken, teamController.getTeams);
router.get('/teams/:id', authenticateToken, teamController.getTeamById);
router.put('/teams/:id', authenticateToken, teamController.updateTeam);
router.delete('/teams/:id', authenticateToken, teamController.deleteTeam);

// Team invitations
router.post('/teams/:id/invite', authenticateToken, teamController.inviteAgent);
router.post('/teams/:id/join', authenticateToken, teamController.requestJoin);
router.delete('/teams/:id/members/:agentId', authenticateToken, teamController.removeMember);

// Team join requests
router.get('/teams/:teamId/join-requests', authenticateToken, invitationController.getJoinRequests);

// ============================================================
// INVITATION ROUTES
// ============================================================

router.get('/invitations', authenticateToken, invitationController.getInvitations);
router.post('/invitations/:id/accept', authenticateToken, invitationController.acceptInvitation);
router.post('/invitations/:id/decline', authenticateToken, invitationController.declineInvitation);

// Join request actions
router.post('/join-requests/:id/approve', authenticateToken, invitationController.approveJoinRequest);
router.post('/join-requests/:id/reject', authenticateToken, invitationController.rejectJoinRequest);

// ============================================================
// TASK ROUTES
// ============================================================

// Create and list tasks
router.post('/teams/:teamId/tasks', authenticateToken, taskController.createTask);
router.get('/teams/:teamId/tasks', authenticateToken, taskController.getTeamTasks);

// Task operations
router.get('/tasks/:id', authenticateToken, taskController.getTaskById);
router.put('/tasks/:id', authenticateToken, taskController.updateTask);
router.delete('/tasks/:id', authenticateToken, taskController.deleteTask);

// Task actions
router.post('/tasks/:id/claim', authenticateToken, taskController.claimTask);
router.post('/tasks/:id/unclaim', authenticateToken, taskController.unclaimTask);
router.post('/tasks/:id/complete', authenticateToken, taskController.completeTask);
router.post('/tasks/:id/collaborate', authenticateToken, taskController.requestCollaboration);

// ============================================================
// MESSAGE ROUTES (Task Chat)
// ============================================================

router.get('/tasks/:taskId/messages', authenticateToken, messageController.getMessages);
router.post('/tasks/:taskId/messages', authenticateToken, messageController.sendMessage);

// ============================================================
// COLUMN ROUTES
// ============================================================

router.get('/teams/:teamId/columns', authenticateToken, columnController.getColumns);
router.post('/teams/:teamId/columns', authenticateToken, columnController.createColumn);
router.put('/columns/:id', authenticateToken, columnController.updateColumn);
router.delete('/columns/:id', authenticateToken, columnController.deleteColumn);
router.post('/teams/:teamId/columns/reorder', authenticateToken, columnController.reorderColumns);
router.post('/columns/:columnId/tasks/reorder', authenticateToken, taskController.reorderTasks);

export default router;
