const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const raffles = await prisma.raffle.findMany({
    select: { id: true, domain: true, title: true }
  });
  console.log(JSON.stringify(raffles, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
