import { Logger } from '@nestjs/common';
import { AuthenticatedSocket } from 'src/events/events.gateway';
import { WsJwtGuard } from './ws-jwt/ws-jwt.guard';

type SocketIOMiddleware = {
  (client: AuthenticatedSocket, next: (err?: Error) => void);
};

export const SocketAuthMiddleware = (): SocketIOMiddleware => {
  return (client, next) => {
    try {
      const payload = WsJwtGuard.validateToken(client);
      // Attach user information to the socket
      client.user = payload as { sub: string; username: string };
      next();
    } catch (error) {
      Logger.error('Socket auth middleware failed:', error);
      next(error instanceof Error ? error : new Error('Authentication failed'));
    }
  };
};
