import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { createPrismaMock, PrismaMock } from '../test/prisma-mock';
import { makeOrder, makeRaffle, makeTicket } from '../test/fixtures';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: PrismaMock;

  const ORGANIZER_ID = 'user-1';
  const RAFFLE_ID = 'raffle-1';
  const ORDER_ID = 'order-1';
  const TICKET_IDS = ['ticket-1', 'ticket-2'];

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new OrdersService(prisma as any);
  });

  // ─── findAllByRaffle ──────────────────────────────────────────────────────────

  describe('findAllByRaffle', () => {
    it('throws NotFoundException when raffle is not owned by the organizer', async () => {
      prisma.raffle.findFirst.mockResolvedValue(null);

      await expect(service.findAllByRaffle(RAFFLE_ID, 'wrong-user')).rejects.toThrow(NotFoundException);
    });

    it('returns orders with ticketIds parsed from JSON string', async () => {
      prisma.raffle.findFirst.mockResolvedValue(makeRaffle({ id: RAFFLE_ID }));
      prisma.ticketOrder.findMany.mockResolvedValue([
        makeOrder({ id: ORDER_ID, ticketIds: JSON.stringify(TICKET_IDS) }),
      ]);

      const result = await service.findAllByRaffle(RAFFLE_ID, ORGANIZER_ID);

      expect(result[0].ticketIds).toEqual(TICKET_IDS);
    });
  });

  // ─── updateStatus ────────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    const confirmedOrder = makeOrder({ id: ORDER_ID, raffleId: RAFFLE_ID, ticketIds: JSON.stringify(TICKET_IDS), status: 'pending' });

    beforeEach(() => {
      prisma.raffle.findFirst.mockResolvedValue(makeRaffle({ id: RAFFLE_ID, organizerId: ORGANIZER_ID }));
      prisma.ticketOrder.findFirst.mockResolvedValue(confirmedOrder);
      prisma.ticketOrder.update.mockResolvedValue({ ...confirmedOrder, status: 'confirmed' });
      prisma.ticket.updateMany.mockResolvedValue({ count: 2 });
      prisma.ticketOrder.findUnique.mockResolvedValue({ ...confirmedOrder, status: 'confirmed' });
    });

    it('confirming an order sets order status to confirmed and tickets to paid', async () => {
      await service.updateStatus(RAFFLE_ID, ORDER_ID, ORGANIZER_ID, { status: 'confirmed' });

      expect(prisma.ticketOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ORDER_ID }, data: { status: 'confirmed' } }),
      );
      expect(prisma.ticket.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: TICKET_IDS } },
          data: expect.objectContaining({ status: 'paid', buyerId: ORDER_ID }),
        }),
      );
    });

    it('confirming sets ticket reservedUntil to null', async () => {
      await service.updateStatus(RAFFLE_ID, ORDER_ID, ORGANIZER_ID, { status: 'confirmed' });

      const updateCall = prisma.ticket.updateMany.mock.calls[0][0];
      expect(updateCall.data.reservedUntil).toBeNull();
    });

    it('rejecting an order sets order status to rejected and tickets back to available', async () => {
      prisma.ticketOrder.findUnique.mockResolvedValue({ ...confirmedOrder, status: 'rejected' });

      await service.updateStatus(RAFFLE_ID, ORDER_ID, ORGANIZER_ID, { status: 'rejected' });

      expect(prisma.ticketOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ORDER_ID }, data: { status: 'rejected' } }),
      );
      expect(prisma.ticket.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: TICKET_IDS } },
          data: expect.objectContaining({ status: 'available', reservedUntil: null, buyerId: null }),
        }),
      );
    });

    it('throws BadRequestException when trying to confirm an already-confirmed order', async () => {
      prisma.ticketOrder.findFirst.mockResolvedValue(
        makeOrder({ id: ORDER_ID, raffleId: RAFFLE_ID, status: 'confirmed' }),
      );

      await expect(
        service.updateStatus(RAFFLE_ID, ORDER_ID, ORGANIZER_ID, { status: 'confirmed' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when trying to reject an already-rejected order', async () => {
      prisma.ticketOrder.findFirst.mockResolvedValue(
        makeOrder({ id: ORDER_ID, raffleId: RAFFLE_ID, status: 'rejected' }),
      );

      await expect(
        service.updateStatus(RAFFLE_ID, ORDER_ID, ORGANIZER_ID, { status: 'rejected' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when trying to reject an already-confirmed order', async () => {
      prisma.ticketOrder.findFirst.mockResolvedValue(
        makeOrder({ id: ORDER_ID, raffleId: RAFFLE_ID, status: 'confirmed' }),
      );

      await expect(
        service.updateStatus(RAFFLE_ID, ORDER_ID, ORGANIZER_ID, { status: 'rejected' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when order does not belong to the raffle', async () => {
      prisma.raffle.findFirst.mockResolvedValue(makeRaffle({ id: RAFFLE_ID }));
      prisma.ticketOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStatus(RAFFLE_ID, 'wrong-order', ORGANIZER_ID, { status: 'confirmed' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when raffle does not belong to organizer', async () => {
      prisma.raffle.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStatus(RAFFLE_ID, ORDER_ID, 'wrong-organizer', { status: 'confirmed' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
