const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const brand = await prisma.brand.upsert({
    where: { slug: 'railrolls' },
    update: {
      name: 'Railrolls',
      webhookSecret: process.env.RAILROLLS_WEBHOOK_SECRET || 'railrolls_pos_secret_2026'
    },
    create: {
      slug: 'railrolls',
      name: 'Railrolls',
      webhookSecret: process.env.RAILROLLS_WEBHOOK_SECRET || 'railrolls_pos_secret_2026',
      apiKey: 'gf_live_railrolls_key_9812'
    }
  });

  console.log('Successfully seeded brand:', brand);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
