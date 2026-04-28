import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.client.findMany({
      include: {
        packages: { where: { active: true }, orderBy: { createdAt: 'desc' } },
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        packages: { orderBy: { createdAt: 'desc' } },
        _count: { select: { users: true } },
      },
    });
    if (!client) throw new NotFoundException(`Cliente con id ${id} no encontrado`);
    return client;
  }

  create(dto: CreateClientDto) {
    return this.prisma.client.create({ data: dto });
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.findOne(id);
    return this.prisma.client.update({ where: { id }, data: dto });
  }

  async toggleStatus(id: string) {
    const client = await this.findOne(id);
    const newStatus = client.status === 'active' ? 'inactive' : 'active';
    return this.prisma.client.update({
      where: { id },
      data: { status: newStatus },
    });
  }
}
