const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const sampleBills = [
  // 5 Bills with phone 7025707936 (+917025707936)
  {
    orderID: '15240',
    customer_invoice_id: 'EKM-15240',
    customer: { name: 'Karunanidhan', phone: '+917025707936' },
    restaurant: { restID: '79otw8dke4', res_name: 'Rail Rolls Ernakulam (KSRTC)', address: 'Ernakulam', contact_information: '8129505544' },
    items: [
      { name: 'Cheesy Egg Wrap', price: 89, quantity: 1, category_name: 'Breakfast Menu' },
      { name: 'Mexican Tender Wrap.', price: 259, quantity: 1, category_name: 'Wraps' }
    ],
    order_from: 'Swiggy',
    order_type: 'Delivery',
    total: 303.00
  },
  {
    orderID: '15241',
    customer_invoice_id: 'EKM-15241',
    customer: { name: 'Karunanidhan', phone: '+917025707936' },
    restaurant: { restID: '79otw8dke4', res_name: 'Rail Rolls Ernakulam (KSRTC)', address: 'Ernakulam', contact_information: '8129505544' },
    items: [
      { name: 'Fiery Chicken Roll', price: 179, quantity: 2, category_name: 'Rolls' },
      { name: 'Cold Coffee Frappe', price: 99, quantity: 1, category_name: 'Beverages' }
    ],
    order_from: 'Zomato',
    order_type: 'Delivery',
    total: 457.00
  },
  {
    orderID: '15242',
    customer_invoice_id: 'EKM-15242',
    customer: { name: 'Karunanidhan', phone: '+917025707936' },
    restaurant: { restID: '79otw8dke4', res_name: 'Rail Rolls Ernakulam (KSRTC)', address: 'Ernakulam', contact_information: '8129505544' },
    items: [
      { name: 'Butter Chicken Kathi Roll', price: 229, quantity: 1, category_name: 'Rolls' },
      { name: 'Peri Peri Fries', price: 89, quantity: 1, category_name: 'Sides' }
    ],
    order_from: 'Dine-In POS',
    order_type: 'Dine-In',
    total: 318.00
  },
  {
    orderID: '15243',
    customer_invoice_id: 'EKM-15243',
    customer: { name: 'Karunanidhan', phone: '+917025707936' },
    restaurant: { restID: '79otw8dke4', res_name: 'Rail Rolls Ernakulam (KSRTC)', address: 'Ernakulam', contact_information: '8129505544' },
    items: [
      { name: 'Paneer Tikka Roll', price: 169, quantity: 1, category_name: 'Veg Rolls' }
    ],
    order_from: 'Takeaway POS',
    order_type: 'Takeaway',
    total: 169.00
  },
  {
    orderID: '15244',
    customer_invoice_id: 'EKM-15244',
    customer: { name: 'Karunanidhan', phone: '+917025707936' },
    restaurant: { restID: '79otw8dke4', res_name: 'Rail Rolls Ernakulam (KSRTC)', address: 'Ernakulam', contact_information: '8129505544' },
    items: [
      { name: 'Double Egg Shawarma Roll', price: 149, quantity: 2, category_name: 'Rolls' },
      { name: 'Mint Mojito', price: 79, quantity: 2, category_name: 'Beverages' }
    ],
    order_from: 'Dine-In POS',
    order_type: 'Dine-In',
    total: 456.00
  },

  // 5 Bills WITHOUT phone (Walk-in / anonymous / Swiggy no-phone)
  {
    orderID: '15245',
    customer_invoice_id: 'EKM-15245',
    customer: { name: 'Walk-in Guest', phone: '' },
    restaurant: { restID: '79otw8dke4', res_name: 'Rail Rolls Ernakulam (KSRTC)', address: 'Ernakulam', contact_information: '8129505544' },
    items: [
      { name: 'Crispy Veg Roll', price: 129, quantity: 1, category_name: 'Veg Rolls' },
      { name: 'Lime Juice', price: 40, quantity: 1, category_name: 'Beverages' }
    ],
    order_from: 'Counter POS',
    order_type: 'Dine-In',
    total: 169.00
  },
  {
    orderID: '15246',
    customer_invoice_id: 'EKM-15246',
    customer: { name: 'Express Counter', phone: '' },
    restaurant: { restID: '79otw8dke4', res_name: 'Rail Rolls Ernakulam (KSRTC)', address: 'Ernakulam', contact_information: '8129505544' },
    items: [
      { name: 'Mutton Seekh Roll', price: 289, quantity: 1, category_name: 'Rolls' },
      { name: 'Coke 300ml', price: 40, quantity: 1, category_name: 'Beverages' }
    ],
    order_from: 'Counter POS',
    order_type: 'Takeaway',
    total: 329.00
  },
  {
    orderID: '15247',
    customer_invoice_id: 'EKM-15247',
    customer: { name: 'Swiggy Customer', phone: '' },
    restaurant: { restID: '79otw8dke4', res_name: 'Rail Rolls Ernakulam (KSRTC)', address: 'Ernakulam', contact_information: '8129505544' },
    items: [
      { name: 'Cheesy Chicken Loaded Roll', price: 249, quantity: 2, category_name: 'Speciality' }
    ],
    order_from: 'Swiggy',
    order_type: 'Delivery',
    total: 498.00
  },
  {
    orderID: '15248',
    customer_invoice_id: 'EKM-15248',
    customer: { name: 'Platform Dine-in', phone: '' },
    restaurant: { restID: '79otw8dke4', res_name: 'Rail Rolls Ernakulam (KSRTC)', address: 'Ernakulam', contact_information: '8129505544' },
    items: [
      { name: 'Classic Chicken Roll', price: 149, quantity: 3, category_name: 'Rolls' }
    ],
    order_from: 'Counter POS',
    order_type: 'Dine-In',
    total: 447.00
  },
  {
    orderID: '15249',
    customer_invoice_id: 'EKM-15249',
    customer: { name: 'Train Passenger', phone: '' },
    restaurant: { restID: '79otw8dke4', res_name: 'Rail Rolls Ernakulam (KSRTC)', address: 'Ernakulam', contact_information: '8129505544' },
    items: [
      { name: 'BBQ Chicken Roll', price: 199, quantity: 1, category_name: 'Rolls' },
      { name: 'Veg Spring Roll', price: 119, quantity: 1, category_name: 'Starters' },
      { name: 'Iced Lemon Tea', price: 69, quantity: 1, category_name: 'Beverages' }
    ],
    order_from: 'Counter POS',
    order_type: 'Takeaway',
    total: 387.00
  }
];

