import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Username',
    example: 'john_doe',
  })
  username: string;

  @ApiProperty({
    description: 'Whether the user is currently online',
    example: true,
  })
  isOnline: boolean;

  @ApiProperty({
    description: 'When the user was last seen (if offline)',
    example: '2023-01-01T00:00:00.000Z',
    required: false,
  })
  lastSeen?: Date;
}
