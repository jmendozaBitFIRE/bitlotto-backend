import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PublicService } from './public.service';
import { createPrismaMock, PrismaMock } from '../test/prisma-mock';
import { makeOrder, makeTicket } from '../test/fixtures';

describe('PublicService', () => {
  let service: PublicService;
  let prisma: PrismaMock;

  const RAFFLE_ID = 'raffle-1';
  const NOW = new Date('2024-06-15T10:00:00Z');
  const FIFTEEN_MIN_LATER = new Date('2024-06-15T10:15:00Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    prisma = createPrismaMock();
    service = new PublicService(prisma as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── reserveTickets ───────────────────────────────────────────────────────────

  describe('reserveTickets', () => {
    const availableTicket = makeTicket({ id: 'ticket-1', raffleId: RAFFLE_ID, status: 'available' });
    const anotherTicket = makeTicket({ id: 'ticket-2', raffleId: RAFFLE_ID, status: 'available' });

    it('sets status to reserved with reservedUntil = now + 15 minutes', async () => {
      prisma.ticket.findMany.mockResolvedValue([availableTicket, anotherTicket]);
      prisma.ticket.updateMany.mockResolvedValue({ count: 2 });

      await service.reserveTickets({ raffleId: RAFFLE_ID, ticketIds: ['ticket-1', 'ticket-2'] });

      const updateCall = prisma.ticket.updateMany.mock.calls[0][0];
      expect(updateCall.data.status).toBe('reserved');
      expect(updateCall.data.reservedUntil).toEqual(FIFTEEN_MIN_LATER);
    });

    it('returns reservedUntil and the list of ticketIds', async () => {
      prisma.ticket.findMany.mockResolvedValue([availableTicket]);
      prisma.ticket.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.reserveTickets({ raffleId: RAFFLE_ID, ticketIds: ['ticket-1'] });

      expect(result).toMatchObject({
        reservedUntil: FIFTEEN_MIN_LATER,
        ticketIds: ['ticket-1'],
      });
    });

    it('throws NotFoundException when a ticket does not exist in the raffle', async () => {
      // findMany returns fewer tickets than requested → ticket not in this raffle
      prisma.ticket.findMany.mockResolvedValue([availableTicket]);

      await expect(
        service.reserveTickets({ raffleId: RAFFLE_ID, ticketIds: ['ticket-1', 'ticket-ghost'] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when any ticket is already reserved', async () => {
      const reservedTicket = makeTicket({ id: 'ticket-2', raffleId: RAFFLE_ID, status: 'reserved' });
      prisma.ticket.findMany.mockResolvedValue([availableTicket, reservedTicket]);

      await expect(
        service.reserveTickets({ raffleId: RAFFLE_ID, ticketIds: ['ticket-1', 'ticket-2'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when any ticket is already paid', async () => {
      const paidTicket = makeTicket({ id: 'ticket-2', raffleId: RAFFLE_ID, status: 'paid' });
      prisma.ticket.findMany.mockResolvedValue([availableTicket, paidTicket]);

      await expect(
        service.reserveTickets({ raffleId: RAFFLE_ID, ticketIds: ['ticket-1', 'ticket-2'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('uses a transaction to prevent race conditions', async () => {
      prisma.ticket.findMany.mockResolvedValue([availableTicket]);
      prisma.ticket.updateMany.mockResolvedValue({ count: 1 });

      await service.reserveTickets({ raffleId: RAFFLE_ID, ticketIds: ['ticket-1'] });

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  // ─── createOrder ──────────────────────────────────────────────────────────────

  describe('createOrder', () => {
    const reservedTicket1 = makeTicket({
      id: 'ticket-1',
      raffleId: RAFFLE_ID,
      status: 'reserved',
      reservedUntil: new Date('2024-06-15T10:14:00Z'), // 14 min from now, not expired
    });
    const reservedTicket2 = makeTicket({
      id: 'ticket-2',
      raffleId: RAFFLE_ID,
      status: 'reserved',
      reservedUntil: new Date('2024-06-15T10:14:00Z'),
    });

    const orderDto = {
      raffleId: RAFFLE_ID,
      ticketIds: ['ticket-1', 'ticket-2'],
      buyerName: 'Juan Pérez',
      buyerPhone: '5512345678',
      buyerCity: 'CDMX',
    };

    it('creates a TicketOrder when all tickets are reserved and not expired', async () => {
      prisma.ticket.findMany.mockResolvedValue([reservedTicket1, reservedTicket2]);
      const createdOrder = makeOrder({ id: 'order-1', ...orderDto });
      prisma.ticketOrder.create.mockResolvedValue(createdOrder);

      const result = await service.createOrder(orderDto as any);

      expect(prisma.ticketOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            raffleId: RAFFLE_ID,
            buyerName: 'Juan Pérez',
            buyerPhone: '5512345678',
            buyerCity: 'CDMX',
            status: 'pending',
          }),
        }),
      );
      expect(result.id).toBe('order-1');
    });

    it('stores ticketIds as a JSON string in the database', async () => {
      prisma.ticket.findMany.mockResolvedValue([reservedTicket1, reservedTicket2]);
      prisma.ticketOrder.create.mockResolvedValue(makeOrder());

      await service.createOrder(orderDto as any);

      const createCall = prisma.ticketOrder.create.mock.calls[0][0];
      expect(createCall.data.ticketIds).toBe(JSON.stringify(['ticket-1', 'ticket-2']));
    });

    it('throws BadRequestException when tickets are not in reserved status', async () => {
      const availableTicket = makeTicket({ id: 'ticket-1', status: 'available', raffleId: RAFFLE_ID });
      prisma.ticket.findMany.mockResolvedValue([availableTicket]);

      await expect(service.createOrder({ ...orderDto, ticketIds: ['ticket-1'] } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when reservation has expired', async () => {
      const expiredTicket = makeTicket({
        id: 'ticket-1',
        raffleId: RAFFLE_ID,
        status: 'reserved',
        reservedUntil: new Date('2024-06-15T09:45:00Z'), // 15 min in the past
      });
      prisma.ticket.findMany.mockResolvedValue([expiredTicket]);
      prisma.ticket.updateMany.mockResolvedValue({ count: 1 });

      await expect(service.createOrder({ ...orderDto, ticketIds: ['ticket-1'] } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('resets expired tickets back to available when reservation expires', async () => {
      const expiredTicket = makeTicket({
        id: 'ticket-1',
        raffleId: RAFFLE_ID,
        status: 'reserved',
        reservedUntil: new Date('2024-06-15T09:45:00Z'),
      });
      prisma.ticket.findMany.mockResolvedValue([expiredTicket]);
      prisma.ticket.updateMany.mockResolvedValue({ count: 1 });

      await expect(service.createOrder({ ...orderDto, ticketIds: ['ticket-1'] } as any)).rejects.toThrow();

      expect(prisma.ticket.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['ticket-1'] } },
          data: { status: 'available', reservedUntil: null },
        }),
      );
    });

    it('throws NotFoundException when ticket IDs do not belong to the raffle', async () => {
      // findMany returns fewer tickets than requested
      prisma.ticket.findMany.mockResolvedValue([reservedTicket1]); // only 1, but 2 requested

      await expect(service.createOrder(orderDto as any)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── attachReceipt ────────────────────────────────────────────────────────────

  describe('attachReceipt', () => {
    const ORDER_ID = 'order-1';

    it('updates the order with the receipt image URL', async () => {
      const order = makeOrder({ id: ORDER_ID, status: 'pending' });
      prisma.ticketOrder.findUnique.mockResolvedValue(order);
      prisma.ticketOrder.update.mockResolvedValue({ ...order, receiptImage: '/uploads/receipt.jpg' });

      const result = await service.attachReceipt(ORDER_ID, '/uploads/receipt.jpg');

      expect(prisma.ticketOrder.update).toHaveBeenCalledWith({
        where: { id: ORDER_ID },
        data: { receiptImage: '/uploads/receipt.jpg' },
      });
      expect(result.receiptImage).toBe('/uploads/receipt.jpg');
    });

    it('throws NotFoundException when order does not exist', async () => {
      prisma.ticketOrder.findUnique.mockResolvedValue(null);

      await expect(service.attachReceipt('ghost-id', '/uploads/receipt.jpg')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when order is already confirmed', async () => {
      prisma.ticketOrder.findUnique.mockResolvedValue(makeOrder({ id: ORDER_ID, status: 'confirmed' }));

      await expect(service.attachReceipt(ORDER_ID, '/uploads/receipt.jpg')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when order is already rejected', async () => {
      prisma.ticketOrder.findUnique.mockResolvedValue(makeOrder({ id: ORDER_ID, status: 'rejected' }));

      await expect(service.attachReceipt(ORDER_ID, '/uploads/receipt.jpg')).rejects.toThrow(BadRequestException);
    });
  });
});
