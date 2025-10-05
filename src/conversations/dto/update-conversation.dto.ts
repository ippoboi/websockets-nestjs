import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateConversationDto {
  @ApiProperty({
    description: 'Optional conversation name or title',
    example: 'Project Discussion',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;
}
