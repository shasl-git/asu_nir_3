import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

// Создаём базу данных
const db = new Database('users.db');

// Создаём таблицу пользователей
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export type User = {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
};

// Функция регистрации
export async function createUser(email: string, password: string): Promise<User> {
  // Проверяем, существует ли пользователь
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (existing) {
    throw new Error('Пользователь с таким email уже существует');
  }

  // Хешируем пароль
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);
  
  // Создаём пользователя
  const id = crypto.randomUUID();
  const stmt = db.prepare(`
    INSERT INTO users (id, email, password_hash) 
    VALUES (?, ?, ?)
  `);
  stmt.run(id, email, passwordHash);
  
  // Возвращаем созданного пользователя
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User;
  return user;
}

// Функция проверки логина
export async function verifyCredentials(email: string, password: string): Promise<User | null> {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
  
  if (!user) {
    return null;
  }
  
  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return null;
  }
  
  return user;
}

// Получить пользователя по ID
export function getUserById(id: string): User | null {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  return user || null;
}