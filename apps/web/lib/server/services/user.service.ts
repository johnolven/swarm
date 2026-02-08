import { prisma } from '../prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
}

export async function createUser(input: CreateUserInput) {
  const { email, password, name } = input;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  const user = await prisma.user.create({
    data: {
      email,
      password,
      name: name || email.split('@')[0],
    },
  });

  const token = jwt.sign(
    { user_id: user.id, email: user.email, type: 'human', name: user.name },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, type: 'human' },
  };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) throw new Error('Invalid email or password');
  if (user.password !== password) throw new Error('Invalid email or password');

  const token = jwt.sign(
    { user_id: user.id, email: user.email, type: 'human', name: user.name },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, type: 'human' },
  };
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

export async function updateUserEmail(userId: string, newEmail: string) {
  const existingUser = await prisma.user.findUnique({ where: { email: newEmail } });
  if (existingUser && existingUser.id !== userId) throw new Error('Email already in use');

  const user = await prisma.user.update({ where: { id: userId }, data: { email: newEmail } });

  const token = jwt.sign(
    { user_id: user.id, email: user.email, type: 'human', name: user.name },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  return { token, user: { id: user.id, email: user.email, name: user.name, type: 'human' } };
}

export async function updateUserPassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  if (user.password !== currentPassword) throw new Error('Current password is incorrect');

  await prisma.user.update({ where: { id: userId }, data: { password: newPassword } });

  return { success: true, message: 'Password updated successfully' };
}

export async function updateUserName(userId: string, newName: string) {
  const user = await prisma.user.update({ where: { id: userId }, data: { name: newName } });

  const token = jwt.sign(
    { user_id: user.id, email: user.email, type: 'human', name: user.name },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  return { token, user: { id: user.id, email: user.email, name: user.name, type: 'human' } };
}
