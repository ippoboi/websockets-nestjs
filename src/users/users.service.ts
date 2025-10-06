import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async searchUsers(query: string) {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const users = await this.prisma.client.user.findMany({
      where: {
        username: {
          contains: query,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        username: true,
        isOnline: true,
        lastSeen: true,
      },
      take: 10,
    });

    return users;
  }
}
