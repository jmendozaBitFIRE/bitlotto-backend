import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';
import { Role } from '../auth/enums/role.enum';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { googleId },
    });
  }

  async findByEmailWithClient(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { client: true },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async updateGoogleId(id: string, googleId: string, name?: string, avatar?: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { googleId, name, avatar },
    });
  }

  async updatePassword(id: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
  }

  async create(data: {
    email: string;
    passwordHash?: string;
    googleId?: string;
    name?: string;
    avatar?: string;
    role?: Role;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        googleId: data.googleId,
        name: data.name,
        avatar: data.avatar,
        role: data.role ?? Role.ORGANIZADOR,
      },
    });
  }
}
