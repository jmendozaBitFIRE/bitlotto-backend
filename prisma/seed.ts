import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

async function main() {
  const saltRounds = 12;

  // Seed superadmin
  const adminHash = await bcrypt.hash('admin', saltRounds);
  await prisma.user.upsert({
    where: { email: 'admin@rifas.com' },
    update: { passwordHash: adminHash },
    create: { email: 'admin@rifas.com', passwordHash: adminHash, role: 'SUPERADMIN' },
  });

  // Seed client with a raffle_count package
  const client = await prisma.client.upsert({
    where: { email: 'juan-org@rifas.com' },
    update: {},
    create: {
      name: 'Juan Organización',
      email: 'juan-org@rifas.com',
      status: 'active',
      packages: {
        create: { type: 'raffle_count', value: '10', active: true },
      },
    },
  });

  // Seed organizador linked to that client
  const juanHash = await bcrypt.hash('juan', saltRounds);
  await prisma.user.upsert({
    where: { email: 'juan@rifas.com' },
    update: { passwordHash: juanHash, clientId: client.id },
    create: {
      email: 'juan@rifas.com',
      passwordHash: juanHash,
      role: 'ORGANIZADOR',
      clientId: client.id,
    },
  });

  console.log('✓ Seed complete');
  console.log('  admin@rifas.com / admin  → SUPERADMIN');
  console.log('  juan@rifas.com  / juan   → ORGANIZADOR (10 rifas/mes)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
