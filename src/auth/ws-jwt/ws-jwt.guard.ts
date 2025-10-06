import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { verify } from 'jsonwebtoken';
import { Observable } from 'rxjs';
import { AuthenticatedSocket } from 'src/events/events.gateway';

@Injectable()
export class WsJwtGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    if (context.getType() !== 'ws') {
      return true;
    }

    const client: AuthenticatedSocket = context.switchToWs().getClient();
    // If user is already authenticated (from connection), allow access
    if (client.user) {
      return true;
    }

    // Only validate token during initial connection
    try {
      const payload = WsJwtGuard.validateToken(client);
      // Attach user information to the socket for message handlers
      client.user = payload as { sub: string; username: string };
      return true;
    } catch (error) {
      Logger.error('WebSocket authentication failed:', error);
      return false;
    }
  }

  static validateToken(client: AuthenticatedSocket) {
    const token = client.handshake.auth?.token as string;

    if (!token) {
      throw new Error('Missing authentication token');
    }

    const payload = verify(token, process.env.JWT_SECRET || '7zUcwU4ZszLp5ytM');

    return payload;
  }
}
