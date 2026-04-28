import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RafflesService } from './raffles.service';
import { createPrismaMock, PrismaMock } from '../test/prisma-mock';
import { makeClient, makePackage, makeRaffle, makeTicket, makeUser } from '../test/fixtures';

describe('RafflesService', () => {
  let service: RafflesService;
  let prisma: PrismaMock;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-15T10:00:00Z'));
    prisma = createPrismaMock();
    // Instantiate directly — avoids triggering onModuleInit / setInterval
    service = new RafflesService(prisma as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── getRaffleLimit ──────────────────────────────────────────────────────────

  describe('getRaffleLimit', () => {
    it('returns limit=0 and canCreate=false when user has no active raffle_count package', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser({ client: makeClient({ packages: [] }) }));
      prisma.raffle.count.mockResolvedValue(0);

      const result = await service.getRaffleLimit('user-1');

      expect(result).toEqual({ limit: 0, used: 0, canCreate: false });
    });

    it('returns correct limit, used count, and canCreate=true when within limit', async () => {
      const pkg = makePackage({ value: '5' });
      prisma.user.findUnique.mockResolvedValue(makeUser({ client: makeClient({ packages: [pkg] }) }));
      prisma.raffle.count.mockResolvedValue(3);

      const result = await service.getRaffleLimit('user-1');

      expect(result).toEqual({ limit: 5, used: 3, canCreate: true });
    });

    it('returns canCreate=false when used equals limit', async () => {
      const pkg = makePackage({ value: '3' });
      prisma.user.findUnique.mockResolvedValue(makeUser({ client: makeClient({ packages: [pkg] }) }));
      prisma.raffle.count.mockResolvedValue(3);

      const result = await service.getRaffleLimit('user-1');

      expect(result.canCreate).toBe(false);
    });

    it('queries only current-month raffles for the used count', async () => {
      const pkg = makePackage({ value: '10' });
      prisma.user.findUnique.mockResolvedValue(makeUser({ client: makeClient({ packages: [pkg] }) }));
      prisma.raffle.count.mockResolvedValue(1);

      await service.getRaffleLimit('user-1');

      const countCall = prisma.raffle.count.mock.calls[0][0];
      const gte: Date = countCall.where.createdAt.gte;
      // Must be the 1st of the current month at local midnight
      expect(gte.getDate()).toBe(1);
      expect(gte.getHours()).toBe(0);
      expect(gte.getMinutes()).toBe(0);
      expect(gte.getSeconds()).toBe(0);
    });
  });

  // ─── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      title: 'iPhone 16',
      prizeDescription: 'Nuevo iPhone',
      ticketPrice: 50,
      totalTickets: 100,
      domain: 'iphone-16',
      status: 'draft',
    };

    beforeEach(() => {
      // Default: organizer has 10 allowed, has used 0
      const pkg = makePackage({ value: '10' });
      prisma.user.findUnique.mockResolvedValue(makeUser({ client: makeClient({ packages: [pkg] }) }));
      prisma.raffle.count.mockResolvedValue(0);
    });

    it('throws ForbiddenException when monthly raffle limit is reached', async () => {
      jest.spyOn(service, 'getRaffleLimit').mockResolvedValue({ limit: 2, used: 2, canCreate: false });

      await expect(service.create('user-1', dto as any)).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when domain is already taken', async () => {
      jest.spyOn(service, 'getRaffleLimit').mockResolvedValue({ limit: 10, used: 0, canCreate: true });
      prisma.raffle.findUnique.mockResolvedValue(makeRaffle({ domain: dto.domain }));

      await expect(service.create('user-1', dto as any)).rejects.toThrow(ConflictException);
    });

    it('creates raffle and generates the correct number of tickets', async () => {
      jest.spyOn(service, 'getRaffleLimit').mockResolvedValue({ limit: 10, used: 0, canCreate: true });
      prisma.raffle.findUnique.mockResolvedValue(null); // domain available
      const createdRaffle = makeRaffle({ id: 'raffle-new', domain: dto.domain });
      prisma.raffle.create.mockResolvedValue(createdRaffle);
      prisma.ticket.createMany.mockResolvedValue({ count: 100 });

      await service.create('user-1', dto as any);

      const createManyCall = prisma.ticket.createMany.mock.calls[0][0];
      expect(createManyCall.data).toHaveLength(100);
      expect(createManyCall.data.every((t: any) => t.raffleId === 'raffle-new')).toBe(true);
      expect(createManyCall.data.every((t: any) => t.status === 'available')).toBe(true);
    });

    it('generates zero-padded ticket numbers matching totalTickets length', async () => {
      jest.spyOn(service, 'getRaffleLimit').mockResolvedValue({ limit: 10, used: 0, canCreate: true });
      prisma.raffle.findUnique.mockResolvedValue(null);
      prisma.raffle.create.mockResolvedValue(makeRaffle({ id: 'r-1', totalTickets: 100 }));
      prisma.ticket.createMany.mockResolvedValue({ count: 100 });

      await service.create('user-1', { ...dto, totalTickets: 100 } as any);

      const tickets = prisma.ticket.createMany.mock.calls[0][0].data;
      expect(tickets[0].number).toBe('001');    // 1 → 3 digits
      expect(tickets[9].number).toBe('010');
      expect(tickets[99].number).toBe('100');
    });

    it('uses 4-digit padding for 1000-ticket raffles', async () => {
      jest.spyOn(service, 'getRaffleLimit').mockResolvedValue({ limit: 10, used: 0, canCreate: true });
      prisma.raffle.findUnique.mockResolvedValue(null);
      prisma.raffle.create.mockResolvedValue(makeRaffle({ id: 'r-1', totalTickets: 1000 }));
      prisma.ticket.createMany.mockResolvedValue({ count: 1000 });

      await service.create('user-1', { ...dto, totalTickets: 1000 } as any);

      const tickets = prisma.ticket.createMany.mock.calls[0][0].data;
      expect(tickets[0].number).toBe('0001');
      expect(tickets[999].number).toBe('1000');
    });
  });

  // ─── findOne / ownership ──────────────────────────────────────────────────────

  describe('findOne', () => {
    it('throws NotFoundException when raffle does not exist for organizer', async () => {
      prisma.raffle.findFirst.mockResolvedValue(null);

      await expect(service.findOne('raffle-x', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('cannot access another organizer\'s raffle', async () => {
      // findFirst returns null when organizerId doesn't match — Prisma handles this in WHERE clause
      prisma.raffle.findFirst.mockResolvedValue(null);

      await expect(service.findOne('raffle-1', 'other-user')).rejects.toThrow(NotFoundException);

      // Verify the organizerId was passed in the query
      expect(prisma.raffle.findFirst.mock.calls[0][0].where.organizerId).toBe('other-user');
    });
  });

  // ─── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('throws NotFoundException when raffle not owned by organizer', async () => {
      prisma.raffle.findFirst.mockResolvedValue(null); // findOne will throw

      await expect(service.update('raffle-1', 'wrong-user', { title: 'New' })).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when new domain is already taken by another raffle', async () => {
      prisma.raffle.findFirst
        .mockResolvedValueOnce(makeRaffle({ id: 'raffle-1', orders: [] })) // findOne succeeds
        .mockResolvedValueOnce(makeRaffle({ id: 'raffle-other', domain: 'taken-domain' })); // domain conflict

      await expect(service.update('raffle-1', 'user-1', { domain: 'taken-domain' })).rejects.toThrow(ConflictException);
    });
  });

  // ─── getByDomain ─────────────────────────────────────────────────────────────

  describe('getByDomain', () => {
    it('throws NotFoundException for unknown domain', async () => {
      prisma.ticket.updateMany.mockResolvedValue({ count: 0 });
      prisma.raffle.findUnique.mockResolvedValue(null);

      await expect(service.getByDomain('nonexistent-domain')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for a draft raffle', async () => {
      prisma.ticket.updateMany.mockResolvedValue({ count: 0 });
      prisma.raffle.findUnique.mockResolvedValue(makeRaffle({ status: 'draft', tickets: [] }));

      await expect(service.getByDomain('some-domain')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for a closed raffle', async () => {
      prisma.ticket.updateMany.mockResolvedValue({ count: 0 });
      prisma.raffle.findUnique.mockResolvedValue(makeRaffle({ status: 'closed', tickets: [] }));

      await expect(service.getByDomain('some-domain')).rejects.toThrow(NotFoundException);
    });

    it('releases expired reservations before returning ticket states', async () => {
      prisma.ticket.updateMany.mockResolvedValue({ count: 2 });
      prisma.raffle.findUnique.mockResolvedValue(makeRaffle({ status: 'active', tickets: [] }));

      await service.getByDomain('my-raffle');

      const call = prisma.ticket.updateMany.mock.calls[0][0];
      expect(call.where.status).toBe('reserved');
      expect(call.where.reservedUntil.lt).toEqual(new Date('2024-06-15T10:00:00Z'));
      expect(call.data).toMatchObject({ status: 'available', reservedUntil: null, buyerId: null });
    });

    it('returns active raffle with tickets when domain is found', async () => {
      const raffle = makeRaffle({ status: 'active', tickets: [makeTicket()] });
      prisma.ticket.updateMany.mockResolvedValue({ count: 0 });
      prisma.raffle.findUnique.mockResolvedValue(raffle);

      const result = await service.getByDomain('iphone-16-pro');

      expect(result.domain).toBe('iphone-16-pro');
    });
  });

  // ─── releaseExpiredReservations ───────────────────────────────────────────────

  describe('releaseExpiredReservations (background job)', () => {
    it('targets only reserved tickets whose reservedUntil is in the past', async () => {
      prisma.ticket.updateMany.mockResolvedValue({ count: 3 });

      await (service as any).releaseExpiredReservations();

      const call = prisma.ticket.updateMany.mock.calls[0][0];
      expect(call.where.status).toBe('reserved');
      expect(call.where.reservedUntil.lt).toEqual(new Date('2024-06-15T10:00:00Z'));
    });

    it('sets released tickets back to available with no reservedUntil or buyerId', async () => {
      prisma.ticket.updateMany.mockResolvedValue({ count: 1 });

      await (service as any).releaseExpiredReservations();

      const call = prisma.ticket.updateMany.mock.calls[0][0];
      expect(call.data).toEqual({ status: 'available', reservedUntil: null, buyerId: null });
    });

    it('does NOT include paid tickets in the release query', async () => {
      prisma.ticket.updateMany.mockResolvedValue({ count: 0 });

      await (service as any).releaseExpiredReservations();

      const where = prisma.ticket.updateMany.mock.calls[0][0].where;
      expect(where.status).toBe('reserved'); // only reserved, not paid
    });

    it('running the job twice is idempotent (same query, no error)', async () => {
      prisma.ticket.updateMany.mockResolvedValue({ count: 0 });

      await (service as any).releaseExpiredReservations();
      await (service as any).releaseExpiredReservations();

      expect(prisma.ticket.updateMany).toHaveBeenCalledTimes(2);
      // Both calls use identical queries
      expect(prisma.ticket.updateMany.mock.calls[0]).toEqual(prisma.ticket.updateMany.mock.calls[1]);
    });
  });
});
