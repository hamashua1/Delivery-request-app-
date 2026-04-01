import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { UserModel } from '../models/user.model';
import { AuthRequest } from '../types/index';

const SALT_ROUNDS = 10;

const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const ACCESS_TOKEN_MAX_AGE = 60 * 60 * 1000;       // 1h in ms
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7d in ms

const setTokenCookies = (res: Response, accessToken: string, refreshToken: string): void => {
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: REFRESH_TOKEN_MAX_AGE,
    path: '/api/auth/refresh',
  });
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ message: 'Name is required' });
      return;
    }
    if (!email || typeof email !== 'string' || !isValidEmail(email)) {
      res.status(400).json({ message: 'Valid email is required' });
      return;
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ message: 'Password must be at least 8 characters' });
      return;
    }
    if (!role || !['customer', 'rider'].includes(role)) {
      res.status(400).json({ message: 'Role must be customer or rider' });
      return;
    }

    const existing = await UserModel.findOne({ email });
    if (existing) {
      res.status(409).json({ message: 'Email already in use' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await UserModel.create({ name: name.trim(), email, passwordHash, role });

    res.status(201).json({ message: 'Account created successfully', userId: user._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Registration failed' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || typeof email !== 'string' || !isValidEmail(email)) {
      res.status(400).json({ message: 'Valid email is required' });
      return;
    }
    if (!password || typeof password !== 'string') {
      res.status(400).json({ message: 'Password is required' });
      return;
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    const accessToken = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: (process.env.JWT_EXPIRES_IN ?? '1h') as StringValue }
    );

    const refreshToken = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: (process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d') as StringValue }
    );

    user.refreshToken = await bcrypt.hash(refreshToken, SALT_ROUNDS);
    await user.save();

    setTokenCookies(res, accessToken, refreshToken);

    res.status(200).json({ message: 'Login successful', role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Login failed' });
  }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies['refreshToken'] as string | undefined;

    if (!refreshToken || typeof refreshToken !== 'string') {
      res.status(400).json({ message: 'Refresh token is required' });
      return;
    }

    let decoded: { userId: string; role: 'customer' | 'rider' };
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET as string) as unknown as {
        userId: string;
        role: 'customer' | 'rider';
      };
    } catch {
      res.status(401).json({ message: 'Invalid or expired refresh token' });
      return;
    }

    const user = await UserModel.findById(decoded.userId);
    if (!user || !user.refreshToken) {
      res.status(401).json({ message: 'Invalid or expired refresh token' });
      return;
    }

    const isMatch = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid or expired refresh token' });
      return;
    }

    const newAccessToken = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: (process.env.JWT_EXPIRES_IN ?? '1h') as StringValue }
    );

    const newRefreshToken = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: (process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d') as StringValue }
    );

    user.refreshToken = await bcrypt.hash(newRefreshToken, SALT_ROUNDS);
    await user.save();

    setTokenCookies(res, newAccessToken, newRefreshToken);

    res.status(200).json({ message: 'Token refreshed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Token refresh failed' });
  }
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await UserModel.findByIdAndUpdate(req.userId, { refreshToken: null });

    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('accessToken', { httpOnly: true, secure: isProduction, sameSite: 'strict' });
    res.clearCookie('refreshToken', { httpOnly: true, secure: isProduction, sameSite: 'strict', path: '/api/auth/refresh' });

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Logout failed' });
  }
};
