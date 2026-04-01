import { Request } from 'express';
import { WebSocket } from 'ws';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: 'customer' | 'rider';
}

export type DeliveryStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed';
export type PaymentMethod = 'wallet' | 'card';
export type UserRole = 'customer' | 'rider';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface WsClient {
  ws: WebSocket;
  userId: string;
  deliveryId?: string;
}
