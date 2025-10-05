import { IsString, IsNotEmpty, MinLength, IsObject } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;
}

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class AuthResponseDto {
  @IsString()
  @IsNotEmpty()
  access_token: string;

  @IsObject()
  @IsNotEmpty()
  user: {
    id: string;
    username: string;
  };
}
