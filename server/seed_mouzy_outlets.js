const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const outletsData = [
  { id: 'in-ka-madiwala', name: 'Mouzy Madiwala Bangalore', place: 'Madiwala', countryCode: '+91', status: 'active' },
  { id: 'in-ka-mangalore', name: 'Mouzy Mangalore', place: 'Mangalore', countryCode: '+91', status: 'active' },
  { id: 'in-ke-chemmad', name: 'Mouzy Hilite Chemmad', place: 'Chemmad', countryCode: '+91', status: 'active' },
  { id: 'in-ke-cheru', name: 'Cheruthuruthi', place: 'Cheruthuruthi', countryCode: '+91', status: 'active' },
  { id: 'in-ke-dreams', name: 'Dreams Mall Kollam', place: 'Kollam', countryCode: '+91', status: 'active' },
  { id: 'in-ke-edapalli', name: 'Edapalli', place: 'Edapalli', countryCode: '+91', status: 'active' },
  { id: 'in-ke-forum', name: 'Forum centre Edappal', place: 'Edappal', countryCode: '+91', status: 'active' },
  { id: 'in-ke-hilite-c', name: 'Hilite Mall Calicut', place: 'Calicut', countryCode: '+91', status: 'active' },
  { id: 'in-ke-hilite-t', name: 'Mouzy Hilite Thrissur', place: 'Thrissur', countryCode: '+91', status: 'active' },
  { id: 'in-ke-k-mall', name: 'Mouzy K Mall', place: 'Kakkattil', countryCode: '+91', status: 'active' },
  { id: 'in-ke-kanhangad', name: 'Mouzy Kanhangad', place: 'Kanhangad', countryCode: '+91', status: 'active' },
  { id: 'in-ke-kottakkal', name: 'Mouzy Kottakkal', place: 'Kottakkal', countryCode: '+91', status: 'active' },
  { id: 'in-ke-lulu-kochi', name: 'Mouzy Lulu Kochi', place: 'Kochi', countryCode: '+91', status: 'active' },
  { id: 'in-ke-lulu-pkd', name: 'Mouzy Lulu Palakkad', place: 'Palakkad', countryCode: '+91', status: 'active' },
  { id: 'in-ke-lulu-tvm', name: 'Mouzy Lulu Trivandrum', place: 'Trivandrum', countryCode: '+91', status: 'active' },
  { id: 'in-ke-malappuram', name: 'Mouzy Malappuram', place: 'Malappuram', countryCode: '+91', status: 'active' },
  { id: 'in-ke-manantha', name: 'Mouzy Mananthavadi', place: 'Mananthavadi', countryCode: '+91', status: 'active' },
  { id: 'in-ke-manjeri', name: 'Mouzy Manjeri', place: 'Manjeri', countryCode: '+91', status: 'active' },
  { id: 'in-ke-mannarkad', name: 'Mouzy Mannarkkad', place: 'Mannarkkad', countryCode: '+91', status: 'active' },
  { id: 'in-ke-market', name: 'Mouzy Market City Mall', place: 'Perinthalmanna', countryCode: '+91', status: 'active' },
  { id: 'in-ke-melattur', name: 'Mouzy Melattur', place: 'Melattur', countryCode: '+91', status: 'active' },
  { id: 'in-ke-muvattupuzha', name: 'Mouzy Muvattupuzha', place: 'Muvattupuzha', countryCode: '+91', status: 'active' },
  { id: 'in-ke-nadapuram', name: 'Mouzy Nadapuram', place: 'Nadapuram', countryCode: '+91', status: 'active' },
  { id: 'in-ke-nilambur', name: 'Mouzy Nilambur', place: 'Nilambur', countryCode: '+91', status: 'active' },
  { id: 'in-ke-ottapalam', name: 'Mouzy Ottapalam', place: 'Ottapalam', countryCode: '+91', status: 'active' },
  { id: 'in-ke-parappa', name: 'Mouzy Parappanangadi', place: 'Parappanangadi', countryCode: '+91', status: 'active' },
  { id: 'in-ke-pattambi', name: 'Mouzy Pattambi', place: 'Pattambi', countryCode: '+91', status: 'active' },
  { id: 'in-ke-payyambalam', name: 'Mouzy Payyambalam', place: 'Payyambalam', countryCode: '+91', status: 'active' },
  { id: 'in-ke-perintha', name: 'Mouzy Perinthalmanna', place: 'Perinthalmanna', countryCode: '+91', status: 'active' },
  { id: 'in-ke-pkd-town', name: 'Mouzy Palakkad', place: 'Palakkad town', countryCode: '+91', status: 'active' },
  { id: 'in-ke-thrissur', name: 'Mouzy Thrissur', place: 'Thrissur', countryCode: '+91', status: 'active' },
  { id: 'in-ke-tirur', name: 'Mouzy Tirur', place: 'Tirur', countryCode: '+91', status: 'active' },
  { id: 'in-ke-valanchery', name: 'Mouzy Valanchery', place: 'Valanchery', countryCode: '+91', status: 'active' },
  { id: 'in-ke-vengara', name: 'Mouzy Vengara', place: 'Vengara', countryCode: '+91', status: 'active' },
  { id: 'in-ke-wandoor', name: 'Mouzy Wandoor', place: 'Wandoor', countryCode: '+91', status: 'active' },
  { id: 'in-ke-y-mall', name: 'Mouzy Y Mall', place: 'Triprayar', countryCode: '+91', status: 'active' },
  { id: 'in-tn-madurai', name: 'Mouzy Madurai', place: 'Madurai', countryCode: '+91', status: 'active' },
  { id: 'in-tn-podanur', name: 'Mouzy Coimbatore Podanur', place: 'Podanur', countryCode: '+91', status: 'active' },
  { id: 'in-tn-ukkadam', name: 'Mouzy Ukkadam', place: 'Coimbatore', countryCode: '+91', status: 'active' },
  { id: 'qa-matar', name: 'Matar Qadeem - Doha', place: 'Doha', countryCode: '+974', status: 'active' },
  { id: 'qa-safari', name: 'Mouzy Safari Mall Qatar', place: 'Safari Mall, Doha, Qtar', countryCode: '+974', status: 'active' },
  { id: 'sa-murabba', name: 'Murabba Lulu Mall - Riyadh', place: 'Riyadh', countryCode: '+966', status: 'active' },
  { id: 'sa-sharafiya', name: 'Sharafiya - Jeddah', place: 'Jeddah', countryCode: '+966', status: 'active' },
  { id: 'uae-ajman', name: 'Ajman', place: 'Ajman', countryCode: '+971', status: 'active' },
  { id: 'uae-dip2', name: 'DIP 2 - Dubai', place: 'DIP', countryCode: '+971', status: 'active' },
  { id: 'uae-karama', name: 'Al Karama - Dubai', place: 'Al Karama', countryCode: '+971', status: 'active' },
  { id: 'uae-muwaileh', name: 'Muwaileh - Sharjah', place: 'Muwaileh', countryCode: '+971', status: 'active' },
  { id: 'uae-nahda', name: 'Al Nahda - Sharjah', place: 'Al Nahda', countryCode: '+971', status: 'active' },
  { id: 'uae-qusais', name: 'Al Qusais - Dubai', place: 'Al Qusais', countryCode: '+971', status: 'active' },
  { id: 'uae-shabiya', name: 'Mouzy UAE Shabiya 10', place: 'Shabiya 10', countryCode: '+971', status: 'active' }
];

function hashAdminPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  console.log('--- 1. Ensuring ZuzyRun / Mouzy Brand Exists ---');
  let brand = await prisma.brand.findFirst({
    where: {
      OR: [
        { slug: 'zuzyrun' },
        { slug: 'mouzy' },
        { slug: 'mouzy-runner' }
      ]
    }
  });

  if (!brand) {
    brand = await prisma.brand.create({
      data: {
        slug: 'zuzyrun',
        name: 'Zuzy Run',
        gameName: 'Mouzy Runner',
        apiKey: `gf_live_zuzyrun_${crypto.randomBytes(12).toString('hex')}`
      }
    });
    console.log('Created Brand:', brand.name, `(${brand.slug}) ID:`, brand.id);
  } else {
    console.log('Found existing Brand:', brand.name, `(${brand.slug}) ID:`, brand.id);
  }

  console.log('\n--- 2. Upserting 50 Outlets ---');
  for (const o of outletsData) {
    await prisma.outlet.upsert({
      where: { id: o.id },
      update: {
        name: o.name,
        place: o.place,
        countryCode: o.countryCode,
        status: o.status,
        brandId: brand.id
      },
      create: {
        id: o.id,
        name: o.name,
        place: o.place,
        countryCode: o.countryCode,
        status: o.status,
        brandId: brand.id
      }
    });
  }
  const outletCount = await prisma.outlet.count({ where: { status: 'active' } });
  console.log(`Successfully upserted ${outletCount} active outlets.`);

  console.log('\n--- 3. Provisioning Outlet Admin Accounts (Password: mouzy@123) ---');
  const defaultPasswordHash = hashAdminPassword('mouzy@123');

  let adminCreatedCount = 0;
  for (const o of outletsData) {
    const adminUsername = o.id; // e.g., 'in-ke-parappa'
    const adminEmail = `${o.id}@mouzy.gamefaktory.com`;
    const adminName = `${o.name} Manager`;

    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        name: adminName,
        username: adminUsername,
        password: defaultPasswordHash,
        role: 'OUTLET_ADMIN',
        brandId: brand.id,
        outletId: o.id
      },
      create: {
        email: adminEmail,
        username: adminUsername,
        name: adminName,
        password: defaultPasswordHash,
        role: 'OUTLET_ADMIN',
        brandId: brand.id,
        outletId: o.id
      }
    });
    adminCreatedCount++;
  }
  console.log(`Successfully provisioned/verified ${adminCreatedCount} outlet manager accounts with password: mouzy@123`);
}

main()
  .catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

