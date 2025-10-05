import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import {
  CreateConversationDto,
  UpdateConversationDto,
  ConversationResponseDto,
} from './dto';
import { AuthGuard } from '../auth/guards/auth.guard';

@ApiTags('Conversations')
@Controller('conversations')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new conversation' })
  @ApiBody({ type: CreateConversationDto })
  @ApiResponse({
    status: 201,
    description: 'Conversation successfully created',
    type: ConversationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'One or more participants not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conversation already exists between these participants',
  })
  async create(
    @Body() createConversationDto: CreateConversationDto,
    @Request() req: { user: { sub: string; username: string } },
  ) {
    return this.conversationsService.create(
      createConversationDto,
      req.user.sub,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all conversations for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Conversations retrieved successfully',
    type: [ConversationResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing token',
  })
  async findAll(@Request() req: { user: { sub: string; username: string } }) {
    return this.conversationsService.findAll(req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a conversation by ID' })
  @ApiParam({
    name: 'id',
    description: 'Conversation ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Conversation retrieved successfully',
    type: ConversationResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'Conversation not found',
  })
  async findOne(
    @Param('id') id: string,
    @Request() req: { user: { sub: string; username: string } },
  ) {
    return this.conversationsService.findOne(id, req.user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a conversation' })
  @ApiParam({
    name: 'id',
    description: 'Conversation ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: UpdateConversationDto })
  @ApiResponse({
    status: 200,
    description: 'Conversation successfully updated',
    type: ConversationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'Conversation not found',
  })
  async update(
    @Param('id') id: string,
    @Body() updateConversationDto: UpdateConversationDto,
    @Request() req: { user: { sub: string; username: string } },
  ) {
    return this.conversationsService.update(
      id,
      updateConversationDto,
      req.user.sub,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a conversation' })
  @ApiParam({
    name: 'id',
    description: 'Conversation ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Conversation successfully deleted',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Conversation deleted successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'Conversation not found',
  })
  async remove(
    @Param('id') id: string,
    @Request() req: { user: { sub: string; username: string } },
  ) {
    return this.conversationsService.remove(id, req.user.sub);
  }

  @Post(':id/participants')
  @ApiOperation({ summary: 'Add a participant to a conversation' })
  @ApiParam({
    name: 'id',
    description: 'Conversation ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        participantId: {
          type: 'string',
          example: '123e4567-e89b-12d3-a456-426614174000',
          description: 'User ID to add to the conversation',
        },
      },
      required: ['participantId'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Participant successfully added',
    type: ConversationResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'Conversation or participant not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Participant already in conversation',
  })
  async addParticipant(
    @Param('id') conversationId: string,
    @Body('participantId') participantId: string,
    @Request() req: { user: { sub: string; username: string } },
  ) {
    return this.conversationsService.addParticipant(
      conversationId,
      participantId,
      req.user.sub,
    );
  }

  @Delete(':id/participants/:participantId')
  @ApiOperation({ summary: 'Remove a participant from a conversation' })
  @ApiParam({
    name: 'id',
    description: 'Conversation ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'participantId',
    description: 'Participant ID to remove',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Participant successfully removed',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Participant removed successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'Conversation or participant not found',
  })
  async removeParticipant(
    @Param('id') conversationId: string,
    @Param('participantId') participantId: string,
    @Request() req: { user: { sub: string; username: string } },
  ) {
    return this.conversationsService.removeParticipant(
      conversationId,
      participantId,
      req.user.sub,
    );
  }
}
