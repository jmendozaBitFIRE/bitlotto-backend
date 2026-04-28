import { randomUUID } from 'crypto';

export const makeUser = (overrides: Record<string, any> = {}) => ({
  id: randomUUID(),
  email: 'organizer@test.com',
  passwordHash: '$2b$12$hashed',
  role: 'ORGANIZADOR',
  clientId: 'client-1',
  createdAt: new Date('2024-01-01'),
  client: null,
  ...overrides,
});

export const makeClient = (overrides: Record<string, any> = {}) => ({
  id: 'client-1',
  name: 'Test Organization',
  email: 'org@test.com',
  status: 'active',
  createdAt: new Date('2024-01-01'),
  packages: [],
  _count: { users: 0 },
  ...overrides,
});

export const makePackage = (overrides: Record<string, any> = {}) => ({
  id: randomUUID(),
  clientId: 'client-1',
  type: 'raffle_count',
  value: '10',
  active: true,
  createdAt: new Date('2024-01-01'),
  ...overrides,
});

export const makeRaffle = (overrides: Record<string, any> = {}) => ({
  id: randomUUID(),
  organizerId: 'user-1',
  title: 'iPhone 16 Pro Sorteo',
  prizeDescription: 'Gana un iPhone 16 Pro Max',
  prizeImage: null,
  ticketPrice: 50,
  totalTickets: 100,
  domain: 'iphone-16-pro',
  status: 'active',
  createdAt: new Date('2024-01-01'),
  tickets: [],
  orders: [],
  _count: { tickets: 100 },
  ...overrides,
});

export const makeTicket = (overrides: Record<string, any> = {}) => ({
  id: randomUUID(),
  raffleId: 'raffle-1',
  number: '001',
  status: 'available',
  reservedUntil: null,
  buyerId: null,
  ...overrides,
});

export const makeOrder = (overrides: Record<string, any> = {}) => ({
  id: randomUUID(),
  raffleId: 'raffle-1',
  ticketIds: JSON.stringify(['ticket-1', 'ticket-2']),
  buyerName: 'Juan Pérez',
  buyerPhone: '5512345678',
  buyerCity: 'Ciudad de México',
  receiptImage: null,
  status: 'pending',
  createdAt: new Date('2024-01-01'),
  ...overrides,
});
