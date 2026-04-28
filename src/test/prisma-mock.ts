const modelMethods = () => ({
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  upsert: jest.fn(),
  createMany: jest.fn(),
});

export function createPrismaMock() {
  const mock = {
    user: modelMethods(),
    raffle: modelMethods(),
    ticket: modelMethods(),
    ticketOrder: modelMethods(),
    client: modelMethods(),
    package: modelMethods(),
    $transaction: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  // Default implementation: callback form passes mock as tx; array form resolves immediately
  mock.$transaction.mockImplementation((input: any) => {
    if (typeof input === 'function') {
      return input(mock);
    }
    return Promise.resolve(input.map(() => undefined));
  });

  return mock;
}

export type PrismaMock = ReturnType<typeof createPrismaMock>;
