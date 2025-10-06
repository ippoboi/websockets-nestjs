import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateMessageDto, UpdateMessageDto, MessageResponseDto } from './dto';
import { EventsGateway } from 'src/events/events.gateway';
import { ConversationsService } from '../conversations/conversations.service';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => EventsGateway))
    private readonly eventsGateway: EventsGateway,
    private readonly conversationsService: ConversationsService,
  ) {}

  async create(
    createMessageDto: CreateMessageDto,
    authorId: string,
  ): Promise<MessageResponseDto> {
    let conversationId: string;

    // Determine conversation ID
    if (createMessageDto.conversationId) {
      // Use provided conversation ID
      conversationId = createMessageDto.conversationId;

      // Verify conversation exists and user is participant
      await this.conversationsService.findOne(conversationId, authorId);
    } else if (createMessageDto.recipientId) {
      // Find or create conversation between sender and recipient
      conversationId =
        await this.conversationsService.findOrCreateConversationBetweenUsers(
          authorId,
          createMessageDto.recipientId,
        );
    } else {
      throw new BadRequestException(
        'Either conversationId or recipientId must be provided',
      );
    }

    const createdMessage = await this.prisma.client.message.create({
      data: {
        content: createMessageDto.content,
        authorId,
        conversationId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        readReceipts: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    });

    // Update conversation's last message
    await this.prisma.client.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageId: createdMessage.id,
        lastMessageAt: createdMessage.createdAt,
      },
    });

    return createdMessage;
  }

  async findAll(conversationId?: string): Promise<MessageResponseDto[]> {
    const where = conversationId ? { conversationId } : {};
    const messages = await this.prisma.client.message.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        readReceipts: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return messages;
  }

  async findOne(id: string): Promise<MessageResponseDto> {
    const message = await this.prisma.client.message.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        readReceipts: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException(`Message with ID ${id} not found`);
    }

    return message;
  }

  async update(
    id: string,
    updateMessageDto: UpdateMessageDto,
    userId: string,
  ): Promise<MessageResponseDto> {
    // First check if message exists and user owns it
    const existingMessage = await this.prisma.client.message.findUnique({
      where: { id },
    });

    if (!existingMessage) {
      throw new NotFoundException(`Message with ID ${id} not found`);
    }

    if (existingMessage.authorId !== userId) {
      throw new ForbiddenException('You can only update your own messages');
    }

    const updatedMessage = await this.prisma.client.message.update({
      where: { id },
      data: updateMessageDto,
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        readReceipts: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    });

    return updatedMessage;
  }

  async remove(id: string, userId: string): Promise<{ message: string }> {
    // First check if message exists and user owns it
    const existingMessage = await this.prisma.client.message.findUnique({
      where: { id },
    });

    if (!existingMessage) {
      throw new NotFoundException(`Message with ID ${id} not found`);
    }

    if (existingMessage.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    await this.prisma.client.message.delete({
      where: { id },
    });

    return { message: 'Message deleted successfully' };
  }

  async findByConversation(
    conversationId: string,
  ): Promise<MessageResponseDto[]> {
    const messages = await this.prisma.client.message.findMany({
      where: { conversationId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        readReceipts: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return messages;
  }

  async markAsRead(
    conversationId: string,
    userId: string,
  ): Promise<{ message: string; messageIds: string[] }> {
    // Get all unread messages in the conversation
    const unreadMessages = await this.prisma.client.message.findMany({
      where: {
        conversationId,
        authorId: { not: userId }, // Don't mark own messages as read
        readReceipts: {
          none: {
            userId,
          },
        },
      },
      select: { id: true },
    });

    const messageIds = unreadMessages.map((msg) => msg.id);

    if (unreadMessages.length > 0) {
      // Create read receipts for all unread messages
      await this.prisma.client.messageReadReceipt.createMany({
        data: unreadMessages.map((message) => ({
          messageId: message.id,
          userId,
        })),
        skipDuplicates: true,
      });
    }

    return { message: 'Messages marked as read', messageIds };
  }

  async getUnreadCount(
    conversationId: string,
    userId: string,
  ): Promise<number> {
    const count = await this.prisma.client.message.count({
      where: {
        conversationId,
        authorId: { not: userId }, // Don't count own messages
        readReceipts: {
          none: {
            userId,
          },
        },
      },
    });

    return count;
  }
}
