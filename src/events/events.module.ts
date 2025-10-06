import { Module, forwardRef } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { MessagesModule } from '../messages/messages.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [forwardRef(() => MessagesModule), ConversationsModule],
  providers: [EventsGateway, PrismaService],
  exports: [EventsGateway],
})
export class EventsModule {}
