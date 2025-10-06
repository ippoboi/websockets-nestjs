import { ApiProperty } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty({
    description: 'Message ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Message content',
    example: 'Hello, how are you?',
  })
  content: string;

  @ApiProperty({
    description: 'Author ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  authorId: string;

  @ApiProperty({
    description: 'Conversation ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  conversationId: string;

  @ApiProperty({
    description: 'Message creation date',
    example: '2023-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Message last update date',
    example: '2023-01-01T00:00:00.000Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'User information',
    type: 'object',
    properties: {
      id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
      username: { type: 'string', example: 'john_doe' },
    },
  })
  user: {
    id: string;
    username: string;
  };

  @ApiProperty({
    description: 'Read receipts for this message',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        userId: {
          type: 'string',
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
        readAt: {
          type: 'string',
          format: 'date-time',
          example: '2023-01-01T00:00:00.000Z',
        },
        user: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            username: { type: 'string', example: 'john_doe' },
          },
        },
      },
    },
  })
  readReceipts: {
    id: string;
    userId: string;
    readAt: Date;
    user: {
      id: string;
      username: string;
    };
  }[];
}
