import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { getUserById, type User } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'my-super-secret-key-change-me-in-production';

export type SessionPayload = {
  userId: string;
  email: string;
};

export function createSessionToken(user: User): string {
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SessionPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

export async function getServerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  
  if (!token) return null;
  
  const payload = verifySessionToken(token);
  if (!payload) return null;
  
  const user = getUserById(payload.userId);
  if (!user) return null;
  
  return { user, payload };
}