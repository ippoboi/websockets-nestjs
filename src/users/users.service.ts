import { Injectable } from '@nestjs/common';

export type User = {
  userId: number;
  username: string;
  password: string; // In production, use hashed passwords
};

@Injectable()
export class UsersService {
  private readonly users: User[] = [
    {
      userId: 1,
      username: 'testUser',
      password: 'test1234', // Use bcrypt hash in production
    },
  ];

  findOne(username: string): User | undefined {
    return this.users.find((user) => user.username === username);
  }
}
