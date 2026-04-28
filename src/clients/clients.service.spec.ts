import { NotFoundException } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { createPrismaMock, PrismaMock } from '../test/prisma-mock';
import { makeClient } from '../test/fixtures';

describe('ClientsService', () => {
  let service: ClientsService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ClientsService(prisma as any);
  });

  describe('toggleStatus', () => {
    it('sets an active client to inactive', async () => {
      const client = makeClient({ id: 'client-1', status: 'active' });
      prisma.client.findUnique
        .mockResolvedValueOnce({ ...client, packages: [], _count: { users: 0 } }) // findOne inside toggleStatus
        .mockResolvedValueOnce({ ...client, packages: [], _count: { users: 0 } }); // not called again in update
      prisma.client.update.mockResolvedValue({ ...client, status: 'inactive' });

      const result = await service.toggleStatus('client-1');

      expect(prisma.client.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: { status: 'inactive' },
      });
      expect(result.status).toBe('inactive');
    });

    it('sets an inactive client to active', async () => {
      const client = makeClient({ id: 'client-1', status: 'inactive' });
      prisma.client.findUnique.mockResolvedValue({ ...client, packages: [], _count: { users: 0 } });
      prisma.client.update.mockResolvedValue({ ...client, status: 'active' });

      const result = await service.toggleStatus('client-1');

      expect(prisma.client.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: { status: 'active' },
      });
      expect(result.status).toBe('active');
    });

    it('throws NotFoundException when client does not exist', async () => {
      prisma.client.findUnique.mockResolvedValue(null);

      await expect(service.toggleStatus('ghost-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when client does not exist', async () => {
      prisma.client.findUnique.mockResolvedValue(null);

      await expect(service.findOne('ghost-id')).rejects.toThrow(NotFoundException);
    });
  });
});
