import bcrypt from 'bcryptjs';

export type User = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
};

const users = new Map<string, User>();

export async function createUser(email: string, password: string): Promise<User> {
  const existingUser = Array.from(users.values()).find(u => u.email === email);
  if (existingUser) {
    throw new Error('Пользователь с таким email уже существует');
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const user: User = {
    id: crypto.randomUUID(),
    email,
    passwordHash,
    createdAt: new Date(),
  };

  users.set(user.id, user);
  return user;
}

export async function verifyCredentials(email: string, password: string): Promise<User | null> {
  const user = Array.from(users.values()).find(u => u.email === email);
  if (!user) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return null;
  }

  return user;
}

export function getUserById(id: string): User | null {
  return users.get(id) || null;
}