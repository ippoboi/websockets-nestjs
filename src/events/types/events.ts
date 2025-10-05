import { Message } from 'src/messages/dto/message-res.dto';

export interface ServerToClientEvents {
  newMessage: (payload: Message) => void;
}
