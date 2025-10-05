import { ApiProperty } from '@nestjs/swagger';
import { MessageResponseDto } from 'src/messages/dto';
import { UserDto } from 'src/users/dto/users.dto';

export class ConversationParticipantDto {
  @ApiProperty({
    description: 'Participant ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'User information',
    type: UserDto,
  })
  user: UserDto;

  @ApiProperty({
    description: 'When the user joined the conversation',
    example: '2023-01-01T00:00:00.000Z',
  })
  createdAt: Date;
}

export class ConversationResponseDto {
  @ApiProperty({
    description: 'Conversation ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Conversation creation date',
    example: '2023-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Conversation last update date',
    example: '2023-01-01T00:00:00.000Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Conversation participants',
    type: [ConversationParticipantDto],
  })
  participants: ConversationParticipantDto[];

  @ApiProperty({
    description: 'Latest message in the conversation',
    required: false,
    type: MessageResponseDto,
  })
  latestMessage?: MessageResponseDto;
}
