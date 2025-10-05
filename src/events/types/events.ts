import { MessageResponseDto } from 'src/messages/dto/message-res.dto';

export interface ServerToClientEvents {
  newMessage: (payload: MessageResponseDto) => void;
}
