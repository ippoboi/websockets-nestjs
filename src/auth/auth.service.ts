import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async signIn(username: string, password: string) {
    console.log('Auth attempt:', { username, password });
    const user = this.usersService.findOne(username);
    console.log('Found user:', user);

    if (!user) {
      console.log('User not found');
      throw new UnauthorizedException();
    }

    if (user.password !== password) {
      console.log('Password mismatch:', {
        expected: user.password,
        received: password,
      });
      throw new UnauthorizedException();
    }

    const payload = { sub: user.userId, username: user.username };
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}
