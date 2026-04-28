import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReserveTicketsDto } from './dto/reserve-tickets.dto';
import { CreateOrderDto } from './dto/create-order.dto';

const RESERVATION_MINUTES = 15;

@Injectable()
export class PublicService {
  constructor(private prisma: PrismaService) {}

  async reserveTickets(dto: ReserveTicketsDto) {
    const reservedUntil = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);

    return this.prisma.$transaction(async (tx) => {
      const tickets = await tx.ticket.findMany({
        where: { id: { in: dto.ticketIds }, raffleId: dto.raffleId },
      });

      if (tickets.length !== dto.ticketIds.length) {
        throw new NotFoundException('Uno o más boletos no existen en esta rifa');
      }

      const unavailable = tickets.filter((t) => t.status !== 'available');
      if (unavailable.length > 0) {
        throw new BadRequestException(
          `Los boletos ${unavailable.map((t) => t.number).join(', ')} ya no están disponibles`,
        );
      }

      await tx.ticket.updateMany({
        where: { id: { in: dto.ticketIds } },
        data: { status: 'reserved', reservedUntil },
      });

      return { reservedUntil, ticketIds: dto.ticketIds };
    });
  }

  async createOrder(dto: CreateOrderDto) {
    const tickets = await this.prisma.ticket.findMany({
      where: { id: { in: dto.ticketIds }, raffleId: dto.raffleId },
    });

    if (tickets.length !== dto.ticketIds.length) {
      throw new NotFoundException('Uno o más boletos no existen');
    }

    const notReserved = tickets.filter((t) => t.status !== 'reserved');
    if (notReserved.length > 0) {
      throw new BadRequestException('Los boletos ya no están apartados. Vuelve a seleccionarlos.');
    }

    const expired = tickets.filter((t) => t.reservedUntil && t.reservedUntil < new Date());
    if (expired.length > 0) {
      await this.prisma.ticket.updateMany({
        where: { id: { in: expired.map((t) => t.id) } },
        data: { status: 'available', reservedUntil: null },
      });
      throw new BadRequestException('La reservación expiró. Vuelve a seleccionar tus boletos.');
    }

    return this.prisma.ticketOrder.create({
      data: {
        raffleId: dto.raffleId,
        ticketIds: JSON.stringify(dto.ticketIds),
        buyerName: dto.buyerName,
        buyerPhone: dto.buyerPhone,
        buyerCity: dto.buyerCity,
        status: 'pending',
      },
    });
  }

  async attachReceipt(orderId: string, receiptImageUrl: string) {
    const order = await this.prisma.ticketOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Orden no encontrada');
    if (order.status !== 'pending') throw new BadRequestException('Esta orden ya fue procesada');

    return this.prisma.ticketOrder.update({
      where: { id: orderId },
      data: { receiptImage: receiptImageUrl },
    });
  }
}
