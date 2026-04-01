import { WebSocket } from 'ws';
import { WsClient } from '../types/index';

const clients: Map<string, WsClient> = new Map();

export const registerClient = (userId: string, ws: WebSocket): void => {
  clients.set(userId, { ws, userId });
};

export const unregisterClient = (userId: string): void => {
  clients.delete(userId);
};

export const subscribeToDelivery = (userId: string, deliveryId: string): void => {
  const client = clients.get(userId);
  if (client) client.deliveryId = deliveryId;
};

export const notifyDeliveryUpdate = (
  customerId: string,
  payload: Record<string, unknown>
): void => {
  const client = clients.get(customerId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(payload), (err) => {
      if (err) console.error(`WS send error for ${customerId}:`, err);
    });
  }
};

export const broadcastLocationUpdate = (
  customerId: string,
  coordinates: [number, number]
): void => {
  notifyDeliveryUpdate(customerId, { type: 'RIDER_LOCATION', coordinates });
};
