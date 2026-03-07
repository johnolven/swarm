import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as userService from '../services/user.service';
import {
  signupSchema,
  loginSchema,
  updateEmailSchema,
  updatePasswordSchema,
  updateNameSchema,
  validate,
} from '../lib/validation';

export async function signup(req: Request, res: Response) {
  try {
    const data = validate(signupSchema, req.body);
    const result = await userService.createUser(data);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Failed to sign up' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const data = validate(loginSchema, req.body);
    const result = await userService.loginUser(data.email, data.password);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(401).json({ success: false, error: error.message || 'Authentication failed' });
  }
}

export async function getProfile(req: AuthRequest, res: Response) {
  try {
    res.json({
      success: true,
      data: req.user,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to get profile' });
  }
}

export async function updateEmail(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const data = validate(updateEmailSchema, req.body);
    const result = await userService.updateUserEmail(userId, data.newEmail);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Failed to update email' });
  }
}

export async function updatePassword(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const data = validate(updatePasswordSchema, req.body);
    const result = await userService.updateUserPassword(userId, data.currentPassword, data.newPassword);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Failed to update password' });
  }
}

export async function updateName(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const data = validate(updateNameSchema, req.body);
    const result = await userService.updateUserName(userId, data.newName);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Failed to update name' });
  }
}
