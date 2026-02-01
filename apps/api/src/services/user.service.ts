import { prisma } from '../lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
}

export async function createUser(input: CreateUserInput) {
  const { email, password, name } = input;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // For now, we're not hashing passwords (TODO: add bcrypt in production)
  // In a real production app, you would:
  // const hashedPassword = await bcrypt.hash(password, 10);

  // Create user in database
  const user = await prisma.user.create({
    data: {
      email,
      password, // Store plain password for development (NEVER do this in production!)
      name: name || email.split('@')[0],
    },
  });

  // Generate JWT token
  const token = jwt.sign(
    {
      user_id: user.id,
      email: user.email,
      type: 'human',
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      type: 'human',
    },
  };
}

export async function loginUser(email: string, password: string) {
  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error('Invalid email or password');
  }

  // Verify password
  // In production, you'd use bcrypt.compare(password, user.password)
  if (user.password !== password) {
    throw new Error('Invalid email or password');
  }

  // Generate JWT token
  const token = jwt.sign(
    {
      user_id: user.id,
      email: user.email,
      type: 'human',
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      type: 'human',
    },
  };
}

export async function verifyUserToken(token: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

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
  // Check if email is already taken
  const existingUser = await prisma.user.findUnique({
    where: { email: newEmail },
  });

  if (existingUser && existingUser.id !== userId) {
    throw new Error('Email already in use');
  }

  // Update email
  const user = await prisma.user.update({
    where: { id: userId },
    data: { email: newEmail },
  });

  // Generate new JWT token with updated email
  const token = jwt.sign(
    {
      user_id: user.id,
      email: user.email,
      type: 'human',
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      type: 'human',
    },
  };
}

export async function updateUserPassword(userId: string, currentPassword: string, newPassword: string) {
  // Get user
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Verify current password
  // In production, you'd use bcrypt.compare(currentPassword, user.password)
  if (user.password !== currentPassword) {
    throw new Error('Current password is incorrect');
  }

  // Update password
  // In production, you'd use: const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { password: newPassword },
  });

  return {
    success: true,
    message: 'Password updated successfully',
  };
}

export async function updateUserName(userId: string, newName: string) {
  // Update name
  const user = await prisma.user.update({
    where: { id: userId },
    data: { name: newName },
  });

  // Generate new JWT token with updated name
  const token = jwt.sign(
    {
      user_id: user.id,
      email: user.email,
      type: 'human',
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      type: 'human',
    },
  };
}
