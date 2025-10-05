import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMessageDto {
  @ApiProperty({
    description: 'Updated message content',
    example: 'Updated message content',
    required: false,
  })
  @IsString()
  @IsOptional()
  content?: string;
}
