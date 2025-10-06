import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';
import { ServerToClientEvents } from './types/events';
import { MessageResponseDto } from 'src/messages/dto/message-res.dto';
import { Logger, Inject, forwardRef, UseGuards } from '@nestjs/common';
import { SocketAuthMiddleware } from 'src/auth/ws.mw';
import { MessagesService } from 'src/messages/messages.service';
import { ConversationsService } from 'src/conversations/conversations.service';
import { PrismaService } from 'src/prisma.service';
import { WsJwtGuard } from 'src/auth/ws-jwt/ws-jwt.guard';

export interface AuthenticatedSocket extends Socket {
  user?: {
    sub: string;
    username: string;
  };
}

interface WebSocketError {
  type: string;
  message: string;
  conversationId?: string;
}

interface ExtendedError extends Error {
  type?: string;
}

@WebSocketGateway({
  namespace: 'events',
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
})
@UseGuards(WsJwtGuard)
export class EventsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server<any, ServerToClientEvents>;

  // Track user rooms and socket mappings
  private userRooms = new Map<string, Set<string>>(); // userId -> Set of conversationIds
  private socketToUser = new Map<string, string>(); // socketId -> userId

  // Track typing indicators (in-memory only)
  private typingUsers = new Map<string, Set<string>>(); // conversationId -> Set of userIds

  constructor(
    @Inject(forwardRef(() => MessagesService))
    private readonly messagesService: MessagesService,
    private readonly conversationsService: ConversationsService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(client: Server) {
    // setup authentication logic here
    client.use(SocketAuthMiddleware());

    // Add error handling middleware
    client.use((socket, next) => {
      try {
        next();
      } catch (error: unknown) {
        const err = error as ExtendedError;
        Logger.error(
          `WebSocket middleware error: ${err?.message || 'Unknown error'}`,
          err?.stack,
        );
        next(err);
      }
    });

    Logger.log('WebSocket server initialized with error handling');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      Logger.log('Client connected:', client.id);

      // Extract user ID from the authenticated socket
      const userId = client.user?.sub;

      if (!userId) {
        Logger.warn(
          `Unauthenticated connection attempt from socket ${client.id}`,
        );
        client.emit('error', {
          type: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
        });
        client.disconnect();
        return;
      }

      this.socketToUser.set(client.id, userId);
      Logger.log(`User ${userId} connected with socket ${client.id}`);

      // Get all conversations this user participates in and join their rooms
      const userConversations = await this.prisma.client.conversation.findMany({
        where: {
          participants: {
            some: {
              userId,
            },
          },
        },
        select: {
          id: true,
        },
      });

      // Join all conversation rooms
      const conversationIds = new Set<string>();
      for (const conversation of userConversations) {
        await client.join(conversation.id);
        conversationIds.add(conversation.id);
      }

      // Track user's rooms
      this.userRooms.set(userId, conversationIds);

      // Update user online status (this will broadcast to all conversations)
      await this.updateUserOnlineStatus(userId, true);

      // Send connection success message
      client.emit('connected', {
        message: 'Successfully connected',
        userId,
        socketId: client.id,
      });
    } catch (error: unknown) {
      const err = error as ExtendedError;
      Logger.error(
        `Connection error for socket ${client.id}: ${err?.message || 'Unknown error'}`,
        err?.stack,
      );
      client.emit('error', {
        type: 'CONNECTION_ERROR',
        message: 'Failed to establish connection',
      });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      Logger.log('Client disconnected:', client.id);

      // Clean up user tracking
      const userId = this.socketToUser.get(client.id);
      if (userId) {
        this.socketToUser.delete(client.id);
        this.userRooms.delete(userId);

        // Update user online status
        await this.updateUserOnlineStatus(userId, false);

        Logger.log(`User ${userId} disconnected from socket ${client.id}`);
      }

      client.removeAllListeners();
      client.disconnect(true);
    } catch (error: unknown) {
      const err = error as ExtendedError;
      Logger.error(
        `Disconnect error for socket ${client.id}: ${err?.message || 'Unknown error'}`,
        err?.stack,
      );
    }
  }

  // Room management functions
  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { conversationId: string },
  ) {
    try {
      // Validate payload
      if (!payload || !payload.conversationId) {
        throw new WsException({
          type: 'VALIDATION_ERROR',
          message: 'conversationId is required',
        });
      }

      const userId = this.socketToUser.get(client.id);
      if (!userId) {
        throw new WsException({
          type: 'AUTHENTICATION_ERROR',
          message: 'User not authenticated',
        });
      }

      // Verify user has access to this conversation
      await this.conversationsService.findOne(payload.conversationId, userId);

      // Join the room
      await client.join(payload.conversationId);

      // Track user's rooms
      if (!this.userRooms.has(userId)) {
        this.userRooms.set(userId, new Set());
      }
      this.userRooms.get(userId)!.add(payload.conversationId);

      Logger.log(
        `User ${userId} joined conversation ${payload.conversationId}`,
      );

      // Emit success event to client
      client.emit('conversationJoined', {
        conversationId: payload.conversationId,
        message: 'Successfully joined conversation',
      });

      return { success: true, conversationId: payload.conversationId };
    } catch (error: unknown) {
      const err = error as ExtendedError;
      Logger.error(
        `Failed to join conversation: ${err?.message || 'Unknown error'}`,
        err?.stack,
      );

      // Emit error to client
      const errorResponse: WebSocketError = {
        type: err?.type || 'JOIN_CONVERSATION_ERROR',
        message: err?.message || 'Failed to join conversation',
        conversationId: payload?.conversationId,
      };
      client.emit('error', errorResponse);

      throw error;
    }
  }

  @SubscribeMessage('leaveConversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { conversationId: string },
  ) {
    try {
      // Validate payload
      if (!payload || !payload.conversationId) {
        throw new WsException({
          type: 'VALIDATION_ERROR',
          message: 'conversationId is required',
        });
      }

      const userId = this.socketToUser.get(client.id);
      if (!userId) {
        throw new WsException({
          type: 'AUTHENTICATION_ERROR',
          message: 'User not authenticated',
        });
      }

      // Leave the room
      await client.leave(payload.conversationId);

      // Update user's rooms tracking
      const userRooms = this.userRooms.get(userId);
      if (userRooms) {
        userRooms.delete(payload.conversationId);
      }

      Logger.log(`User ${userId} left conversation ${payload.conversationId}`);

      // Emit success event to client
      client.emit('conversationLeft', {
        conversationId: payload.conversationId,
        message: 'Successfully left conversation',
      });

      return { success: true, conversationId: payload.conversationId };
    } catch (error: unknown) {
      const err = error as ExtendedError;
      Logger.error(
        `Failed to leave conversation: ${err?.message || 'Unknown error'}`,
        err?.stack,
      );

      // Emit error to client
      const errorResponse: WebSocketError = {
        type: err?.type || 'LEAVE_CONVERSATION_ERROR',
        message: err?.message || 'Failed to leave conversation',
        conversationId: payload?.conversationId,
      };
      client.emit('error', errorResponse);

      throw error;
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    payload: {
      content: string;
      conversationId?: string;
      recipientId?: string;
    },
  ) {
    try {
      // Validate payload
      if (!payload || !payload.content) {
        throw new WsException({
          type: 'VALIDATION_ERROR',
          message: 'content is required',
        });
      }

      if (!payload.conversationId && !payload.recipientId) {
        throw new WsException({
          type: 'VALIDATION_ERROR',
          message: 'Either conversationId or recipientId is required',
        });
      }

      if (payload.content.trim().length === 0) {
        throw new WsException({
          type: 'VALIDATION_ERROR',
          message: 'Message content cannot be empty',
        });
      }

      const userId = this.socketToUser.get(client.id);

      if (!userId) {
        throw new WsException({
          type: 'AUTHENTICATION_ERROR',
          message: 'User not authenticated',
        });
      }

      // Create message using MessagesService
      const message = await this.messagesService.create(
        {
          content: payload.content.trim(),
          conversationId: payload.conversationId,
          recipientId: payload.recipientId,
        },
        userId,
      );

      // Broadcast to all users in conversation room (including sender)
      this.server.to(message.conversationId).emit('newMessage', message);

      Logger.log(
        `Message sent to conversation ${message.conversationId} by user ${userId}`,
      );

      // Emit success event to sender
      client.emit('messageSent', {
        message: 'Message sent successfully',
        messageId: message.id,
      });

      return { success: true, message };
    } catch (error: unknown) {
      const err = error as ExtendedError;
      Logger.error(
        `Failed to send message: ${err?.message || 'Unknown error'}`,
        err?.stack,
      );

      // Emit error to client
      const errorResponse: WebSocketError = {
        type: err?.type || 'SEND_MESSAGE_ERROR',
        message: err?.message || 'Failed to send message',
        conversationId: payload?.conversationId || payload?.recipientId,
      };
      client.emit('error', errorResponse);

      throw error;
    }
  }

  @SubscribeMessage('startConversation')
  async handleStartConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { recipientId: string },
  ) {
    try {
      // Validate payload
      if (!payload || !payload.recipientId) {
        throw new WsException({
          type: 'VALIDATION_ERROR',
          message: 'recipientId is required',
        });
      }

      const userId = this.socketToUser.get(client.id);
      if (!userId) {
        throw new WsException({
          type: 'AUTHENTICATION_ERROR',
          message: 'User not authenticated',
        });
      }

      // Find or create conversation between users
      const conversationId =
        await this.conversationsService.findOrCreateConversationBetweenUsers(
          userId,
          payload.recipientId,
        );

      // Join the conversation room
      await client.join(conversationId);

      // Track user's rooms
      if (!this.userRooms.has(userId)) {
        this.userRooms.set(userId, new Set());
      }
      this.userRooms.get(userId)!.add(conversationId);

      Logger.log(
        `User ${userId} started conversation ${conversationId} with ${payload.recipientId}`,
      );

      // Emit success event to client
      client.emit('conversationStarted', {
        conversationId,
        recipientId: payload.recipientId,
        message: 'Conversation started successfully',
      });

      return { success: true, conversationId };
    } catch (error: unknown) {
      const err = error as ExtendedError;
      Logger.error(
        `Failed to start conversation: ${err?.message || 'Unknown error'}`,
        err?.stack,
      );

      // Emit error to client
      const errorResponse: WebSocketError = {
        type: err?.type || 'START_CONVERSATION_ERROR',
        message: err?.message || 'Failed to start conversation',
        conversationId: payload?.recipientId,
      };
      client.emit('error', errorResponse);

      throw error;
    }
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { conversationId: string },
  ) {
    try {
      // Validate payload
      if (!payload || !payload.conversationId) {
        throw new WsException({
          type: 'VALIDATION_ERROR',
          message: 'conversationId is required',
        });
      }

      const userId = this.socketToUser.get(client.id);
      if (!userId) {
        throw new WsException({
          type: 'AUTHENTICATION_ERROR',
          message: 'User not authenticated',
        });
      }

      // Mark messages as read
      const result = await this.messagesService.markAsRead(
        payload.conversationId,
        userId,
      );

      Logger.log(
        `📧 User ${userId} marked ${result.messageIds.length} messages as read in conversation ${payload.conversationId}`,
      );
      Logger.log(`📧 Message IDs: ${result.messageIds.join(', ')}`);

      // Broadcast read receipt to other users in conversation (exclude the user who marked as read)
      client.to(payload.conversationId).emit('messagesRead', {
        conversationId: payload.conversationId,
        userId,
        messageIds: result.messageIds,
        readAt: new Date(),
      });

      Logger.log(
        `📧 Broadcasted messagesRead event to other users in conversation ${payload.conversationId}`,
      );

      Logger.log(
        `User ${userId} marked messages as read in conversation ${payload.conversationId}`,
      );

      return { success: true, conversationId: payload.conversationId };
    } catch (error: unknown) {
      const err = error as ExtendedError;
      Logger.error(
        `Failed to mark messages as read: ${err?.message || 'Unknown error'}`,
        err?.stack,
      );

      // Emit error to client
      const errorResponse: WebSocketError = {
        type: err?.type || 'MARK_AS_READ_ERROR',
        message: err?.message || 'Failed to mark messages as read',
        conversationId: payload?.conversationId,
      };
      client.emit('error', errorResponse);

      throw error;
    }
  }

  @SubscribeMessage('startTyping')
  handleStartTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { conversationId: string },
  ) {
    try {
      if (!payload || !payload.conversationId) {
        return;
      }

      const userId = this.socketToUser.get(client.id);
      if (!userId) {
        return;
      }

      // Add user to typing set
      if (!this.typingUsers.has(payload.conversationId)) {
        this.typingUsers.set(payload.conversationId, new Set());
      }
      this.typingUsers.get(payload.conversationId)!.add(userId);

      // Broadcast to other users in conversation
      client.to(payload.conversationId).emit('userTyping', {
        userId,
        conversationId: payload.conversationId,
      });
    } catch (error: unknown) {
      const err = error as ExtendedError;
      Logger.error(
        `Failed to handle typing: ${err?.message || 'Unknown error'}`,
        err?.stack,
      );
    }
  }

  @SubscribeMessage('stopTyping')
  handleStopTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { conversationId: string },
  ) {
    try {
      if (!payload || !payload.conversationId) {
        return;
      }

      const userId = this.socketToUser.get(client.id);
      if (!userId) {
        return;
      }

      this.typingUsers.get(payload.conversationId)?.delete(userId);

      client.to(payload.conversationId).emit('userStoppedTyping', {
        userId,
        conversationId: payload.conversationId,
      });
    } catch (error: unknown) {
      const err = error as ExtendedError;
      Logger.error(
        `Failed to handle stop typing: ${err?.message || 'Unknown error'}`,
        err?.stack,
      );
    }
  }

  // Helper method to update user online status
  private async updateUserOnlineStatus(userId: string, isOnline: boolean) {
    try {
      await this.prisma.client.user.update({
        where: { id: userId },
        data: {
          isOnline,
          lastSeen: isOnline ? undefined : new Date(),
        },
      });

      // Get all conversations this user participates in
      const userConversations = await this.prisma.client.conversation.findMany({
        where: {
          participants: {
            some: {
              userId,
            },
          },
        },
        select: {
          id: true,
        },
      });

      // Broadcast online status change to all conversations this user is part of
      userConversations.forEach((conversation) => {
        this.server.to(conversation.id).emit('userOnlineStatusChanged', {
          userId,
          isOnline,
          lastSeen: isOnline ? undefined : new Date(),
        });
      });

      Logger.log(
        `Updated online status for user ${userId}: ${isOnline ? 'online' : 'offline'}`,
      );
    } catch (error: unknown) {
      const err = error as ExtendedError;
      Logger.error(
        `Failed to update user online status: ${err?.message || 'Unknown error'}`,
        err?.stack,
      );
    }
  }

  // Keep the original sendMessage method for HTTP API integration
  sendMessage(message: MessageResponseDto) {
    try {
      this.server.to(message.conversationId).emit('newMessage', message);
    } catch (error: unknown) {
      const err = error as ExtendedError;
      Logger.error(
        `Failed to broadcast message: ${err?.message || 'Unknown error'}`,
        err?.stack,
      );
    }
  }

  // Global error handler for unhandled WebSocket errors
  @SubscribeMessage('error')
  handleError(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: any,
  ) {
    Logger.error(`Client error from ${client.id}:`, payload);
    // Don't emit back to prevent error loops
  }

  // Handle any unhandled exceptions
  handleException(exception: any, client: AuthenticatedSocket) {
    Logger.error(
      `Unhandled WebSocket exception for client ${client.id}:`,
      exception,
    );

    try {
      client.emit('error', {
        type: 'INTERNAL_ERROR',
        message: 'An internal error occurred',
      });
    } catch (emitError) {
      Logger.error('Failed to emit error to client:', emitError);
    }
  }
}
