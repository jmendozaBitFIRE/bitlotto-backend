import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async findAllByRaffle(raffleId: string, organizerId: string) {
    const raffle = await this.prisma.raffle.findFirst({ where: { id: raffleId, organizerId } });
    if (!raffle) throw new NotFoundException('Rifa no encontrada');

    const orders = await this.prisma.ticketOrder.findMany({
      where: { raffleId },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((o) => ({ ...o, ticketIds: JSON.parse(o.ticketIds) as string[] }));
  }

  async updateStatus(raffleId: string, orderId: string, organizerId: string, dto: UpdateOrderStatusDto) {
    const raffle = await this.prisma.raffle.findFirst({ where: { id: raffleId, organizerId } });
    if (!raffle) throw new NotFoundException('Rifa no encontrada');

    const order = await this.prisma.ticketOrder.findFirst({ where: { id: orderId, raffleId } });
    if (!order) throw new NotFoundException('Orden no encontrada');
    if (order.status !== 'pending') throw new BadRequestException('Solo se pueden actualizar órdenes pendientes');

    const ticketIds: string[] = JSON.parse(order.ticketIds);

    if (dto.status === 'confirmed') {
      await this.prisma.$transaction([
        this.prisma.ticketOrder.update({ where: { id: orderId }, data: { status: 'confirmed' } }),
        this.prisma.ticket.updateMany({
          where: { id: { in: ticketIds } },
          data: { status: 'paid', reservedUntil: null, buyerId: orderId },
        }),
      ]);
    } else {
      await this.prisma.$transaction([
        this.prisma.ticketOrder.update({ where: { id: orderId }, data: { status: 'rejected' } }),
        this.prisma.ticket.updateMany({
          where: { id: { in: ticketIds } },
          data: { status: 'available', reservedUntil: null, buyerId: null },
        }),
      ]);
    }

    const updated = await this.prisma.ticketOrder.findUnique({ where: { id: orderId } });
    return { ...updated!, ticketIds };
  }
}
