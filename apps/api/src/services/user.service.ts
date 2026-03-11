import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { generateUserToken, verifyToken } from '../lib/jwt';

const BCRYPT_ROUNDS = 12;

/**
 * Check that a nickname is not already used by any User or Agent.
 */
async function ensureNicknameUnique(nickname: string, excludeUserId?: string) {
  const existingUser = await prisma.user.findFirst({ where: { nickname } });
  if (existingUser && existingUser.id !== excludeUserId) {
    throw new Error('Nickname already taken');
  }
  // Agent.name acts as their nickname
  const existingAgent = await prisma.agent.findUnique({ where: { name: nickname } });
  if (existingAgent) {
    throw new Error('Nickname already taken');
  }
}

interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
  nickname?: string;
  avatar_id?: number;
}

export async function createUser(input: CreateUserInput) {
  const { email, password, name, nickname, avatar_id } = input;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  if (nickname) {
    await ensureNicknameUnique(nickname);
  }

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

  const token = generateUserToken({
    user_id: user.id,
    email: user.email,
    name: user.name || '',
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      nickname: user.nickname,
      avatar_id: user.avatar_id,
      type: 'human',
    },
  };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error('Invalid email or password');
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    throw new Error('Invalid email or password');
  }

  const token = generateUserToken({
    user_id: user.id,
    email: user.email,
    name: user.name || '',
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      nickname: user.nickname,
      avatar_id: user.avatar_id,
      type: 'human',
    },
  };
}

export async function verifyUserToken(token: string) {
  try {
    const decoded = verifyToken(token) as any;

    if (decoded.type !== 'human') {
      throw new Error('Invalid user token');
    }

    return {
      id: decoded.user_id,
      email: decoded.email,
      name: decoded.name,
      type: decoded.type,
    };
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

export async function updateUserEmail(userId: string, newEmail: string) {
  const existingUser = await prisma.user.findUnique({
    where: { email: newEmail },
  });

  if (existingUser && existingUser.id !== userId) {
    throw new Error('Email already in use');
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { email: newEmail },
  });

  const token = generateUserToken({
    user_id: user.id,
    email: user.email,
    name: user.name || '',
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      nickname: user.nickname,
      avatar_id: user.avatar_id,
      type: 'human',
    },
  };
}

export async function updateUserPassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const isValidPassword = await bcrypt.compare(currentPassword, user.password);
  if (!isValidPassword) {
    throw new Error('Current password is incorrect');
  }

  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return {
    success: true,
    message: 'Password updated successfully',
  };
}

export async function updateUserName(userId: string, newName: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { name: newName },
  });

  const token = generateUserToken({
    user_id: user.id,
    email: user.email,
    name: user.name || '',
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      nickname: user.nickname,
      avatar_id: user.avatar_id,
      type: 'human',
    },
  };
}

export async function updateUserNickname(userId: string, nickname: string) {
  await ensureNicknameUnique(nickname, userId);

  const user = await prisma.user.update({
    where: { id: userId },
    data: { nickname },
  });

  const token = generateUserToken({
    user_id: user.id,
    email: user.email,
    name: user.name || '',
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      nickname: user.nickname,
      avatar_id: user.avatar_id,
      type: 'human',
    },
  };
}

export async function updateUserAvatar(userId: string, avatar_id: number) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatar_id },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      nickname: user.nickname,
      avatar_id: user.avatar_id,
      type: 'human',
    },
  };
}

export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    nickname: user.nickname,
    avatar_id: user.avatar_id,
    type: 'human',
  };
}
