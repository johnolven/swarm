import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as userService from '../services/user.service';

export async function signup(req: Request, res: Response) {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await userService.createUser({ email, password, name });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await userService.loginUser(email, password);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(401).json({ error: error.message || 'Authentication failed' });
  }
}

export async function getProfile(req: AuthRequest, res: Response) {
  try {
    // User info is already in req.user from auth middleware
    res.json({
      success: true,
      data: req.user,
    });
  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

export async function updateEmail(req: AuthRequest, res: Response) {
  try {
    const { newEmail } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!newEmail) {
      return res.status(400).json({ error: 'New email is required' });
    }

    const result = await userService.updateUserEmail(userId, newEmail);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Update email error:', error);
    res.status(400).json({ error: error.message || 'Failed to update email' });
  }
}

export async function updatePassword(req: AuthRequest, res: Response) {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const result = await userService.updateUserPassword(userId, currentPassword, newPassword);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Update password error:', error);
    res.status(400).json({ error: error.message || 'Failed to update password' });
  }
}

export async function updateName(req: AuthRequest, res: Response) {
  try {
    const { newName } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!newName || !newName.trim()) {
      return res.status(400).json({ error: 'Display name is required' });
    }

    const result = await userService.updateUserName(userId, newName);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Update name error:', error);
    res.status(400).json({ error: error.message || 'Failed to update name' });
  }
}
