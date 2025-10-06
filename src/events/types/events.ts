import { MessageResponseDto } from 'src/messages/dto/message-res.dto';

export interface ServerToClientEvents {
  newMessage: (payload: MessageResponseDto) => void;
  userJoined: (payload: { message: string }) => void;
  userLeft: (payload: { message: string }) => void;
  messagesRead: (payload: {
    conversationId: string;
    userId: string;
    messageIds: string[];
    readAt: Date;
  }) => void;
  userOnlineStatusChanged: (payload: {
    userId: string;
    isOnline: boolean;
    lastSeen?: Date;
  }) => void;
  userTyping: (payload: { userId: string; conversationId: string }) => void;
  userStoppedTyping: (payload: {
    userId: string;
    conversationId: string;
  }) => void;
  connected: (payload: {
    message: string;
    userId: string;
    socketId: string;
  }) => void;
  conversationJoined: (payload: {
    conversationId: string;
    message: string;
  }) => void;
  conversationLeft: (payload: {
    conversationId: string;
    message: string;
  }) => void;
  conversationStarted: (payload: {
    conversationId: string;
    recipientId: string;
    message: string;
  }) => void;
  messageSent: (payload: { message: string; messageId: string }) => void;
  error: (payload: {
    type: string;
    message: string;
    conversationId?: string;
  }) => void;
}
