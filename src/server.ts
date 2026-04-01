import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import app from './app';
import connectDB from './db/connect';
import { registerClient, unregisterClient } from './services/ws.service';
import jwt from 'jsonwebtoken';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket, req) => {
  let token: string | null = null;
  try {
    const url = new URL(req.url ?? '', `http://localhost`);
    token = url.searchParams.get('token');
  } catch {
    ws.close(1008, 'Invalid request URL');
    return;
  }

  if (!token) {
    ws.close(1008, 'Token required');
    return;
  }

  let userId: string;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string };
    userId = decoded.userId;
  } catch {
    ws.close(1008, 'Invalid token');
    return;
  }

  registerClient(userId, ws);

  ws.on('close', () => {
    unregisterClient(userId);
  });
});

const start = async (): Promise<void> => {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
