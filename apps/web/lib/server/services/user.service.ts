import { prisma } from '../prisma';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { sendVerificationEmail, sendPasswordResetEmail } from '../email';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const BCRYPT_ROUNDS = 12;
const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
  nickname?: string;
  avatar_id?: number;
}

function userPayload(user: any) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    nickname: user.nickname,
    avatar_id: user.avatar_id,
    type: 'human',
  };
}

function signToken(user: any) {
  return jwt.sign(
    { user_id: user.id, email: user.email, type: 'human', name: user.name },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

async function ensureNicknameUnique(nickname: string, excludeUserId?: string) {
  const existingUser = await prisma.user.findFirst({ where: { nickname } });
  if (existingUser && existingUser.id !== excludeUserId) {
    throw new Error('Nickname already taken');
  }
  const existingAgent = await prisma.agent.findUnique({ where: { name: nickname } });
  if (existingAgent) {
    throw new Error('Nickname already taken');
  }
}

export async function createUser(input: CreateUserInput) {
  const { email, password, name, nickname, avatar_id } = input;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new Error('User with this email already exists');

  if (nickname) await ensureNicknameUnique(nickname);

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: name || email.split('@')[0],
      nickname: nickname || null,
      avatar_id: avatar_id || 1,
    },
  });

  return { token: signToken(user), user: userPayload(user) };
}

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export async function initiateSignup(input: CreateUserInput) {
  const { email, password, name, nickname, avatar_id } = input;

  // Check email not taken
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new Error('User with this email already exists');

  if (nickname) await ensureNicknameUnique(nickname);

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const otpCode = crypto.randomInt(100000, 999999).toString();
  const magicToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Delete any existing pending signup for this email
  await prisma.pendingSignup.deleteMany({ where: { email } });

  // Create pending signup
  await prisma.pendingSignup.create({
    data: {
      email,
      password_hash: hashedPassword,
      name: name || email.split('@')[0],
      nickname: nickname || null,
      avatar_id: avatar_id || 1,
      otp_hash: hashOtp(otpCode),
      magic_token: magicToken,
      expires_at: expiresAt,
    },
  });

  // Send verification email
  await sendVerificationEmail(email, otpCode, magicToken);

  return { message: 'Verification email sent', email };
}

export async function verifyOtp(email: string, otp: string) {
  const pending = await prisma.pendingSignup.findFirst({
    where: { email, expires_at: { gt: new Date() } },
    orderBy: { created_at: 'desc' },
  });

  if (!pending) throw new Error('No pending signup or code expired');

  if (pending.attempts >= MAX_OTP_ATTEMPTS) {
    await prisma.pendingSignup.delete({ where: { id: pending.id } });
    throw new Error('Too many attempts. Please sign up again.');
  }

  const otpMatch = hashOtp(otp) === pending.otp_hash;

  if (!otpMatch) {
    await prisma.pendingSignup.update({
      where: { id: pending.id },
      data: { attempts: { increment: 1 } },
    });
    throw new Error('Invalid verification code');
  }

  return completePendingSignup(pending);
}

export async function verifyMagicToken(token: string) {
  const pending = await prisma.pendingSignup.findFirst({
    where: { magic_token: token, expires_at: { gt: new Date() } },
  });

  if (!pending) throw new Error('Invalid or expired verification link');

  return completePendingSignup(pending);
}

async function completePendingSignup(pending: any) {
  // Re-check email uniqueness (race condition guard)
  const existingUser = await prisma.user.findUnique({ where: { email: pending.email } });
  if (existingUser) {
    await prisma.pendingSignup.delete({ where: { id: pending.id } });
    throw new Error('User with this email already exists');
  }

  if (pending.nickname) {
    await ensureNicknameUnique(pending.nickname);
  }

  // Create the user (password is already hashed)
  const user = await prisma.user.create({
    data: {
      email: pending.email,
      password: pending.password_hash,
      name: pending.name || pending.email.split('@')[0],
      nickname: pending.nickname || null,
      avatar_id: pending.avatar_id || 1,
    },
  });

  // Clean up
  await prisma.pendingSignup.delete({ where: { id: pending.id } });

  return { token: signToken(user), user: userPayload(user) };
}

