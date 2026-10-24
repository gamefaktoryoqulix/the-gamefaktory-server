const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Seed Railrolls brand
  const railrollsBrand = await prisma.brand.upsert({
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
  console.log('Successfully seeded brand:', railrollsBrand.slug);

  // 2. Seed Popular Electricals brand (Targeting newly registered brand slug if present)
  let popularBrand = await prisma.brand.findUnique({
    where: { slug: 'popular-electricals-qatar' }
  });

  if (!popularBrand) {
    popularBrand = await prisma.brand.upsert({
      where: { slug: 'popular' },
      update: {
        name: 'Popular Electricals & Trading Co. W.L.L',
        apiKey: 'pet_live_popular_sparky_2026',
        webhookSecret: 'pet_whsec_sparky_run_secret',
      },
      create: {
        slug: 'popular',
        name: 'Popular Electricals & Trading Co. W.L.L',
        apiKey: 'pet_live_popular_sparky_2026',
        webhookSecret: 'pet_whsec_sparky_run_secret',
      },
    });
  }


  const testTokens = [
    '122ERF',
    'PET-9XK2-MP8A',
    'PET-BARWA-01',
    'PET-NAJMA-02',
    'PET-VIP-2026',
    'PET-DEMO-VIP3'
  ];

  for (const code of testTokens) {
    await prisma.qrToken.upsert({
      where: { code },
      update: {
        brandId: popularBrand.id,
        livesRemaining: 3,
        status: 'ACTIVE',
      },
      create: {
        code,
        brandId: popularBrand.id,
        gameSlug: 'sparky-run',
        initialLives: 3,
        livesRemaining: 3,
        status: 'ACTIVE',
      },
    });
  }

  // Link existing players (Rashid, Hamad Al-Thani, Hussain) to popular brand
  const sparkyPlayers = [
    { name: 'Rashid', phone: '7455123456', email: 'rashid3456@gamefaktory.com' },
    { name: 'Hamad Al-Thani', phone: '55889900', email: 'hamadalthani9900@gamefaktory.com' },
    { name: 'Hussain', phone: '70257079', email: 'hussain7079@gamefaktory.com' },
  ];

  for (const p of sparkyPlayers) {
    const user = await prisma.user.upsert({
      where: { phone: p.phone },
      update: { name: p.name },
      create: {
        name: p.name,
        phone: p.phone,
        email: p.email,
        role: 'PLAYER'
      }
    });

    await prisma.gameplayCredit.upsert({
      where: { id: `seed-credit-${user.id}` },
      update: {},
      create: {
        id: `seed-credit-${user.id}`,
        userId: user.id,
        brandId: popularBrand.id,
        totalGranted: 3,
        playsRemaining: 3,
        sourceType: 'REGISTER'
      }
    });
  }

  console.log('✅ Popular Electricals brand, test tokens, & players seeded successfully!');
}


main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

