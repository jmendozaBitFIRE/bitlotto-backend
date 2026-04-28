import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';

@Injectable()
export class PackagesService {
  constructor(private prisma: PrismaService) {}

  findByClient(clientId: string) {
    return this.prisma.package.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(clientId: string, dto: CreatePackageDto) {
    return this.prisma.package.create({
      data: { ...dto, clientId },
    });
  }

  async update(clientId: string, id: string, dto: UpdatePackageDto) {
    const pkg = await this.prisma.package.findFirst({ where: { id, clientId } });
    if (!pkg) throw new NotFoundException(`Paquete con id ${id} no encontrado`);
    return this.prisma.package.update({ where: { id }, data: dto });
  }

  async remove(clientId: string, id: string) {
    const pkg = await this.prisma.package.findFirst({ where: { id, clientId } });
    if (!pkg) throw new NotFoundException(`Paquete con id ${id} no encontrado`);
    return this.prisma.package.delete({ where: { id } });
  }
}
