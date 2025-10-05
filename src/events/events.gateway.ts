import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import { Server } from 'socket.io';
import { ServerToClientEvents } from './types/events';
import { MessageResponseDto } from 'src/messages/dto/message-res.dto';
import { Logger, UseGuards } from '@nestjs/common';
import { WsJwtGuard } from 'src/auth/ws-jwt/ws-jwt.guard';
import { SocketAuthMiddleware } from 'src/auth/ws.mw';

@WebSocketGateway({ namespace: 'events' })
@UseGuards(WsJwtGuard)
export class EventsGateway {
  @WebSocketServer()
  server: Server<any, ServerToClientEvents>;

  afterInit(client: Server) {
    // setup authentication logic here
    client.use(SocketAuthMiddleware());
    Logger.log('WebSocket server initialized');
  }

  @SubscribeMessage('message')
  handleMessage(client: any, payload: any): string {
    return 'Hello world!';
  }

  sendMessage(message: MessageResponseDto) {
    this.server.emit('newMessage', message);
  }
}
