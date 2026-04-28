import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRaffleDto } from './dto/create-raffle.dto';
import { UpdateRaffleDto } from './dto/update-raffle.dto';

@Injectable()
export class RafflesService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    // Release expired ticket reservations every 60 seconds
    setInterval(() => this.releaseExpiredReservations(), 60_000);
  }

  private async releaseExpiredReservations() {
    await this.prisma.ticket.updateMany({
      where: { status: 'reserved', reservedUntil: { lt: new Date() } },
      data: { status: 'available', reservedUntil: null, buyerId: null },
    });
  }

  async getRaffleLimit(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        client: { include: { packages: { where: { type: 'raffle_count', active: true } } } },
      },
    });

    const activePackage = user?.client?.packages[0];
    const limit = activePackage ? parseInt(activePackage.value, 10) : 0;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const used = await this.prisma.raffle.count({
      where: { organizerId: userId, createdAt: { gte: startOfMonth } },
    });

    return { limit, used, canCreate: limit > 0 && used < limit };
  }

  async findAllByOrganizer(organizerId: string) {
    const raffles = await this.prisma.raffle.findMany({
      where: { organizerId },
      include: {
        _count: { select: { tickets: true } },
        tickets: { where: { status: 'paid' }, select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return raffles.map((r) => ({
      ...r,
      soldCount: r.tickets.length,
      tickets: undefined,
    }));
  }

  async findOne(id: string, organizerId: string) {
    const raffle = await this.prisma.raffle.findFirst({
      where: { id, organizerId },
      include: {
        orders: { orderBy: { createdAt: 'desc' } },
        _count: { select: { tickets: true } },
        tickets: { where: { status: 'paid' }, select: { id: true } },
      },
    });
    if (!raffle) throw new NotFoundException('Rifa no encontrada');

    const orders = raffle.orders.map((o) => ({
      ...o,
      ticketIds: JSON.parse(o.ticketIds) as string[],
    }));

    return { ...raffle, orders, soldCount: raffle.tickets.length, tickets: undefined };
  }

  async create(organizerId: string, dto: CreateRaffleDto) {
    const { canCreate } = await this.getRaffleLimit(organizerId);
    if (!canCreate) {
      throw new ForbiddenException('Has alcanzado el límite de rifas de este mes. Contacta al administrador para actualizar tu plan.');
    }

    const existing = await this.prisma.raffle.findUnique({ where: { domain: dto.domain } });
    if (existing) throw new ConflictException('Ese dominio ya está en uso. Elige otro.');

    const raffle = await this.prisma.raffle.create({
      data: { ...dto, organizerId },
    });

    const padLength = String(dto.totalTickets).length;
    const ticketData = Array.from({ length: dto.totalTickets }, (_, i) => ({
      raffleId: raffle.id,
      number: String(i + 1).padStart(padLength, '0'),
      status: 'available',
    }));

    await this.prisma.ticket.createMany({ data: ticketData });

    return raffle;
  }

  async update(id: string, organizerId: string, dto: UpdateRaffleDto) {
    await this.findOne(id, organizerId);

    if (dto.domain) {
      const existing = await this.prisma.raffle.findFirst({
        where: { domain: dto.domain, NOT: { id } },
      });
      if (existing) throw new ConflictException('Ese dominio ya está en uso. Elige otro.');
    }

    return this.prisma.raffle.update({ where: { id }, data: dto });
  }

  async getByDomain(domain: string) {
    // Release expired reservations before returning ticket states
    await this.prisma.ticket.updateMany({
      where: {
        status: 'reserved',
        reservedUntil: { lt: new Date() },
        raffle: { domain },
      },
      data: { status: 'available', reservedUntil: null, buyerId: null },
    });

    const raffle = await this.prisma.raffle.findUnique({
      where: { domain },
      include: {
        tickets: {
          select: { id: true, number: true, status: true, reservedUntil: true },
          orderBy: { number: 'asc' },
        },
      },
    });

    if (!raffle) throw new NotFoundException('Rifa no encontrada');
    if (raffle.status !== 'active') throw new NotFoundException('Esta rifa no está disponible');

    return raffle;
  }
}
