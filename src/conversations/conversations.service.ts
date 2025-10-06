import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CreateConversationDto,
  UpdateConversationDto,
  ConversationResponseDto,
} from './dto';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createConversationDto: CreateConversationDto,
    creatorId: string,
  ): Promise<ConversationResponseDto> {
    // Check if all participants exist
    const participants = await this.prisma.client.user.findMany({
      where: {
        id: {
          in: createConversationDto.participantIds,
        },
      },
    });

    if (participants.length !== createConversationDto.participantIds.length) {
      throw new NotFoundException('One or more participants not found');
    }

    // Check if conversation already exists between these participants
    const existingConversation = await this.findConversationBetweenUsers([
      creatorId,
      ...createConversationDto.participantIds,
    ]);

    if (existingConversation) {
      throw new ConflictException(
        'Conversation already exists between these participants',
      );
    }

    // Create conversation with participants
    const conversation = await this.prisma.client.conversation.create({
      data: {
        participants: {
          create: [
            { userId: creatorId },
            ...createConversationDto.participantIds.map((id) => ({
              userId: id,
            })),
          ],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        lastMessage: {
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

    return {
      id: conversation.id,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      participants: conversation.participants.map((p) => ({
        id: p.id,
        user: p.user,
        createdAt: p.createdAt,
      })),
      lastMessage: conversation.lastMessage || undefined,
    };
  }

  async findAll(userId: string): Promise<ConversationResponseDto[]> {
    const conversations = await this.prisma.client.conversation.findMany({
      where: {
        participants: {
          some: {
            userId,
          },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                isOnline: true,
                lastSeen: true,
              },
            },
          },
        },
        lastMessage: {
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
        lastMessageAt: 'desc',
      },
    });

    return conversations.map((conversation) => ({
      id: conversation.id,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      participants: conversation.participants.map((p) => ({
        id: p.id,
        user: p.user,
        createdAt: p.createdAt,
      })),
      lastMessage: conversation.lastMessage || undefined,
    }));
  }

  async findOne(id: string, userId: string): Promise<ConversationResponseDto> {
    const conversation = await this.prisma.client.conversation.findFirst({
      where: {
        id,
        participants: {
          some: {
            userId,
          },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                isOnline: true,
                lastSeen: true,
              },
            },
          },
        },
        lastMessage: {
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

    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${id} not found`);
    }

    return {
      id: conversation.id,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      participants: conversation.participants.map((p) => ({
        id: p.id,
        user: p.user,
        createdAt: p.createdAt,
      })),
      lastMessage: conversation.lastMessage || undefined,
    };
  }

  async update(
    id: string,
    updateConversationDto: UpdateConversationDto,
    userId: string,
  ): Promise<ConversationResponseDto> {
    // Check if user is participant
    const conversation = await this.prisma.client.conversation.findFirst({
      where: {
        id,
        participants: {
          some: {
            userId,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${id} not found`);
    }

    // Since UpdateConversationDto is empty, just return the existing conversation
    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<{ message: string }> {
    // Check if user is participant
    const conversation = await this.prisma.client.conversation.findFirst({
      where: {
        id,
        participants: {
          some: {
            userId,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${id} not found`);
    }

    await this.prisma.client.conversation.delete({
      where: { id },
    });

    return { message: 'Conversation deleted successfully' };
  }

  async addParticipant(
    conversationId: string,
    participantId: string,
    userId: string,
  ): Promise<ConversationResponseDto> {
    // Check if user is participant
    const conversation = await this.prisma.client.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: {
            userId,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(
        `Conversation with ID ${conversationId} not found`,
      );
    }

    // Check if participant exists
    const participant = await this.prisma.client.user.findUnique({
      where: { id: participantId },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    // Check if participant is already in conversation
    const existingParticipant =
      await this.prisma.client.conversationParticipant.findUnique({
        where: {
          userId_conversationId: {
            userId: participantId,
            conversationId,
          },
        },
      });

    if (existingParticipant) {
      throw new ConflictException('Participant already in conversation');
    }

    await this.prisma.client.conversationParticipant.create({
      data: {
        userId: participantId,
        conversationId,
      },
    });

    return this.findOne(conversationId, userId);
  }

  async removeParticipant(
    conversationId: string,
    participantId: string,
    userId: string,
  ): Promise<{ message: string }> {
    // Check if user is participant
    const conversation = await this.prisma.client.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: {
            userId,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(
        `Conversation with ID ${conversationId} not found`,
      );
    }

    const participant =
      await this.prisma.client.conversationParticipant.findUnique({
        where: {
          userId_conversationId: {
            userId: participantId,
            conversationId,
          },
        },
      });

    if (!participant) {
      throw new NotFoundException('Participant not found in conversation');
    }

    await this.prisma.client.conversationParticipant.delete({
      where: {
        userId_conversationId: {
          userId: participantId,
          conversationId,
        },
      },
    });

    return { message: 'Participant removed successfully' };
  }

  // Helper method to find conversation between specific users
  async findConversationBetweenUsers(
    userIds: string[],
  ): Promise<string | null> {
    const conversation = await this.prisma.client.conversation.findFirst({
      where: {
        participants: {
          every: {
            userId: {
              in: userIds,
            },
          },
        },
        AND: {
          participants: {
            some: {
              userId: {
                in: userIds,
              },
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

    return conversation?.id || null;
  }

  // Method to find or create conversation between two users
  async findOrCreateConversationBetweenUsers(
    userId1: string,
    userId2: string,
  ): Promise<string> {
    // First, try to find existing conversation
    const existingConversation = await this.findConversationBetweenUsers([
      userId1,
      userId2,
    ]);

    if (existingConversation) {
      return existingConversation;
    }

    // Create new conversation
    const conversation = await this.prisma.client.conversation.create({
      data: {
        participants: {
          create: [{ userId: userId1 }, { userId: userId2 }],
        },
      },
    });

    return conversation.id;
  }
}