export async function resendOtp(email: string) {
  const pending = await prisma.pendingSignup.findFirst({
    where: { email },
    orderBy: { created_at: 'desc' },
  });

  if (!pending) throw new Error('No pending signup found. Please sign up again.');

  const otpCode = crypto.randomInt(100000, 999999).toString();
  const magicToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.pendingSignup.update({
    where: { id: pending.id },
    data: {
      otp_hash: hashOtp(otpCode),
      magic_token: magicToken,
      attempts: 0,
      expires_at: expiresAt,
    },
  });

  await sendVerificationEmail(email, otpCode, magicToken);

  return { message: 'New verification code sent', email };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('Invalid email or password');

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error('Invalid email or password');

  return { token: signToken(user), user: userPayload(user) };
}

export async function verifyUserToken(token: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.type !== 'human') throw new Error('Invalid user token');
    return { id: decoded.user_id, email: decoded.email, name: decoded.name, type: decoded.type };
  } catch {
    throw new Error('Invalid or expired token');
  }
}

export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  return userPayload(user);
}

export async function updateUserEmail(userId: string, newEmail: string) {
  const existingUser = await prisma.user.findUnique({ where: { email: newEmail } });
  if (existingUser && existingUser.id !== userId) throw new Error('Email already in use');

  const user = await prisma.user.update({ where: { id: userId }, data: { email: newEmail } });
  return { token: signToken(user), user: userPayload(user) };
}

export async function updateUserPassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) throw new Error('Current password is incorrect');

  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } });

  return { success: true, message: 'Password updated successfully' };
}

export async function updateUserName(userId: string, newName: string) {
  const user = await prisma.user.update({ where: { id: userId }, data: { name: newName } });
  return { token: signToken(user), user: userPayload(user) };
}

export async function updateUserNickname(userId: string, nickname: string) {
  await ensureNicknameUnique(nickname, userId);
  const user = await prisma.user.update({ where: { id: userId }, data: { nickname } });
  return { token: signToken(user), user: userPayload(user) };
}

export async function updateUserAvatar(userId: string, avatar_id: number) {
  const user = await prisma.user.update({ where: { id: userId }, data: { avatar_id } });
  return { user: userPayload(user) };
}

export async function forgotPassword(email: string) {
  // Always return success to not leak whether email exists
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { message: 'If an account with that email exists, a reset code has been sent.' };

  const otpCode = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Delete any existing reset for this email
  await prisma.passwordReset.deleteMany({ where: { email } });

  await prisma.passwordReset.create({
    data: {
      email,
      otp_hash: hashOtp(otpCode),
      expires_at: expiresAt,
    },
  });

  await sendPasswordResetEmail(email, otpCode);

  return { message: 'If an account with that email exists, a reset code has been sent.' };
}

export async function verifyResetOtp(email: string, otp: string) {
  const reset = await prisma.passwordReset.findFirst({
    where: { email, expires_at: { gt: new Date() } },
    orderBy: { created_at: 'desc' },
  });

  if (!reset) throw new Error('No reset request found or code expired');

  if (reset.attempts >= MAX_OTP_ATTEMPTS) {
    await prisma.passwordReset.delete({ where: { id: reset.id } });
    throw new Error('Too many attempts. Please request a new reset code.');
  }

  if (hashOtp(otp) !== reset.otp_hash) {
    await prisma.passwordReset.update({
      where: { id: reset.id },
      data: { attempts: { increment: 1 } },
    });
    throw new Error('Invalid reset code');
  }

  return { valid: true };
}

export async function resetPassword(email: string, otp: string, newPassword: string) {
  const reset = await prisma.passwordReset.findFirst({
    where: { email, expires_at: { gt: new Date() } },
    orderBy: { created_at: 'desc' },
  });

  if (!reset) throw new Error('No reset request found or code expired');

  if (reset.attempts >= MAX_OTP_ATTEMPTS) {
    await prisma.passwordReset.delete({ where: { id: reset.id } });
    throw new Error('Too many attempts. Please request a new reset code.');
  }

  if (hashOtp(otp) !== reset.otp_hash) {
    await prisma.passwordReset.update({
      where: { id: reset.id },
      data: { attempts: { increment: 1 } },
    });
    throw new Error('Invalid reset code');
  }

  // Update password
  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const user = await prisma.user.update({
    where: { email },
    data: { password: hashedPassword },
  });

  // Clean up
  await prisma.passwordReset.delete({ where: { id: reset.id } });

  return { token: signToken(user), user: userPayload(user) };
}