async function seedInvoices() {
  const brand = await prisma.brand.findUnique({
    where: { slug: 'railrolls' }
  });

  if (!brand) {
    console.error('RailRolls brand not found!');
    process.exit(1);
  }

  console.log(`Seeding 10 POS bills for brand: ${brand.name} (${brand.slug}, ID: ${brand.id})...`);

  const createdInvoices = [];

  for (const b of sampleBills) {
    const rawPhone = b.customer.phone || null;
    const cleanPhone = rawPhone ? String(rawPhone).replace(/\D/g, '').slice(-10) : null;
    const itemsCount = b.items.reduce((acc, item) => acc + item.quantity, 0);
    const maxPlaysAllowed = itemsCount * 3;

    const payloadObj = {
      Customer: {
        name: b.customer.name,
        phone: b.customer.phone,
        address: '',
        gstin: ''
      },
      Order: {
        orderID: b.orderID,
        customer_invoice_id: b.customer_invoice_id,
        order_from: b.order_from,
        order_type: b.order_type,
        status: 'Success',
        total: b.total,
        created_on: new Date().toISOString()
      },
      Restaurant: b.restaurant,
      OrderItem: b.items.map((it, idx) => ({
        itemid: 1307200000 + idx,
        name: it.name,
        category_name: it.category_name,
        price: it.price,
        quantity: it.quantity,
        total: it.price * it.quantity
      }))
    };

    const invoice = await prisma.invoice.upsert({
      where: {
        brandId_invoiceNumber: {
          brandId: brand.id,
          invoiceNumber: b.orderID
        }
      },
      update: {
        outletCode: b.restaurant.restID,
        customerPhone: cleanPhone,
        itemsCount: itemsCount,
        maxPlaysAllowed: maxPlaysAllowed,
        amount: b.total,
        rawPayload: payloadObj,
        status: 'UNCLAIMED'
      },
      create: {
        brandId: brand.id,
        outletCode: b.restaurant.restID,
        invoiceNumber: b.orderID,
        customerPhone: cleanPhone,
        itemsCount: itemsCount,
        maxPlaysAllowed: maxPlaysAllowed,
        amount: b.total,
        status: 'UNCLAIMED',
        rawPayload: payloadObj
      }
    });

    createdInvoices.push({
      orderID: invoice.invoiceNumber,
      invoiceCode: b.customer_invoice_id,
      customerPhone: invoice.customerPhone || '(None / Walk-in)',
      customerName: b.customer.name,
      itemsCount: invoice.itemsCount,
      playsCredited: invoice.maxPlaysAllowed,
      amount: `₹${invoice.amount}`,
      orderType: b.order_type,
      status: invoice.status
    });
  }

  console.table(createdInvoices);
  console.log(`Successfully seeded ${createdInvoices.length} invoices!`);
}

seedInvoices()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });

