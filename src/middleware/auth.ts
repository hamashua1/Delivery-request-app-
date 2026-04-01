import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../types/index';

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const token = req.cookies['accessToken'] as string | undefined;

  if (!token) {
    res.status(401).json({ message: 'No token provided' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as unknown as {
      userId: string;
      role: 'customer' | 'rider';
    };
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const requireRole = (role: 'customer' | 'rider') =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (req.userRole !== role) {
      res.status(403).json({ message: `Access restricted to ${role}s` });
      return;
    }
    next();
  };
