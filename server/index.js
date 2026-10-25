require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { auth } = require('./auth');

const app = express();

// Middleware: CORS supporting Localhost, Cloud Domains, and Game Clients
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests or any localhost/127.0.0.1 port
    if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    // Allow any .gamefaktory.com subdomain (sparkyrun.gamefaktory.com, api.gamefaktory.com, etc.)
    if (/^https?:\/\/([a-zA-Z0-9-]+\.)*gamefaktory\.com$/.test(origin)) {
      return callback(null, true);
    }
    // Allow sslip.io Coolify internal domains
    if (/^https?:\/\/.*\.sslip\.io$/.test(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive in current game rollout phase
  },
  credentials: true // Better Auth requires this to securely send session cookies
})); 
app.use(express.json()); 

// Mount Better Auth Routes
app.all(/^\/api\/auth(\/.*)?$/, (req, res, next) => {
  return auth.handler(req, res);
});

const { prisma } = require('./auth');

// ----------------------------------------------------
// RAILROLLS POS INGESTION LOGIC (Replaces Firestore)
// ----------------------------------------------------

async function processRailrollsBill(payload) {
  try {
    const properties = payload.properties || {};
    const restaurant = properties.Restaurant || {};
    const order = properties.Order || {};
    const customer = properties.Customer || {};
    
    const restID = restaurant.restID;
    const orderID = order.orderID;
    
    if (!restID || !orderID) {
      console.error('[Railrolls POS] Invalid payload: Missing restID or orderID');
      return;
    }

    // Resolve Railrolls brand ID
    const brand = await prisma.brand.findUnique({
      where: { slug: 'railrolls' }
    });
    if (!brand) {
      console.error('[Railrolls POS] Brand "railrolls" not found in database. Seed brand first.');
      return;
    }

    // Extract customer phone (if present in Customer or Order)
    const rawPhone = customer.phone || customer.mobile || customer.contact || order.customerPhone || null;
    const customerPhone = rawPhone ? String(rawPhone).replace(/\D/g, '').slice(-10) : null;

    // Extract item count (order.items, properties.Items, order.totalItems, etc.)
    let itemsCount = 1;
    if (Array.isArray(order.items)) {
      itemsCount = order.items.reduce((sum, item) => sum + (Number(item.quantity || item.qty) || 1), 0);
    } else if (Array.isArray(properties.Items)) {
      itemsCount = properties.Items.reduce((sum, item) => sum + (Number(item.quantity || item.qty) || 1), 0);
    } else if (order.itemsCount || order.totalItems) {
      itemsCount = parseInt(order.itemsCount || order.totalItems, 10) || 1;
    }
    if (itemsCount < 1) itemsCount = 1;

    // Extract bill amount
    const rawAmount = order.netAmount || order.totalAmount || order.billAmount || order.amount || null;
    const amount = rawAmount ? parseFloat(rawAmount) : null;

    // Rule: 3 gameplays per item purchased
    const maxPlaysAllowed = itemsCount * 3;

    // Upsert into PostgreSQL (preserves CLAIMED status if already claimed)
    const invoice = await prisma.invoice.upsert({
      where: {
        brandId_invoiceNumber: {
          brandId: brand.id,
          invoiceNumber: String(orderID)
        }
      },
      update: {
        outletCode: String(restID),
        customerPhone: customerPhone,
        itemsCount: itemsCount,
        maxPlaysAllowed: maxPlaysAllowed,
        amount: amount,
        rawPayload: properties
      },
      create: {
        brandId: brand.id,
        outletCode: String(restID),
        invoiceNumber: String(orderID),
        customerPhone: customerPhone,
        itemsCount: itemsCount,
        maxPlaysAllowed: maxPlaysAllowed,
        amount: amount,
        status: 'UNCLAIMED',
        rawPayload: properties
      }
    });

    console.log(`[Railrolls POS] Ingested bill #${orderID} for outlet #${restID} (${itemsCount} items -> ${maxPlaysAllowed} plays) into PostgreSQL.`);
    return invoice;
  } catch (error) {
    console.error('[Railrolls POS] Error saving bill to PostgreSQL:', error);
  }
}

// 1. Webhook for RailRolls POS
app.post('/api/webhooks/railrolls/bill', (req, res) => {
  const secret = process.env.RAILROLLS_WEBHOOK_SECRET || 'railrolls_pos_secret_2026';
  const signature = req.headers['x-webhook-secret'];

  if (signature !== secret) {
    return res.status(401).json({ error: 'Unauthorized: Invalid webhook secret' });
  }

  // Fast 2xx response (< 10 seconds requirement for RailRolls POS)
  res.status(200).json({ success: true, message: 'Webhook received' });

  // Process asynchronously without blocking POS response
  if (req.body && req.body.event === 'orderdetails') {
    processRailrollsBill(req.body).catch(err => console.error('[Railrolls Webhook Error]:', err));
  }
});

// Dev helper: List recent ingested invoices
app.get('/api/dev/invoices', async (req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: { brand: { select: { slug: true, name: true } } }
    });
    res.json({ success: true, count: invoices.length, invoices });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Custom Password-less Registration Route (Better Auth User Schema with Brand Scoping)
app.post('/api/register', async (req, res) => {
  try {
    const { phone, name, age, brand: brandInput, brandSlug: brandSlugInput } = req.body;
    if (!phone || !name) {
      return res.status(400).json({ error: "Phone number and name are required." });
    }
    
    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
    const parsedAge = age !== undefined && age !== null && !isNaN(parseInt(age, 10)) ? parseInt(age, 10) : null;
    const targetBrandSlug = (brandSlugInput || brandInput || 'popular').trim().toLowerCase();
    
    // Check if user already exists by phone
    let user = await prisma.user.findUnique({
      where: { phone: cleanPhone }
    });

    if (user) {
      // Update name/age if provided
      user = await prisma.user.update({
        where: { id: user.id },
        data: { 
          name: name.trim(), 
          age: parsedAge !== null ? parsedAge : user.age 
        }
      });
    } else {
      // Generate dummy email behind the scenes for Better Auth compatibility
      const dummyEmail = `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}${cleanPhone.slice(-4)}@gamefaktory.com`;

      user = await prisma.user.create({
        data: {
          phone: cleanPhone,
          name: name.trim(),
          age: parsedAge,
          email: dummyEmail
        }
      });
    }

    // Link user to brand so they are properly brand-isolated
    const brand = await prisma.brand.findUnique({ where: { slug: targetBrandSlug } });
    if (brand) {
      const existingCredit = await prisma.gameplayCredit.findFirst({
        where: { userId: user.id, brandId: brand.id }
      });
      if (!existingCredit) {
        await prisma.gameplayCredit.create({
          data: {
            userId: user.id,
            brandId: brand.id,
            sourceType: 'REGISTER',
            totalGranted: 0,
            playsRemaining: 0,
          }
        });
      }
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('[Register Error]:', error);
    res.status(400).json({ error: error.message || "Registration failed." });
  }
});

// Custom Password-less Login / Phone Check Route
app.post('/api/login', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "Phone number is required." });
    }
    const user = await prisma.user.findUnique({
      where: { phone }
    });
    if (!user) {
      return res.json({ success: true, exists: false, message: "Phone number not registered." });
    }
    res.json({ success: true, exists: true, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "System failure during authentication." });
  }
});

// ----------------------------------------------------
// RAILROLLS GAMEPLAY & BILL CLAIM ENDPOINTS
// ----------------------------------------------------

// 1. Check Player Status, Unclaimed Bills & Credit Balance
app.get('/api/v1/gameplays/status', async (req, res) => {
  try {
    const { phone, brand: brandSlug = 'railrolls' } = req.query;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);

    const brand = await prisma.brand.findUnique({
      where: { slug: brandSlug }
    });
    if (!brand) {
      return res.status(404).json({ error: `Brand "${brandSlug}" not found.` });
    }

    const user = await prisma.user.findUnique({
      where: { phone: cleanPhone }
    });

    // Check unclaimed invoices for this phone number or general store unclaimed
    const unclaimedInvoices = await prisma.invoice.findMany({
      where: {
        brandId: brand.id,
        customerPhone: cleanPhone,
        status: 'UNCLAIMED'
      },
      orderBy: { createdAt: 'desc' }
    });

    let playsRemaining = 0;
    let totalGranted = 0;

    if (user) {
      const creditsRecord = await prisma.gameplayCredit.findFirst({
        where: {
          userId: user.id,
          brandId: brand.id
        },
        orderBy: { updatedAt: 'desc' }
      });
      if (creditsRecord) {
        playsRemaining = creditsRecord.playsRemaining;
        totalGranted = creditsRecord.totalGranted;
      }
    }

    res.json({
      success: true,
      userExists: !!user,
      user: user ? { id: user.id, name: user.name, phone: user.phone, age: user.age } : null,
      playsRemaining,
      totalGranted,
      unclaimedInvoices: unclaimedInvoices.map(inv => ({
        invoiceNumber: inv.invoiceNumber,
        outletCode: inv.outletCode,
        itemsCount: inv.itemsCount,
        maxPlaysAllowed: inv.maxPlaysAllowed,
        amount: inv.amount,
        createdAt: inv.createdAt
      }))
    });
  } catch (error) {
    console.error('[Status Error]:', error);
    res.status(500).json({ error: 'Failed to fetch status.' });
  }
});

// 2. Claim Unclaimed Bill & Mint Exactly 3 Gameplays (Atomic Transaction)
app.post('/api/v1/gameplays/claim', async (req, res) => {
  try {
    const { phone, invoiceNumber, brandSlug = 'railrolls' } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);

    const brand = await prisma.brand.findUnique({
      where: { slug: brandSlug }
    });
    if (!brand) {
      return res.status(404).json({ error: `Brand "${brandSlug}" not found.` });
    }

    const user = await prisma.user.findUnique({
      where: { phone: cleanPhone }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not registered. Please complete registration first.' });
    }

    // Locate the invoice
    let invoice;
    if (invoiceNumber) {
      invoice = await prisma.invoice.findFirst({
        where: {
          brandId: brand.id,
          invoiceNumber: String(invoiceNumber)
        }
      });
    } else {
      invoice = await prisma.invoice.findFirst({
        where: {
          brandId: brand.id,
          customerPhone: cleanPhone,
          status: 'UNCLAIMED'
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (!invoice) {
      return res.status(404).json({ error: 'No invoice found matching the given parameters.' });
    }

    if (invoice.status === 'CLAIMED') {
      return res.status(400).json({
        error: `Invoice #${invoice.invoiceNumber} has already been claimed on ${invoice.claimedAt ? new Date(invoice.claimedAt).toLocaleString() : 'an earlier date'}.`
      });
    }

    if (invoice.status !== 'UNCLAIMED') {
      return res.status(400).json({ error: `Invoice status is ${invoice.status}, cannot be claimed.` });
    }

    // Per requirement: Grant 3 gameplays per claimed bill
    const playsToGrant = 3;

    // Atomic transaction: mark invoice CLAIMED and mint/update credits
    const result = await prisma.$transaction(async (tx) => {
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'CLAIMED',
          claimedByUserId: user.id,
          claimedAt: new Date()
        }
      });

      const existingCredit = await tx.gameplayCredit.findFirst({
        where: {
          userId: user.id,
          brandId: brand.id
        }
      });

      let updatedCredit;
      if (existingCredit) {
        updatedCredit = await tx.gameplayCredit.update({
          where: { id: existingCredit.id },
          data: {
            playsRemaining: existingCredit.playsRemaining + playsToGrant,
            totalGranted: existingCredit.totalGranted + playsToGrant,
            sourceType: 'INVOICE',
            sourceReference: invoice.invoiceNumber
          }
        });
      } else {
        updatedCredit = await tx.gameplayCredit.create({
          data: {
            userId: user.id,
            brandId: brand.id,
            playsRemaining: playsToGrant,
            totalGranted: playsToGrant,
            sourceType: 'INVOICE',
            sourceReference: invoice.invoiceNumber
          }
        });
      }

      return { updatedInvoice, updatedCredit };
    });

    res.json({
      success: true,
      message: `Verified bill #${invoice.invoiceNumber}. ${playsToGrant} gameplays granted!`,
      invoiceNumber: invoice.invoiceNumber,
      playsGranted: playsToGrant,
      playsRemaining: result.updatedCredit.playsRemaining,
      totalGranted: result.updatedCredit.totalGranted,
      claimedAt: result.updatedInvoice.claimedAt
    });
  } catch (error) {
    console.error('[Claim Error]:', error);
    res.status(500).json({ error: error.message || 'Failed to claim invoice.' });
  }
});

// 3. Start Game Session (Anti-Cheat Token & Atomic Credit Decrement)
app.post('/api/v1/games/start', async (req, res) => {
  try {
    const { phone, brandSlug = 'railrolls' } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);

    const brand = await prisma.brand.findUnique({
      where: { slug: brandSlug }
    });
    if (!brand) {
      return res.status(404).json({ error: `Brand "${brandSlug}" not found.` });
    }

    const user = await prisma.user.findUnique({
      where: { phone: cleanPhone }
    });
    if (!user) {
      return res.status(404).json({ error: 'User not registered.' });
    }

    // Atomic transaction: verify balance, decrement by 1, mint single-use session token
    const result = await prisma.$transaction(async (tx) => {
      const credit = await tx.gameplayCredit.findFirst({
        where: {
          userId: user.id,
          brandId: brand.id
        }
      });

      if (!credit || credit.playsRemaining <= 0) {
        throw new Error('NO_CREDITS');
      }

      const updatedCredit = await tx.gameplayCredit.update({
        where: { id: credit.id },
        data: {
          playsRemaining: credit.playsRemaining - 1
        }
      });

      const sessionToken = `gf_sess_${crypto.randomBytes(16).toString('hex')}`;

      const session = await tx.gameSession.create({
        data: {
          userId: user.id,
          brandId: brand.id,
          sessionToken: sessionToken,
          isCompleted: false,
          startedAt: new Date()
        }
      });

      return { session, playsRemaining: updatedCredit.playsRemaining };
    });

    res.json({
      success: true,
      message: 'Game session initialized. 1 credit consumed.',
      sessionToken: result.session.sessionToken,
      sessionId: result.session.id,
      playsRemaining: result.playsRemaining,
      startedAt: result.session.startedAt
    });
  } catch (error) {
    if (error.message === 'NO_CREDITS') {
      return res.status(403).json({ error: 'No gameplays remaining! Verify another bill to play.' });
    }
    console.error('[Game Start Error]:', error);
    res.status(500).json({ error: 'Failed to initialize game session.' });
  }
});

// 4. Complete Game Session (Submit Score with Anti-Cheat Validation)
app.post('/api/v1/games/finish', async (req, res) => {
  try {
    const { sessionToken, score = 100 } = req.body;
    if (!sessionToken) {
      return res.status(400).json({ error: 'Session token is required.' });
    }

    const session = await prisma.gameSession.findUnique({
      where: { sessionToken }
    });

    if (!session) {
      return res.status(404).json({ error: 'Invalid or expired game session token.' });
    }

    if (session.isCompleted) {
      return res.status(400).json({ error: 'Session has already been submitted and completed.' });
    }

    const now = new Date();
    const durationSeconds = Math.max(1, Math.round((now - new Date(session.startedAt)) / 1000));
    const finalScore = Math.min(Math.max(0, parseInt(score, 10) || 0), 10000);

    const completedSession = await prisma.gameSession.update({
      where: { id: session.id },
      data: {
        score: finalScore,
        duration: durationSeconds,
        isCompleted: true,
        completedAt: now
      }
    });

    res.json({
      success: true,
      message: 'Game session completed successfully.',
      session: {
        id: completedSession.id,
        score: completedSession.score,
        duration: completedSession.duration,
        completedAt: completedSession.completedAt
      }
    });
  } catch (error) {
    console.error('[Game Finish Error]:', error);
    res.status(500).json({ error: 'Failed to complete game session.' });
  }
});

// 5. Dev Helper: Reset Railrolls demo state (re-unclaims bill ORD_98214)
app.post('/api/dev/reset-demo', async (req, res) => {
  try {
    const brand = await prisma.brand.findUnique({ where: { slug: 'railrolls' } });
    if (!brand) return res.status(404).json({ error: 'Brand not found' });

    await prisma.invoice.updateMany({
      where: { brandId: brand.id, invoiceNumber: 'ORD_98214' },
      data: { status: 'UNCLAIMED', claimedByUserId: null, claimedAt: null }
    });

    await prisma.gameplayCredit.deleteMany({
      where: { brandId: brand.id }
    });

    await prisma.gameSession.deleteMany({
      where: { brandId: brand.id }
    });

    res.json({
      success: true,
      message: 'Railrolls demo reset: Bill #ORD_98214 marked UNCLAIMED. Credits and sessions cleared.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// POPULAR ELECTRICALS - QR TOKEN ENDPOINTS (SPARKY RUN)
// ----------------------------------------------------

// Multi-tenant Brand Resolution Helper: Resolves brand & handles aliases (e.g., 'popular' <-> 'popular-electricals-qatar')
async function resolveBrandAndAliases(slugInput) {
  const cleanSlug = (slugInput || 'popular').trim().toLowerCase();
  
  // If querying popular or popular-electricals-qatar, gather both
  if (cleanSlug === 'popular' || cleanSlug === 'popular-electricals-qatar') {
    const brands = await prisma.brand.findMany({
      where: {
        slug: { in: ['popular', 'popular-electricals-qatar'] }
      }
    });
    if (brands.length === 0) return null;
    
    // Primary is exact match if found, else first available
    const primary = brands.find(b => b.slug === cleanSlug) || brands[0];
    const brandIds = brands.map(b => b.id);
    const brandSlugs = brands.map(b => b.slug);
    
    return {
      primary,
      brandIds,
      brandSlugs,
      matchesBrandId: (id) => brandIds.includes(id),
      matchesBrandSlug: (slug) => brandSlugs.includes(slug)
    };
  }

  // Standard brand resolution
  const brand = await prisma.brand.findUnique({ where: { slug: cleanSlug } });
  if (!brand) return null;

  return {
    primary: brand,
    brandIds: [brand.id],
    brandSlugs: [brand.slug],
    matchesBrandId: (id) => id === brand.id,
    matchesBrandSlug: (slug) => slug === brand.slug
  };
}


// 1. Verify Token (Brand-Isolated)
app.get(['/api/v1/tokens/verify', '/api/token/verify'], async (req, res) => {
  try {
    const tokenCode = (req.query.token || '').trim().toUpperCase();
    const brandSlug = (req.query.brand || 'popular').trim().toLowerCase();

    if (!tokenCode) {
      return res.status(400).json({ valid: false, error: 'Token parameter is required' });
    }

    const token = await prisma.qrToken.findUnique({
      where: { code: tokenCode },
      include: { brand: true, user: true },
    });

    if (!token) {
      return res.status(404).json({
        valid: false,
        status: 'INVALID',
        livesRemaining: 0,
        error: 'QR Token not recognized in database',
      });
    }

    const brandRes = await resolveBrandAndAliases(brandSlug);
    if (!brandRes) {
      return res.status(404).json({ valid: false, error: `Brand '${brandSlug}' not found`, livesRemaining: 0 });
    }

    // Strict multi-tenant brand isolation check (allowing aliased brand IDs)
    if (!brandRes.matchesBrandId(token.brandId)) {
      return res.status(403).json({
        valid: false,
        status: 'FORBIDDEN',
        livesRemaining: 0,
        error: `This token does not belong to ${brandSlug}`,
      });
    }

    return res.json({
      valid: token.status === 'ACTIVE' && token.livesRemaining > 0,
      token: token.code,
      brand: token.brand.slug,
      game: token.gameSlug,
      livesRemaining: token.livesRemaining,
      initialLives: token.initialLives,
      status: token.status,
      boundUserId: token.userId,
      boundUserName: token.user?.name || null,
    });
  } catch (error) {
    console.error('Verify token error:', error);
    return res.status(500).json({ valid: false, error: 'Internal server error' });
  }
});

// 2. Batch Create Tokens (Brand-Scoped)
app.post(['/api/v1/tokens/batch-create', '/api/brands/:brandSlug/tokens/batch-create'], async (req, res) => {
  try {
    const brandSlug = (req.params.brandSlug || req.body.brandSlug || 'popular').trim().toLowerCase();
    const gameSlug = (req.body.gameSlug || 'sparky-run').trim().toLowerCase();
    const count = Math.min(Math.max(1, parseInt(req.body.count, 10) || 36), 500);
    const prefix = (req.body.prefix || 'PET').trim().toUpperCase();
    const initialLives = parseInt(req.body.initialLives, 10) || 3;

    const brand = await prisma.brand.findUnique({ where: { slug: brandSlug } });
    if (!brand) {
      return res.status(404).json({ error: `Brand '${brandSlug}' not found` });
    }

    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // exclude ambiguous 0,O,1,I
    const generatedCodes = [];
    const records = [];

    for (let i = 0; i < count; i++) {
      let p1 = '', p2 = '';
      for (let j = 0; j < 4; j++) p1 += chars[Math.floor(Math.random() * chars.length)];
      for (let j = 0; j < 4; j++) p2 += chars[Math.floor(Math.random() * chars.length)];
      const code = `${prefix}-${p1}-${p2}`;
      generatedCodes.push(code);
      records.push({
        code,
        brandId: brand.id,
        gameSlug,
        initialLives,
        livesRemaining: initialLives,
        status: 'ACTIVE',
      });
    }

    await prisma.qrToken.createMany({
      data: records,
      skipDuplicates: true,
    });

    return res.json({
      success: true,
      brand: brand.slug,
      game: gameSlug,
      count: generatedCodes.length,
      tokens: generatedCodes,
      exampleUrl: `https://sparkyrun.gamefaktory.com/?token=${generatedCodes[0]}`,
    });
  } catch (error) {
    console.error('Batch create error:', error);
    return res.status(500).json({ error: 'Failed to create tokens' });
  }
});

// 2b. List All Tokens for a Brand (with Attached User & Lives Left)
app.get(['/api/brands/:brandSlug/tokens', '/api/tokens'], async (req, res) => {
  try {
    const brandSlug = (req.params.brandSlug || req.query.brand || req.query.brandSlug || 'popular').trim().toLowerCase();
    const brandRes = await resolveBrandAndAliases(brandSlug);
    if (!brandRes) return res.status(404).json({ error: `Brand '${brandSlug}' not found` });

    const tokens = await prisma.qrToken.findMany({
      where: {
        brandId: { in: brandRes.brandIds }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({
      success: true,
      brand: brandRes.primary.slug,
      count: tokens.length,
      tokens: tokens.map((t) => ({
        id: t.id,
        code: t.code,
        gameSlug: t.gameSlug,
        initialLives: t.initialLives,
        livesRemaining: t.livesRemaining,
        status: t.status,
        claimedAt: t.claimedAt,
        lastPlayedAt: t.lastPlayedAt,
        createdAt: t.createdAt,
        user: t.user ? {
          id: t.user.id,
          name: t.user.name || 'Sparky Runner',
          phone: t.user.phone ? (t.user.phone.startsWith('+') ? t.user.phone : `+974 ${t.user.phone}`) : 'N/A',
          email: t.user.email
        } : null
      }))
    });
  } catch (error) {
    console.error('Fetch brand tokens error:', error);
    return res.status(500).json({ error: 'Failed to fetch tokens' });
  }
});

// ----------------------------------------------------
// BRAND-ISOLATED GAMEPLAY SESSIONS & SCORES
// ----------------------------------------------------

// Helper to resolve or provision a player for brand session linkage
async function resolveSessionUser(userId, phone, brandId, playerName) {
  const displayName = playerName && playerName.trim() ? playerName.trim() : 'Sparky Runner';

  if (userId) {
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (existing) {
      // If existing user has the fallback name and a real name is now provided, update it:
      if (existing.name === 'Sparky Runner' && displayName !== 'Sparky Runner') {
        return await prisma.user.update({
          where: { id: existing.id },
          data: { name: displayName },
        });
      }
      return existing;
    }
  }

  if (phone) {
    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
    const existing = await prisma.user.findUnique({ where: { phone: cleanPhone } });
    if (existing) {
      if (existing.name === 'Sparky Runner' && displayName !== 'Sparky Runner') {
        return await prisma.user.update({
          where: { id: existing.id },
          data: { name: displayName },
        });
      }
      return existing;
    }

    // Create user with real player name:
    return await prisma.user.create({
      data: {
        email: `runner_${cleanPhone}@popular.sparky`,
        phone: cleanPhone,
        name: displayName,
      },
    });
  }

  // Fallback guest user for brand
  const guestEmail = 'guest_popular@gamefaktory.com';
  let guestUser = await prisma.user.findUnique({ where: { email: guestEmail } });
  if (!guestUser) {
    guestUser = await prisma.user.create({
      data: {
        email: guestEmail,
        name: displayName !== 'Sparky Runner' ? displayName : 'Showroom Guest',
        phone: '0000000000',
      },
    });
  } else if (displayName !== 'Sparky Runner' && guestUser.name === 'Showroom Guest') {
    guestUser = await prisma.user.update({
      where: { id: guestUser.id },
      data: { name: displayName },
    });
  }
  return guestUser;
}

// 1. Start Game Session / Consume 1 Token Life (Brand & User Isolated)
app.post(
  [
    '/api/game/start-session',
    '/api/v1/tokens/consume',
    '/api/token/consume',
    '/api/brands/:brandSlug/games/:gameSlug/sessions/start',
    '/api/brands/:brandSlug/sessions/start',
  ],
  async (req, res) => {
    try {
      const tokenCode = (req.body.token || req.body.tokenCode || '').trim().toUpperCase();
      const brandSlug = (req.params.brandSlug || req.body.brand || req.body.brandSlug || 'popular').trim().toLowerCase();
      const userId = req.body.userId || null;
      const phone = req.body.phone || null;
      const playerName = req.body.name || req.body.playerName || null;

      if (!tokenCode) {
        return res.status(400).json({ success: false, error: 'Token is required' });
      }

      const brandRes = await resolveBrandAndAliases(brandSlug);
      if (!brandRes) {
        return res.status(404).json({ success: false, error: `Brand '${brandSlug}' not found`, livesRemaining: 0 });
      }
      const brand = brandRes.primary;

      const token = await prisma.qrToken.findUnique({
        where: { code: tokenCode },
        include: { brand: true, user: true },
      });

      if (!token) {
        return res.status(404).json({
          success: false,
          error: 'QR Token not recognized in database',
          livesRemaining: 0,
        });
      }

      // Multi-tenant brand isolation check (allowing aliased brand IDs)
      if (!brandRes.matchesBrandId(token.brandId)) {
        return res.status(403).json({
          success: false,
          error: `This token does not belong to ${brandSlug}`,
          livesRemaining: 0,
        });
      }

      if (token.status !== 'ACTIVE' || token.livesRemaining <= 0) {
        return res.status(400).json({
          success: false,
          error: 'No lives remaining for this token',
          livesRemaining: 0,
        });
      }

      // Resolve player linked to this session with real name
      const targetUserId = userId || token.userId;
      const user = await resolveSessionUser(targetUserId, phone, brand.id, playerName);

      // Bind token to user if unassigned
      if (!token.userId && user) {
        await prisma.qrToken.update({
          where: { id: token.id },
          data: { userId: user.id },
        });
      }

      // Atomic life decrement and session creation in transaction
      const sessionToken = `gf_sess_${crypto.randomBytes(16).toString('hex')}`;

      const result = await prisma.$transaction(async (tx) => {
        const updatedToken = await tx.qrToken.update({
          where: { id: token.id },
          data: {
            livesRemaining: token.livesRemaining - 1,
            status: token.livesRemaining - 1 <= 0 ? 'EXHAUSTED' : 'ACTIVE',
            lastPlayedAt: new Date(),
          },
        });

        const newSession = await tx.gameSession.create({
          data: {
            userId: user.id,
            brandId: brand.id,
            sessionToken: sessionToken,
            score: 0,
            isCompleted: false,
            startedAt: new Date(),
          },
        });

        return { token: updatedToken, session: newSession };
      });

      // Weekly Special Gift: Evaluate LuLu 100 QAR In-Game Special Voucher eligibility
      let luluGift = { eligible: false };
      try {
        const { startOfWeek, endOfWeek } = getQatarWeeklyTimeWindow();
        const weekLabel = formatQatarWeekLabel(startOfWeek, endOfWeek);

        // Find or create current week record for LuLu gift
        let weekGift = await prisma.weeklySpecialGift.findFirst({
          where: {
            brandSlug: brand.slug,
            weekStart: { lte: new Date() },
            weekEnd: { gte: new Date() },
            giftType: 'LULU_100_QAR'
          }
        });

        if (!weekGift) {
          // Initialize week gift record if not created yet
          weekGift = await prisma.weeklySpecialGift.create({
            data: {
              brandSlug: brand.slug,
              weekLabel,
              weekStart: startOfWeek,
              weekEnd: endOfWeek,
              giftType: 'LULU_100_QAR',
              isClaimed: false
            }
          }).catch(() => null);
        }

        if (weekGift && !weekGift.isClaimed) {
          // Calculate Qatar week elapsed hours
          const now = new Date();
          const qatarOffsetMs = 3 * 3600 * 1000;
          const qatarTime = new Date(now.getTime() + qatarOffsetMs);
          const dayOfWeek = qatarTime.getUTCDay(); // 0 = Sun, 1 = Mon ...
          const elapsedHours = (dayOfWeek * 24) + qatarTime.getUTCHours();

          // Pacing probability:
          // 0% in first 36 hours (Sunday to Monday noon)
          let probability = 0;
          if (elapsedHours >= 36 && elapsedHours < 60) {
            probability = 0.005; // 0.5% chance
          } else if (elapsedHours >= 60 && elapsedHours < 84) {
            probability = 0.02;  // 2% chance (Tuesday)
          } else if (elapsedHours >= 84 && elapsedHours < 120) {
            probability = 0.05;  // 5% chance (Wednesday / Thursday - Peak)
          } else if (elapsedHours >= 120) {
            probability = 0.12;  // 12% chance (Friday / Saturday - Late week boost)
          }

          if (Math.random() < probability) {
            const voucherToken = `lulu_${crypto.randomUUID()}`;
            saveSessionLuluToken(result.session.sessionToken, voucherToken);
            luluGift = {
              eligible: true,
              spawnDistance: 700, // Runner must reach 700m
              voucherToken: voucherToken
            };
          }
        }
      } catch (luluErr) {
        console.error('[LuLu Voucher Evaluation Error]:', luluErr);
      }

      return res.json({
        success: true,
        sessionId: result.session.sessionToken,
        sessionToken: result.session.sessionToken,
        livesRemaining: result.token.livesRemaining,
        initialLives: result.token.initialLives,
        token: result.token.code,
        status: result.token.status,
        userId: user.id,
        userName: user.name,
        brand: brand.slug,
        luluGift // { eligible: boolean, spawnDistance?: number, voucherToken?: string }
      });
    } catch (error) {
      console.error('Start game session error:', error);
      return res.status(500).json({ success: false, error: 'Failed to start game session' });
    }
  }
);

// 2. Complete / End Game Session (Scores Isolated Strictly to that Brand)
app.post(
  [
    '/api/game/end-session',
    '/api/v1/tokens/end-session',
    '/api/brands/:brandSlug/games/:gameSlug/sessions/finish',
    '/api/brands/:brandSlug/sessions/finish',
  ],
  async (req, res) => {
    try {
      const sessionToken = req.body.sessionToken || req.body.sessionId;
      const tokenCode = (req.body.token || req.body.tokenCode || '').trim().toUpperCase();
      const brandSlug = (req.params.brandSlug || req.body.brand || req.body.brandSlug || 'popular').trim().toLowerCase();
      const rawCoins = req.body.coins !== undefined ? parseInt(req.body.coins, 10) : NaN;
      const rawScore = !isNaN(rawCoins) ? rawCoins : (parseInt(req.body.score, 10) || 0);
      const rawDuration = parseInt(req.body.durationSeconds || req.body.duration, 10) || 0;

      if (!sessionToken) {
        return res.status(400).json({ success: false, error: 'Session token is required.' });
      }

      const brandRes = await resolveBrandAndAliases(brandSlug);
      if (!brandRes) {
        return res.status(404).json({ success: false, error: `Brand '${brandSlug}' not found` });
      }
      const brand = brandRes.primary;

      // Query session with strict brand and token verification
      let session = await prisma.gameSession.findUnique({
        where: { sessionToken },
        include: { brand: true, user: true },
      });

      if (!session) {
        // Fallback: If session not found by token, look for active session for this user/brand
        session = await prisma.gameSession.findFirst({
          where: { brandId: { in: brandRes.brandIds }, isCompleted: false },
          orderBy: { startedAt: 'desc' },
          include: { brand: true, user: true },
        });
      }

      if (!session) {
        return res.status(404).json({ success: false, error: 'Invalid or expired game session token.' });
      }

      // Multi-tenant check: ensure session belongs strictly to this brand or its aliases
      if (!brandRes.matchesBrandId(session.brandId)) {
        return res.status(403).json({ success: false, error: 'Cross-brand session submission is forbidden.' });
      }

      if (session.isCompleted) {
        return res.status(400).json({ success: false, error: 'Session has already been finalized.' });
      }

      const now = new Date();
      const durationSeconds = rawDuration > 0 ? rawDuration : Math.max(1, Math.round((now - new Date(session.startedAt)) / 1000));
      const finalScore = Math.max(0, rawScore);

      const completedSession = await prisma.gameSession.update({
        where: { id: session.id },
        data: {
          score: finalScore,
          duration: durationSeconds,
          isCompleted: true,
          completedAt: now,
        },
      });

      // Calculate player's brand-specific stats (across brandId and aliases)
      const userBrandSessions = await prisma.gameSession.findMany({
        where: {
          userId: session.userId,
          brandId: { in: brandRes.brandIds },
          isCompleted: true,
        },
      });

      const bestScore = userBrandSessions.length > 0 ? Math.max(...userBrandSessions.map((s) => s.score)) : finalScore;
      const totalScore = userBrandSessions.reduce((sum, s) => sum + s.score, 0);

      // Remaining lives for token
      let livesRemaining = 0;
      if (tokenCode) {
        const token = await prisma.qrToken.findUnique({ where: { code: tokenCode } });
        if (token) livesRemaining = token.livesRemaining;
      }

      return res.json({
        success: true,
        session: {
          id: completedSession.id,
          sessionToken: completedSession.sessionToken,
          score: completedSession.score,
          duration: completedSession.duration,
          startedAt: completedSession.startedAt,
          completedAt: completedSession.completedAt,
        },
        brand: brand.slug,
        bestScore,
        totalScore,
        livesRemaining,
      });
    } catch (error) {
      console.error('End game session error:', error);
      return res.status(500).json({ success: false, error: 'Failed to complete game session' });
    }
  }
);

// 3. Admin / Dashboard Endpoint: Fetch All Sessions for a Specific User under that Brand Only
app.get(
  [
    '/api/brands/:brandSlug/players/:userId/sessions',
    '/api/brands/:brandSlug/sessions',
    '/api/brands/:brandSlug/games/:gameSlug/players/:userId/sessions',
  ],
  async (req, res) => {
    try {
      const brandSlug = (req.params.brandSlug || 'popular').trim().toLowerCase();
      const userId = req.params.userId || req.query.userId;
      const phone = req.query.phone;

      const brandRes = await resolveBrandAndAliases(brandSlug);
      if (!brandRes) return res.status(404).json({ error: `Brand '${brandSlug}' not found` });
      const brand = brandRes.primary;

      let user = null;
      if (userId) {
        user = await prisma.user.findUnique({ where: { id: userId } });
      } else if (phone) {
        const clean = String(phone).replace(/\D/g, '').slice(-10);
        user = await prisma.user.findUnique({ where: { phone: clean } });
      }

      if (!user) {
        return res.status(404).json({ error: 'Player not found in database' });
      }

      // Query sessions matching brandId in brandIds (including aliases)
      const sessions = await prisma.gameSession.findMany({
        where: {
          brandId: { in: brandRes.brandIds },
          userId: user.id,
          isCompleted: true,
        },
        orderBy: { completedAt: 'desc' },
      });

      const bestScore = sessions.length > 0 ? Math.max(...sessions.map((s) => s.score)) : 0;
      const totalScore = sessions.reduce((sum, s) => sum + s.score, 0);

      return res.json({
        success: true,
        brand: brand.slug,
        player: {
          id: user.id,
          name: user.name || 'Sparky Runner',
          phone: user.phone ? `+974 ${user.phone}` : 'N/A',
          totalGamesPlayed: sessions.length,
          bestScore,
          totalScore,
        },
        sessions: sessions.map((s) => ({
          id: s.id,
          sessionToken: s.sessionToken,
          score: s.score,
          duration: s.duration || 0,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
        })),
      });
    } catch (err) {
      console.error('Fetch player sessions error:', err);
      return res.status(500).json({ error: 'Failed to fetch player sessions' });
    }
  }
);

// 3b. Dedicated Player Brand Stats Endpoint: Highest Score & Cumulative Total Score for the active brand
app.get([
  '/api/player/stats',
  '/api/brands/:brandSlug/player/stats',
  '/api/brands/:brandSlug/players/:identifier/stats'
], async (req, res) => {
  try {
    const brandSlug = (req.params.brandSlug || req.query.brand || req.query.brandSlug || 'popular').trim().toLowerCase();
    const identifier = req.params.identifier || req.query.userId || req.query.phone || req.query.token;
    const phoneQuery = req.query.phone;
    const tokenQuery = req.query.token;
    const userIdQuery = req.query.userId;

    const brandRes = await resolveBrandAndAliases(brandSlug);
    if (!brandRes) return res.status(404).json({ success: false, error: `Brand '${brandSlug}' not found` });
    const brand = brandRes.primary;

    let user = null;

    // 1. Resolve by userId if valid UUID
    const targetUserId = userIdQuery || (identifier && identifier.includes('-') && identifier.length === 36 ? identifier : null);
    if (targetUserId) {
      user = await prisma.user.findUnique({ where: { id: targetUserId } });
    }

    // 2. Resolve by phone number
    if (!user) {
      const targetPhone = phoneQuery || identifier;
      if (targetPhone && /\d{7,15}/.test(targetPhone)) {
        const clean = String(targetPhone).replace(/\D/g, '').slice(-10);
        user = await prisma.user.findUnique({ where: { phone: clean } });
      }
    }

    // 3. Resolve by token code if user is bound to a QR token
    if (!user) {
      const targetToken = tokenQuery || identifier;
      if (targetToken) {
        const token = await prisma.qrToken.findUnique({
          where: { code: String(targetToken).trim().toUpperCase() },
          include: { user: true }
        });
        if (token && token.user) {
          user = token.user;
        }
      }
    }

    // If player has never completed a session or registered yet, return clean zero state
    if (!user) {
      return res.json({
        success: true,
        brand: brand.slug,
        brandName: brand.name,
        player: null,
        highestScore: 0,
        bestScore: 0,
        totalPoints: 0,
        totalScore: 0,
        gamesPlayed: 0
      });
    }

    // Query all completed sessions strictly for this brand & its aliases
    const brandSessions = await prisma.gameSession.findMany({
      where: {
        userId: user.id,
        brandId: { in: brandRes.brandIds },
        isCompleted: true
      },
      orderBy: { completedAt: 'desc' }
    });

    const highestScore = brandSessions.length > 0 ? Math.max(...brandSessions.map(s => s.score)) : 0;
    const grossEarnedCoins = brandSessions.reduce((sum, s) => sum + s.score, 0);

    // Calculate redeemed/claimed coupon costs for this brand (status != 'CANCELLED')
    const cleanPhone = user.phone ? String(user.phone).replace(/\D/g, '').slice(-10) : '';
    const phoneConditions = [];
    if (user.phone) phoneConditions.push({ customerPhone: user.phone });
    if (cleanPhone) {
      phoneConditions.push({ customerPhone: cleanPhone });
      phoneConditions.push({ customerPhone: `+974 ${cleanPhone}` });
      phoneConditions.push({ customerPhone: `+974${cleanPhone}` });
    }

    const wherePlayerCoupons = {
      brandSlug: { in: [brand.slug, ...brandRes.brandIds] },
      status: { not: 'CANCELLED' },
      OR: [
        { customerId: user.id },
        ...(phoneConditions.length > 0 ? phoneConditions : [])
      ]
    };

    const claimedCoupons = await prisma.rewardCoupon.findMany({
      where: wherePlayerCoupons,
      select: { redeemedCoins: true }
    });
    const totalRedeemedCoins = claimedCoupons.reduce((sum, c) => sum + c.redeemedCoins, 0);
    const netAvailableCoins = Math.max(0, grossEarnedCoins - totalRedeemedCoins);

    return res.json({
      success: true,
      brand: brand.slug,
      brandName: brand.name,
      player: {
        id: user.id,
        name: user.name || 'Sparky Runner',
        phone: user.phone ? (user.phone.startsWith('+') ? user.phone : `+974 ${user.phone}`) : 'N/A'
      },
      highestScore,    // Personal best in a single run under this brand
      bestScore: highestScore,
      totalPoints: netAvailableCoins,     // Net spendable points/coins gathered under this brand
      totalScore: netAvailableCoins,
      grossEarnedCoins,                   // All-time gross coins earned before redemptions
      totalRedeemedCoins,                 // Total coins spent on claimed coupons
      gamesPlayed: brandSessions.length,
      lastPlayedAt: brandSessions.length > 0 ? brandSessions[0].completedAt : null
    });
  } catch (error) {
    console.error('[Player Brand Stats Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve player brand stats' });
  }
});

// 4. Admin / Dashboard Endpoint: Fetch All Players Registered/Played for this Brand Only
app.get(['/api/brands/:brandSlug/players', '/api/players'], async (req, res) => {
  try {
    const brandSlug = (req.params.brandSlug || 'popular').trim().toLowerCase();
    const brandRes = await resolveBrandAndAliases(brandSlug);
    if (!brandRes) return res.status(404).json({ error: `Brand '${brandSlug}' not found` });
    const brand = brandRes.primary;

    // Find all completed game sessions for this brand and any aliases
    const brandSessions = await prisma.gameSession.findMany({
      where: {
        brandId: { in: brandRes.brandIds },
        isCompleted: true,
      },
      include: { user: true },
      orderBy: { completedAt: 'desc' },
    });

    // 2. Also include users who claimed or have tokens under this brand
    const brandTokens = await prisma.qrToken.findMany({
      where: { brandId: { in: brandRes.brandIds }, userId: { not: null } },
      include: { user: true },
    });

    // 3. Also include users registered or credited under this brand
    const brandCredits = await prisma.gameplayCredit.findMany({
      where: { brandId: { in: brandRes.brandIds } },
      include: { user: true },
    });

    const playerMap = new Map();

    brandSessions.forEach((s) => {
      if (!s.user) return;
      if (!playerMap.has(s.userId)) {
        playerMap.set(s.userId, {
          id: s.user.id,
          name: s.user.name || 'Sparky Runner',
          phone: s.user.phone,
          fullPhone: s.user.phone ? (s.user.phone.startsWith('+') ? s.user.phone : `+974 ${s.user.phone}`) : 'N/A',
          showroom: 'Najma / Barwa',
          bestScore: s.score,
          totalScore: s.score,
          gamesPlayed: 1,
          lastPlayed: s.completedAt || s.startedAt,
        });
      } else {
        const p = playerMap.get(s.userId);
        p.bestScore = Math.max(p.bestScore, s.score);
        p.totalScore += s.score;
        p.gamesPlayed += 1;
      }
    });

    brandTokens.forEach((t) => {
      if (t.user && !playerMap.has(t.userId)) {
        playerMap.set(t.userId, {
          id: t.user.id,
          name: t.user.name || 'Sparky Runner',
          phone: t.user.phone,
          fullPhone: t.user.phone ? (t.user.phone.startsWith('+') ? t.user.phone : `+974 ${t.user.phone}`) : 'N/A',
          showroom: 'Showroom Counter',
          bestScore: 0,
          totalScore: 0,
          gamesPlayed: 0,
          lastPlayed: t.updatedAt,
        });
      }
    });

    brandCredits.forEach((c) => {
      if (c.user && !playerMap.has(c.userId)) {
        playerMap.set(c.userId, {
          id: c.user.id,
          name: c.user.name || 'Sparky Runner',
          phone: c.user.phone,
          fullPhone: c.user.phone ? (c.user.phone.startsWith('+') ? c.user.phone : `+974 ${c.user.phone}`) : 'N/A',
          showroom: 'Showroom Counter',
          bestScore: 0,
          totalScore: 0,
          gamesPlayed: 0,
          lastPlayed: c.createdAt,
        });
      }
    });

    const players = Array.from(playerMap.values()).sort((a, b) => {
      if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return b.gamesPlayed - a.gamesPlayed;
    });
    return res.json({ success: true, brand: brand.slug, count: players.length, players });
  } catch (err) {
    console.error('Fetch brand players error:', err);
    return res.status(500).json({ error: 'Failed to fetch brand players' });
  }
});

// Helper: Calculate Qatar AST (UTC+3) current week start (Sunday 00:00:00 AST = Saturday 21:00:00 UTC)
function getQatarCurrentWeekStart(referenceDate = new Date()) {
  const qatarOffsetMs = 3 * 60 * 60 * 1000;
  const qatarTime = new Date(referenceDate.getTime() + qatarOffsetMs);
  const dayOfWeek = qatarTime.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const hours = qatarTime.getUTCHours();
  const minutes = qatarTime.getUTCMinutes();
  const seconds = qatarTime.getUTCSeconds();
  const ms = qatarTime.getUTCMilliseconds();
  const elapsedMs = (dayOfWeek * 86400000) + (hours * 3600000) + (minutes * 60000) + (seconds * 1000) + ms;
  
  // Date representing Sunday 00:00:00 AST in absolute UTC
  return new Date(referenceDate.getTime() - elapsedMs);
}

// Helper: Calculate Sunday 00:00:00 AST to Saturday 23:59:59.999 AST weekly cycle
function getQatarWeeklyTimeWindow(referenceDate = new Date()) {
  const startOfWeek = getQatarCurrentWeekStart(referenceDate);
  const endOfWeek = new Date(startOfWeek.getTime() + (7 * 86400000) - 1); // 6 days, 23:59:59.999
  return { startOfWeek, endOfWeek };
}

// Format week label in Qatar AST (e.g., "19 Oct - 25 Oct 2026")
function formatQatarWeekLabel(startUtc, endUtc) {
  const qatarOffsetMs = 3 * 60 * 60 * 1000;
  const qStart = new Date(startUtc.getTime() + qatarOffsetMs);
  const qEnd = new Date(endUtc.getTime() + qatarOffsetMs);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${qStart.getUTCDate()} ${months[qStart.getUTCMonth()]} - ${qEnd.getUTCDate()} ${months[qEnd.getUTCMonth()]} ${qEnd.getUTCFullYear()}`;
}

// 5a. WEEKLY LEADERBOARD: Sunday 12:00 AM Qatar Time (AST, UTC+3) window, ranked by Highest Single Game Score
app.get([
  '/api/leaderboard/weekly',
  '/api/brands/:brandSlug/leaderboard/weekly',
  '/api/brands/:brandSlug/games/:gameSlug/leaderboard/weekly'
], async (req, res) => {
  try {
    const brandSlug = req.params.brandSlug || req.query.brand || req.query.brandSlug || 'popular-electricals-qatar';
    const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 50), 100);
    const { startOfWeek, endOfWeek } = getQatarWeeklyTimeWindow();

    let whereClause = {
      isCompleted: true,
      completedAt: {
        gte: startOfWeek,
        lte: endOfWeek
      }
    };

    if (brandSlug) {
      const brandRes = await resolveBrandAndAliases(brandSlug);
      if (brandRes) {
        whereClause.brandId = { in: brandRes.brandIds };
      }
    }

    // Retrieve sessions within this Qatar week sorted by highest score
    const weeklySessions = await prisma.gameSession.findMany({
      where: whereClause,
      orderBy: { score: 'desc' },
      take: limit * 3, // Overfetch to deduplicate per user and keep their best single score
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        brand: {
          select: {
            id: true,
            slug: true,
            name: true
          }
        }
      }
    });

    const userBestMap = new Map();
    weeklySessions.forEach((s) => {
      const uid = s.userId || s.id;
      if (!userBestMap.has(uid)) {
        userBestMap.set(uid, {
          rank: 0,
          id: s.id,
          userId: s.userId,
          name: s.user?.name || 'Sparky Runner',
          phone: s.user?.phone ? (s.user.phone.startsWith('+') ? s.user.phone : `+974 ${s.user.phone}`) : 'N/A',
          score: s.score, // Highest single game score this week
          duration: s.duration || 0,
          brand: s.brand?.name || 'Popular Electricals',
          brandSlug: s.brand?.slug || 'popular',
          playedAt: s.completedAt || s.startedAt
        });
      }
    });

    const leaderboard = Array.from(userBestMap.values())
      .slice(0, limit)
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

    return res.json({
      success: true,
      period: 'WEEKLY',
      timezone: 'Asia/Qatar (AST, UTC+3)',
      weekLabel: formatQatarWeekLabel(startOfWeek, endOfWeek),
      weekStart: startOfWeek.toISOString(),
      weekEnd: endOfWeek.toISOString(),
      count: leaderboard.length,
      leaderboard
    });
  } catch (err) {
    console.error('[Weekly Leaderboard Error]:', err);
    return res.status(500).json({ error: 'Failed to fetch weekly leaderboard' });
  }
});

// 5a.1 WEEKLY WINNERS ARCHIVE: Fetch previous weekly champions
app.get([
  '/api/leaderboard/weekly/winners',
  '/api/brands/:brandSlug/leaderboard/weekly/winners'
], async (req, res) => {
  try {
    const brandSlug = req.params.brandSlug || req.query.brand || req.query.brandSlug || 'popular-electricals-qatar';
    const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 20), 50);

    const brandRes = await resolveBrandAndAliases(brandSlug);
    const targetBrandSlugs = brandRes ? [brandRes.primary.slug, ...brandRes.brandSlugs] : [brandSlug];

    const winners = await prisma.weeklyWinner.findMany({
      where: { brandSlug: { in: targetBrandSlugs } },
      orderBy: { weekStart: 'desc' },
      take: limit
    });

    return res.json({
      success: true,
      count: winners.length,
      winners
    });
  } catch (err) {
    console.error('[Weekly Winners Error]:', err);
    return res.status(500).json({ error: 'Failed to fetch weekly winners' });
  }
});

// Archive Weekly Winner logic: Archives top scorer of the completed week
async function archiveWeeklyWinnerForBrand(brandSlug = 'popular-electricals-qatar', targetWeekStart) {
  try {
    const brandRes = await resolveBrandAndAliases(brandSlug);
    if (!brandRes) return null;

    // Concluded week starts 7 days prior to targetWeekStart
    const concludedWeekStart = new Date(targetWeekStart.getTime() - (7 * 86400000));
    const concludedWeekEnd = new Date(targetWeekStart.getTime() - 1);
    const weekLabel = formatQatarWeekLabel(concludedWeekStart, concludedWeekEnd);

    // Check if already archived
    const existing = await prisma.weeklyWinner.findFirst({
      where: {
        brandSlug: brandRes.primary.slug,
        weekStart: concludedWeekStart
      }
    });
    if (existing) {
      console.log(`[Weekly Winner Archive] Week ${weekLabel} already archived for ${brandRes.primary.slug}`);
      return existing;
    }

    // Find top single score session for concluded week
    const topSession = await prisma.gameSession.findFirst({
      where: {
        brandId: { in: brandRes.brandIds },
        isCompleted: true,
        completedAt: {
          gte: concludedWeekStart,
          lte: concludedWeekEnd
        }
      },
      orderBy: { score: 'desc' },
      include: { user: true }
    });

    if (!topSession) {
      console.log(`[Weekly Winner Archive] No sessions found for week ${weekLabel}`);
      return null;
    }

    const winner = await prisma.weeklyWinner.create({
      data: {
        brandSlug: brandRes.primary.slug,
        weekLabel,
        weekStart: concludedWeekStart,
        weekEnd: concludedWeekEnd,
        winnerUserId: topSession.userId,
        winnerName: topSession.user?.name || 'Sparky Champion',
        winnerPhone: topSession.user?.phone ? (topSession.user.phone.startsWith('+') ? topSession.user.phone : `+974 ${topSession.user.phone}`) : null,
        winningScore: topSession.score,
        rank: 1,
        rewardTitle: 'Weekly Champion Voucher'
      }
    });

    console.log(`[Weekly Winner Archive] Successfully archived winner for ${weekLabel}:`, winner.winnerName, winner.winningScore);
    return winner;
  } catch (error) {
    console.error('[Weekly Winner Archive Error]:', error);
    return null;
  }
}

// Background Cron Scheduler: Checks every 60 seconds for Saturday 21:00 UTC (Sunday 00:00 AST) weekly turnover
let lastArchivedWeekStartTime = null;
setInterval(async () => {
  try {
    const now = new Date();
    // Sunday 00:00:00 AST = Saturday 21:00:00 UTC
    // Trigger window: Saturday UTC between 21:00 and 21:05
    if (now.getUTCDay() === 6 && now.getUTCHours() === 21 && now.getUTCMinutes() < 5) {
      const currentWeekStart = getQatarCurrentWeekStart(now);
      const weekKey = currentWeekStart.toISOString();
      if (lastArchivedWeekStartTime !== weekKey) {
        lastArchivedWeekStartTime = weekKey;
        console.log('[Weekly Turnover Cron] Sunday 00:00 AST reached. Archiving weekly winners...');
        await archiveWeeklyWinnerForBrand('popular-electricals-qatar', currentWeekStart);
      }
    }
  } catch (cronErr) {
    console.error('[Weekly Turnover Cron Error]:', cronErr);
  }
}, 60000);


// 5b. ALL-TIME LEADERBOARD: Ranked by Cumulative Total Score across all games
app.get([
  '/api/leaderboard/all-time',
  '/api/leaderboard/alltime',
  '/api/brands/:brandSlug/leaderboard/all-time',
  '/api/brands/:brandSlug/leaderboard/alltime'
], async (req, res) => {
  try {
    const brandSlug = req.params.brandSlug || req.query.brand || req.query.brandSlug || null;
    const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 50), 100);

    let whereClause = { isCompleted: true };
    if (brandSlug) {
      const brandRes = await resolveBrandAndAliases(brandSlug);
      if (brandRes) {
        whereClause.brandId = { in: brandRes.brandIds };
      }
    }

    // Retrieve all completed game sessions matching brand criteria
    const allSessions = await prisma.gameSession.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        brand: {
          select: {
            id: true,
            slug: true,
            name: true
          }
        }
      }
    });

    // Retrieve all claimed/active coupons for this brand to subtract from totalScore
    let brandCouponWhere = { status: { not: 'CANCELLED' } };
    if (brandSlug) {
      const brandRes = await resolveBrandAndAliases(brandSlug);
      if (brandRes) {
        brandCouponWhere.brandSlug = { in: [brandRes.primary.slug, ...brandRes.brandIds] };
      }
    }

    const claimedCoupons = await prisma.rewardCoupon.findMany({
      where: brandCouponWhere,
      select: {
        customerId: true,
        customerPhone: true,
        redeemedCoins: true
      }
    });

    // Map deductions by customerId and cleaned customerPhone
    const userCouponDeductions = new Map();
    claimedCoupons.forEach((c) => {
      if (c.customerId) {
        userCouponDeductions.set(c.customerId, (userCouponDeductions.get(c.customerId) || 0) + c.redeemedCoins);
      }
      if (c.customerPhone) {
        const cleanP = String(c.customerPhone).replace(/\D/g, '').slice(-10);
        if (cleanP) {
          userCouponDeductions.set(cleanP, (userCouponDeductions.get(cleanP) || 0) + c.redeemedCoins);
        }
      }
    });

    // Aggregate cumulative total score & best score per user
    const userAggMap = new Map();
    allSessions.forEach((s) => {
      const uid = s.userId || s.id;
      if (!userAggMap.has(uid)) {
        userAggMap.set(uid, {
          rank: 0,
          userId: s.userId,
          name: s.user?.name || 'Sparky Runner',
          phone: s.user?.phone ? (s.user.phone.startsWith('+') ? s.user.phone : `+974 ${s.user.phone}`) : 'N/A',
          rawPhone: s.user?.phone || null,
          grossScore: s.score,     // Gross coins earned
          totalScore: s.score,      // Net spendable total score (will be deducted below)
          bestScore: s.score,       // Highest single game score
          gamesPlayed: 1,
          brand: s.brand?.name || 'Popular Electricals',
          brandSlug: s.brand?.slug || 'popular',
          lastPlayedAt: s.completedAt || s.startedAt
        });
      } else {
        const u = userAggMap.get(uid);
        u.grossScore += s.score;
        u.bestScore = Math.max(u.bestScore, s.score);
        u.gamesPlayed += 1;
        if (s.completedAt && (!u.lastPlayedAt || new Date(s.completedAt) > new Date(u.lastPlayedAt))) {
          u.lastPlayedAt = s.completedAt;
        }
      }
    });

    // Subtract redeemed coupon costs: player.totalScore = grossScore - totalRedeemedCoins
    userAggMap.forEach((entry) => {
      let deductedCoins = 0;
      if (entry.userId && userCouponDeductions.has(entry.userId)) {
        deductedCoins = userCouponDeductions.get(entry.userId);
      } else if (entry.rawPhone) {
        const cleanP = String(entry.rawPhone).replace(/\D/g, '').slice(-10);
        if (cleanP && userCouponDeductions.has(cleanP)) {
          deductedCoins = userCouponDeductions.get(cleanP);
        }
      }
      entry.redeemedCoins = deductedCoins;
      entry.totalScore = Math.max(0, entry.grossScore - deductedCoins);
      delete entry.rawPhone;
    });

    // Sort: Net totalScore desc; players with >0 score come first, 0-score players placed at the bottom.
    // Tiebreaker: bestScore desc, then gamesPlayed desc.
    const leaderboard = Array.from(userAggMap.values())
      .sort((a, b) => {
        // Place players who still have available score ahead of players with 0 remaining score
        const aHasScore = a.totalScore > 0 ? 1 : 0;
        const bHasScore = b.totalScore > 0 ? 1 : 0;
        if (bHasScore !== aHasScore) return bHasScore - aHasScore;

        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
        return b.gamesPlayed - a.gamesPlayed;
      })
      .slice(0, limit)
      .map((entry, idx) => ({ 
        ...entry, 
        rank: idx + 1,
        score: entry.totalScore // Normalized field for generic frontend score cards
      }));

    return res.json({
      success: true,
      period: 'ALL_TIME',
      count: leaderboard.length,
      leaderboard
    });
  } catch (err) {
    console.error('[All-Time Leaderboard Error]:', err);
    return res.status(500).json({ error: 'Failed to fetch all-time leaderboard' });
  }
});

// 5c. Legacy Global Fallback (Defaults to Weekly Leaderboard for backward compatibility)
app.get([
  '/api/leaderboard/global', 
  '/api/leaderboard', 
  '/api/brands/:brandSlug/leaderboard'
], async (req, res) => {
  // Delegate directly to weekly leaderboard handler
  const { startOfWeek, endOfWeek } = getWeeklyTimeWindow();
  const brandSlug = req.params.brandSlug || req.query.brand || req.query.brandSlug || null;
  const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 50), 100);

  let whereClause = { isCompleted: true };
  if (brandSlug) {
    const brandRes = await resolveBrandAndAliases(brandSlug);
    if (brandRes) whereClause.brandId = { in: brandRes.brandIds };
  }

  const topSessions = await prisma.gameSession.findMany({
    where: whereClause,
    orderBy: { score: 'desc' },
    take: limit * 2,
    include: {
      user: { select: { id: true, name: true, phone: true } },
      brand: { select: { id: true, slug: true, name: true } }
    }
  });

  const userBestMap = new Map();
  topSessions.forEach((s) => {
    const uid = s.userId || s.id;
    if (!userBestMap.has(uid)) {
      userBestMap.set(uid, {
        rank: 0,
        id: s.id,
        userId: s.userId,
        name: s.user?.name || 'Sparky Runner',
        phone: s.user?.phone ? (s.user.phone.startsWith('+') ? s.user.phone : `+974 ${s.user.phone}`) : 'N/A',
        score: s.score,
        duration: s.duration || 0,
        brand: s.brand?.name || 'Popular Electricals',
        brandSlug: s.brand?.slug || 'popular',
        playedAt: s.completedAt || s.startedAt
      });
    }
  });

  const leaderboard = Array.from(userBestMap.values())
    .slice(0, limit)
    .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

  return res.json({
    success: true,
    count: leaderboard.length,
    leaderboard
  });
});

// ====================================================
// BACKEND-AUTHORITATIVE REWARD COUPONS & REDEMPTION
// ====================================================

// Authoritative Catalog & Costs
const BRAND_REWARDS_CATALOG = {
  'rw_keychain':  { title: 'Keychain',  cost: 1000, discount: 'KEYCHAIN' },
  'rw_pen':       { title: 'Pen',       cost: 1500, discount: 'PEN' },
  'rw_cap':       { title: 'Cap',       cost: 1500, discount: 'CAP' },
  'rw_diary':     { title: 'Diary',     cost: 2000, discount: 'DIARY' },
  'rw_diary_box': { title: 'Diary Box', cost: 4000, discount: 'DIARY BOX' },
  'rw_watch':     { title: 'Watch',     cost: 6000, discount: 'WATCH' },
  'rw_shirt':     { title: 'T-Shirt',   cost: 8000, discount: 'T-SHIRT' },
  // Backwards compatibility aliases if any in-flight requests use old keys
  'rw_5k':        { title: 'Keychain / Pen / Cap', cost: 1000, discount: 'KEYCHAIN' },
  'rw_10k':       { title: 'Diary',                cost: 2000, discount: 'DIARY' },
  'rw_16k':       { title: 'Diary Box',            cost: 4000, discount: 'DIARY BOX' },
  'rw_30k':       { title: 'Watch / T-Shirt',      cost: 6000, discount: 'WATCH' },
};

// Endpoint 1: Claim Coupon (User Intent)
app.post(['/api/coupons/claim', '/api/brands/:brandSlug/coupons/claim'], async (req, res) => {
  try {
    const brandSlugInput = req.params.brandSlug || req.body.brandSlug || req.body.brand || 'popular-electricals-qatar';
    const rewardId = (req.body.rewardId || '').trim();
    const phone = req.body.phone;
    const userId = req.body.userId;

    // 1. Validate rewardId against authoritative catalog
    const reward = BRAND_REWARDS_CATALOG[rewardId];
    if (!reward) {
      return res.status(400).json({ success: false, error: 'Invalid reward ID' });
    }

    // 2. Resolve brand and aliases
    const brandRes = await resolveBrandAndAliases(brandSlugInput);
    if (!brandRes) {
      return res.status(404).json({ success: false, error: `Brand '${brandSlugInput}' not found` });
    }
    const brand = brandRes.primary;

    // 3. Find player in database by userId or phone
    let player = null;
    if (userId) {
      player = await prisma.user.findUnique({ where: { id: userId } });
    }
    if (!player && phone) {
      const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
      player = await prisma.user.findUnique({ where: { phone: cleanPhone } });
    }

    if (!player) {
      return res.status(404).json({ success: false, error: 'Player record not found. Please play a game or register first.' });
    }

    // 4. Calculate Total Earned Coins: SUM(score) where user completed sessions for this brand
    const sessions = await prisma.gameSession.findMany({
      where: {
        userId: player.id,
        brandId: { in: brandRes.brandIds },
        isCompleted: true
      },
      select: { score: true }
    });
    const totalEarnedCoins = sessions.reduce((sum, s) => sum + s.score, 0);

    // 5. Calculate Total Already Claimed/Redeemed Coins (status != "CANCELLED")
    const cleanPhone = player.phone ? String(player.phone).replace(/\D/g, '').slice(-10) : '';
    const phoneConditions = [];
    if (player.phone) phoneConditions.push({ customerPhone: player.phone });
    if (cleanPhone) {
      phoneConditions.push({ customerPhone: cleanPhone });
      phoneConditions.push({ customerPhone: `+974 ${cleanPhone}` });
      phoneConditions.push({ customerPhone: `+974${cleanPhone}` });
    }

    const wherePlayerCoupons = {
      brandSlug: { in: [brand.slug, ...brandRes.brandIds] },
      status: { not: 'CANCELLED' },
      OR: [
        { customerId: player.id },
        ...(phoneConditions.length > 0 ? phoneConditions : [])
      ]
    };

    const existingCoupons = await prisma.rewardCoupon.findMany({
      where: wherePlayerCoupons,
      select: { redeemedCoins: true }
    });
    const totalRedeemedCoins = existingCoupons.reduce((sum, c) => sum + c.redeemedCoins, 0);

    // 6. Compute available balance
    const availableCoins = totalEarnedCoins - totalRedeemedCoins;

    if (availableCoins < reward.cost) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient coins balance.',
        requiredCoins: reward.cost,
        availableCoins
      });
    }

    // 7. Generate cryptographically unique coupon code: PET-XXXX-QAT
    let couponCode = '';
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      const randomFour = Math.floor(1000 + Math.random() * 9000);
      couponCode = `PET-${randomFour}-QAT`;
      const exists = await prisma.rewardCoupon.findUnique({ where: { couponCode } });
      if (!exists) isUnique = true;
      attempts++;
    }

    // 8. Save new RewardCoupon record
    const newCoupon = await prisma.rewardCoupon.create({
      data: {
        brandSlug: brand.slug,
        customerId: player.id,
        customerName: player.name || 'Sparky Runner',
        customerPhone: player.phone ? (player.phone.startsWith('+') ? player.phone : `+974 ${player.phone}`) : '+974 00000000',
        rewardId,
        rewardTitle: reward.title,
        couponCode,
        discountValue: reward.discount,
        redeemedCoins: reward.cost,
        status: 'PENDING'
      }
    });

    return res.status(201).json({
      success: true,
      coupon: {
        id: newCoupon.id,
        couponCode: newCoupon.couponCode,
        rewardId: newCoupon.rewardId,
        rewardTitle: newCoupon.rewardTitle,
        discountValue: newCoupon.discountValue,
        redeemedCoins: newCoupon.redeemedCoins,
        status: newCoupon.status,
        claimedAt: newCoupon.claimedAt
      },
      availableCoins: availableCoins - reward.cost,
      remainingCoins: availableCoins - reward.cost
    });
  } catch (error) {
    console.error('[Claim Coupon Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to claim reward coupon' });
  }
});

// Endpoint 2: Get Pending Coupons (User View)
app.get(['/api/coupons/pending', '/api/brands/:brandSlug/coupons/pending'], async (req, res) => {
  try {
    const brandSlugInput = req.params.brandSlug || req.query.brand || req.query.brandSlug || 'popular-electricals-qatar';
    const phone = req.query.phone;
    const userId = req.query.userId;

    const brandRes = await resolveBrandAndAliases(brandSlugInput);
    if (!brandRes) {
      return res.status(404).json({ success: false, error: `Brand '${brandSlugInput}' not found` });
    }

    const orConditions = [];
    if (userId) {
      orConditions.push({ customerId: userId });
    }
    if (phone) {
      const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
      orConditions.push({ customerPhone: phone });
      orConditions.push({ customerPhone: cleanPhone });
      orConditions.push({ customerPhone: `+974 ${cleanPhone}` });
      orConditions.push({ customerPhone: `+974${cleanPhone}` });
    }

    if (orConditions.length === 0) {
      return res.status(400).json({ success: false, error: 'Phone or userId is required' });
    }

    const coupons = await prisma.rewardCoupon.findMany({
      where: {
        brandSlug: { in: [brandRes.primary.slug, ...brandRes.brandIds] },
        status: 'PENDING',
        OR: orConditions
      },
      orderBy: { claimedAt: 'desc' }
    });

    return res.json({
      success: true,
      brand: brandRes.primary.slug,
      coupons: coupons.map(c => ({
        id: c.id,
        rewardId: c.rewardId,
        rewardTitle: c.rewardTitle,
        couponCode: c.couponCode,
        discountValue: c.discountValue,
        redeemedCoins: c.redeemedCoins,
        status: c.status,
        claimedAt: c.claimedAt
      }))
    });
  } catch (error) {
    console.error('[Pending Coupons Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch pending coupons' });
  }
});

// Endpoint 3: Get All Brand Coupons (Admin Dashboard / Cashier View)
app.get(['/api/coupons', '/api/brands/:brandSlug/coupons'], async (req, res) => {
  try {
    const brandSlugInput = req.params.brandSlug || req.query.brand || req.query.brandSlug || 'popular-electricals-qatar';
    const brandRes = await resolveBrandAndAliases(brandSlugInput);
    if (!brandRes) {
      return res.status(404).json({ success: false, error: `Brand '${brandSlugInput}' not found` });
    }

    const coupons = await prisma.rewardCoupon.findMany({
      where: {
        brandSlug: { in: [brandRes.primary.slug, ...brandRes.brandIds] }
      },
      orderBy: { claimedAt: 'desc' }
    });

    return res.json({
      success: true,
      brand: brandRes.primary.slug,
      count: coupons.length,
      coupons: coupons.map(c => ({
        id: c.id,
        couponCode: c.couponCode,
        rewardId: c.rewardId,
        rewardTitle: c.rewardTitle,
        customerName: c.customerName,
        customerPhone: c.customerPhone,
        redeemedCoins: c.redeemedCoins,
        status: c.status,
        claimedAt: c.claimedAt,
        redeemedAt: c.redeemedAt,
        redeemedBy: c.redeemedBy
      }))
    });
  } catch (error) {
    console.error('[Admin Coupons Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve coupons' });
  }
});

// Endpoint 4: Redeem Coupon (Cashier Checkout Action)
app.post(['/api/coupons/redeem', '/api/brands/:brandSlug/coupons/redeem'], async (req, res) => {
  try {
    const brandSlugInput = req.params.brandSlug || req.body.brandSlug || req.body.brand || 'popular-electricals-qatar';
    const rawCode = (req.body.couponCode || req.body.code || req.body.couponId || req.body.id || '').trim().toUpperCase();
    const cashierId = req.body.cashierId || req.body.adminId || null;

    if (!rawCode) {
      return res.status(400).json({ success: false, error: 'Coupon code or ID is required' });
    }

    const brandRes = await resolveBrandAndAliases(brandSlugInput);
    if (!brandRes) {
      return res.status(404).json({ success: false, error: `Brand '${brandSlugInput}' not found` });
    }

    // Find coupon by couponCode or id
    const coupon = await prisma.rewardCoupon.findFirst({
      where: {
        OR: [
          { couponCode: rawCode },
          { id: rawCode },
          { id: req.body.id || req.body.couponId || '' }
        ]
      }
    });

    if (!coupon) {
      return res.status(404).json({ success: false, error: `Coupon '${rawCode}' not found` });
    }

    // Verify brand ownership with proper parentheses
    const isBrandMatch = brandRes.matchesBrandSlug(coupon.brandSlug) || brandRes.matchesBrandId(coupon.brandSlug);
    if (!isBrandMatch) {
      return res.status(404).json({ success: false, error: 'Coupon not found for this brand' });
    }

    if (coupon.status === 'REDEEMED') {
      return res.status(400).json({ 
        success: false, 
        error: 'Coupon is already redeemed',
        redeemedAt: coupon.redeemedAt
      });
    }

    if (coupon.status === 'CANCELLED') {
      return res.status(400).json({ success: false, error: 'Coupon has been cancelled' });
    }

    // Mark as REDEEMED
    const updated = await prisma.rewardCoupon.update({
      where: { id: coupon.id },
      data: {
        status: 'REDEEMED',
        redeemedAt: new Date(),
        redeemedBy: cashierId
      }
    });

    return res.json({
      success: true,
      message: 'Coupon marked as REDEEMED successfully.',
      coupon: {
        id: updated.id,
        couponCode: updated.couponCode,
        rewardTitle: updated.rewardTitle,
        customerName: updated.customerName,
        customerPhone: updated.customerPhone,
        status: updated.status,
        redeemedAt: updated.redeemedAt
      }
    });
  } catch (error) {
    console.error('[Redeem Coupon Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to redeem coupon' });
  }
});

// ====================================================
// WEEKLY RARE IN-GAME LULU 100 QAR SPECIAL VOUCHER
// ====================================================

// In-memory cache for LuLu voucher tokens with 10-minute TTL
const sessionLuluTokenMap = new Map();

function saveSessionLuluToken(sessionId, voucherToken) {
  if (!sessionId || !voucherToken) return;
  const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes
  sessionLuluTokenMap.set(sessionId, { voucherToken, expiresAt });
}

function verifySessionLuluToken(sessionId, voucherToken) {
  if (!sessionId || !voucherToken) return false;
  const record = sessionLuluTokenMap.get(sessionId);
  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    sessionLuluTokenMap.delete(sessionId);
    return false;
  }
  const isValid = record.voucherToken === voucherToken;
  if (isValid) {
    sessionLuluTokenMap.delete(sessionId); // Single-use consumption
  }
  return isValid;
}

// Endpoint 5: Claim LuLu 100 QAR In-Game Special Voucher (Collision Collect)
app.post([
  '/api/rewards/claim-lulu',
  '/api/brands/:brandSlug/rewards/claim-lulu',
  '/api/coupons/claim-lulu'
], async (req, res) => {
  const { sessionId, voucherToken, userId, phone } = req.body;
  const brandSlugInput = req.params.brandSlug || req.body.brandSlug || req.body.brand || 'popular-electricals-qatar';

  try {
    const brandRes = await resolveBrandAndAliases(brandSlugInput);
    if (!brandRes) {
      return res.status(404).json({ success: false, error: `Brand '${brandSlugInput}' not found` });
    }
    const brand = brandRes.primary;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify single-use token authenticity
      const valid = verifySessionLuluToken(sessionId, voucherToken);
      if (!valid) {
        throw new Error('INVALID_TOKEN');
      }

      // 2. Lock & check if already claimed this week
      const now = new Date();
      const { startOfWeek, endOfWeek } = getQatarWeeklyTimeWindow(now);
      const weekLabel = formatQatarWeekLabel(startOfWeek, endOfWeek);

      let weekRecord = await tx.weeklySpecialGift.findFirst({
        where: {
          brandSlug: brand.slug,
          weekStart: { lte: now },
          weekEnd: { gte: now },
          giftType: 'LULU_100_QAR',
        }
      });

      if (weekRecord && weekRecord.isClaimed) {
        throw new Error('ALREADY_CLAIMED_THIS_WEEK');
      }

      // 3. Resolve user details
      let user = null;
      if (userId) {
        user = await tx.user.findUnique({ where: { id: userId } });
      }
      if (!user && phone) {
        const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
        user = await tx.user.findUnique({ where: { phone: cleanPhone } });
      }
      if (!user) {
        user = {
          id: userId || null,
          name: req.body.name || req.body.playerName || 'Lucky Runner',
          phone: phone || null
        };
      }

      // 4. Mint unique coupon code: LULU-XXXX-QAT
      let couponCode = '';
      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 10) {
        const codeDigits = Math.floor(1000 + Math.random() * 9000);
        couponCode = `LULU-${codeDigits}-QAT`;
        const exists = await tx.rewardCoupon.findUnique({ where: { couponCode } });
        if (!exists) isUnique = true;
        attempts++;
      }

      // 5. Create active RewardCoupon record
      const coupon = await tx.rewardCoupon.create({
        data: {
          brandSlug: brand.slug,
          customerId: user.id || null,
          customerName: user.name || 'Valued Customer',
          customerPhone: user.phone || 'N/A',
          rewardId: 'rw_lulu_100',
          rewardTitle: 'LuLu 100 QAR In-Game Special Voucher',
          couponCode,
          discountValue: '100 QAR VOUCHER',
          redeemedCoins: 0, // Free surprise gift!
          status: 'PENDING',
        }
      });

      // 6. Mark week's special gift as claimed
      if (weekRecord) {
        await tx.weeklySpecialGift.update({
          where: { id: weekRecord.id },
          data: {
            isClaimed: true,
            claimedAt: new Date(),
            winnerUserId: user.id || null,
            couponCode,
          }
        });
      } else {
        await tx.weeklySpecialGift.create({
          data: {
            brandSlug: brand.slug,
            weekLabel,
            weekStart: startOfWeek,
            weekEnd: endOfWeek,
            giftType: 'LULU_100_QAR',
            isClaimed: true,
            claimedAt: new Date(),
            winnerUserId: user.id || null,
            couponCode
          }
        });
      }

      return coupon;
    });

    return res.status(201).json({
      success: true,
      message: 'Congratulations! You claimed the Weekly LuLu 100 QAR Voucher!',
      coupon: {
        id: result.id,
        couponCode: result.couponCode,
        rewardTitle: result.rewardTitle,
        discountValue: result.discountValue,
        customerName: result.customerName,
        customerPhone: result.customerPhone,
        status: result.status,
        claimedAt: result.claimedAt
      }
    });
  } catch (err) {
    if (err.message === 'ALREADY_CLAIMED_THIS_WEEK') {
      return res.status(409).json({
        success: false,
        error: 'This week’s LuLu gift has already been claimed by another runner.'
      });
    }
    if (err.message === 'INVALID_TOKEN') {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired LuLu voucher token.'
      });
    }
    console.error('[Claim LuLu Error]:', err);
    return res.status(400).json({ success: false, error: err.message || 'Claim failed' });
  }
});

// Endpoint 6: Check LuLu Voucher Weekly Status (Public query)
app.get([
  '/api/rewards/lulu-status',
  '/api/brands/:brandSlug/rewards/lulu-status'
], async (req, res) => {
  try {
    const brandSlugInput = req.params.brandSlug || req.query.brand || req.query.brandSlug || 'popular-electricals-qatar';
    const brandRes = await resolveBrandAndAliases(brandSlugInput);
    if (!brandRes) {
      return res.status(404).json({ success: false, error: `Brand '${brandSlugInput}' not found` });
    }

    const now = new Date();
    const { startOfWeek, endOfWeek } = getQatarWeeklyTimeWindow(now);
    const weekLabel = formatQatarWeekLabel(startOfWeek, endOfWeek);

    const weekGift = await prisma.weeklySpecialGift.findFirst({
      where: {
        brandSlug: brandRes.primary.slug,
        weekStart: { lte: now },
        weekEnd: { gte: now },
        giftType: 'LULU_100_QAR'
      },
      include: {
        user: { select: { id: true, name: true } }
      }
    });

    return res.json({
      success: true,
      brand: brandRes.primary.slug,
      weekLabel,
      isClaimed: weekGift ? weekGift.isClaimed : false,
      claimedAt: weekGift?.claimedAt || null,
      winnerName: weekGift?.user?.name || null
    });
  } catch (error) {
    console.error('[LuLu Status Error]:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve LuLu status' });
  }
});

// ====================================================
// CORE ADMIN & BRAND REGISTRATION MANAGEMENT SYSTEM
// ====================================================

// Helper for secure password hashing using Node native crypto (PBKDF2/scrypt)


function hashAdminPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyAdminPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(hash, 'hex'));
}

// 1. Register a Brand with Superadmins and optional Admins
app.post('/api/admin/brands/register', async (req, res) => {
  try {
    const { brandName, gameName, brandSlug, webhookSecret, superadmins = [], admins = [] } = req.body;

    if (!brandName || !brandName.trim()) {
      return res.status(400).json({ error: 'Brand name is required' });
    }
    if (!gameName || !gameName.trim()) {
      return res.status(400).json({ error: 'Game name is required' });
    }
    if (!superadmins || !Array.isArray(superadmins) || superadmins.length === 0) {
      return res.status(400).json({ error: 'At least one Superadmin is required' });
    }

    // Validate superadmins format
    for (let i = 0; i < superadmins.length; i++) {
      const sa = superadmins[i];
      if (!sa.username || !sa.username.trim()) {
        return res.status(400).json({ error: `Superadmin #${i + 1} requires a valid username` });
      }
      if (!sa.password || sa.password.length < 6) {
        return res.status(400).json({ error: `Superadmin #${i + 1} password must be at least 6 characters` });
      }
    }

    // Validate optional admins format
    if (admins && Array.isArray(admins)) {
      for (let i = 0; i < admins.length; i++) {
        const ad = admins[i];
        if (!ad.email || !ad.email.includes('@')) {
          return res.status(400).json({ error: `Admin #${i + 1} requires a valid email address` });
        }
        if (!ad.password || ad.password.length < 6) {
          return res.status(400).json({ error: `Admin #${i + 1} password must be at least 6 characters` });
        }
      }
    }

    // Generate safe slug
    const computedSlug = (brandSlug || brandName)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Transaction to create Brand + Superadmins + Admins atomically
    const result = await prisma.$transaction(async (tx) => {
      // Check if brand slug already exists
      const existing = await tx.brand.findUnique({
        where: { slug: computedSlug }
      });
      if (existing) {
        throw new Error(`A brand with slug "${computedSlug}" already exists`);
      }

      // Create Brand
      const brand = await tx.brand.create({
        data: {
          slug: computedSlug,
          name: brandName.trim(),
          gameName: gameName.trim(),
          webhookSecret: webhookSecret || `gf_whsec_${computedSlug}_${crypto.randomBytes(8).toString('hex')}`,
          apiKey: `gf_live_${computedSlug}_${crypto.randomBytes(12).toString('hex')}`
        }
      });

      const createdSuperadmins = [];
      for (const sa of superadmins) {
        const cleanUsername = sa.username.trim().toLowerCase();
        // Check username uniqueness
        const userWithUsername = await tx.user.findFirst({
          where: { username: cleanUsername }
        });
        if (userWithUsername) {
          throw new Error(`Username "${cleanUsername}" is already taken`);
        }

        const emailAlias = `${cleanUsername}@${computedSlug}.gamefaktory.com`;
        const hashedPassword = hashAdminPassword(sa.password);

        const superUser = await tx.user.create({
          data: {
            username: cleanUsername,
            name: sa.name || sa.username,
            email: emailAlias,
            password: hashedPassword,
            role: 'SUPERADMIN',
            brandId: brand.id
          }
        });
        createdSuperadmins.push({
          id: superUser.id,
          username: superUser.username,
          name: superUser.name,
          email: superUser.email,
          role: superUser.role
        });
      }

      const createdAdmins = [];
      if (admins && Array.isArray(admins)) {
        for (const ad of admins) {
          const cleanEmail = ad.email.trim().toLowerCase();
          const existingEmail = await tx.user.findUnique({
            where: { email: cleanEmail }
          });
          if (existingEmail) {
            throw new Error(`Email "${cleanEmail}" is already registered`);
          }

          const hashedPassword = hashAdminPassword(ad.password);
          const adminUser = await tx.user.create({
            data: {
              email: cleanEmail,
              username: ad.username ? ad.username.trim().toLowerCase() : cleanEmail.split('@')[0],
              name: ad.name || cleanEmail.split('@')[0],
              password: hashedPassword,
              role: 'ADMIN',
              brandId: brand.id
            }
          });
          createdAdmins.push({
            id: adminUser.id,
            email: adminUser.email,
            username: adminUser.username,
            name: adminUser.name,
            role: adminUser.role
          });
        }
      }

      return { brand, createdSuperadmins, createdAdmins };
    });

    console.log(`[Core Admin] Registered Brand "${result.brand.name}" (${result.brand.slug}) with ${result.createdSuperadmins.length} Superadmins and ${result.createdAdmins.length} Admins.`);
    return res.status(201).json({
      success: true,
      message: `Brand "${result.brand.name}" registered successfully`,
      brand: result.brand,
      superadmins: result.createdSuperadmins,
      admins: result.createdAdmins
    });
  } catch (error) {
    console.error('[Brand Registration Error]:', error);
    return res.status(400).json({ error: error.message || 'Failed to register brand' });
  }
});

// 2. List all registered brands with their games and admin rosters
app.get('/api/admin/brands', async (req, res) => {
  try {
    const brands = await prisma.brand.findMany({
      include: {
        admins: {
          select: {
            id: true,
            username: true,
            email: true,
            name: true,
            role: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            tokens: true,
            sessions: true,
            invoices: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ success: true, count: brands.length, brands });
  } catch (error) {
    console.error('[List Brands Error]:', error);
    return res.status(500).json({ error: 'Failed to retrieve brands' });
  }
});

// 3. Delete a Brand by ID (Cascades cleanly to tokens, sessions, credits, and admins)
app.delete('/api/admin/brands/:brandId', async (req, res) => {
  try {
    const { brandId } = req.params;
    const brand = await prisma.brand.findFirst({
      where: {
        OR: [
          { id: brandId },
          { slug: brandId }
        ]
      }
    });
    if (!brand) return res.status(404).json({ error: 'Brand not found' });

    await prisma.$transaction(async (tx) => {
      await tx.gameSession.deleteMany({ where: { brandId: brand.id } });
      await tx.qrToken.deleteMany({ where: { brandId: brand.id } });
      await tx.gameplayCredit.deleteMany({ where: { brandId: brand.id } });
      await tx.invoice.deleteMany({ where: { brandId: brand.id } });
      await tx.user.deleteMany({ where: { brandId: brand.id } });
      await tx.brand.delete({ where: { id: brand.id } });
    });

    console.log(`[Core Admin] Deleted brand "${brand.name}" (${brand.slug}) and all related records.`);
    return res.json({ success: true, message: `Brand "${brand.name}" deleted successfully` });
  } catch (error) {
    console.error('[Delete Brand Error]:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete brand' });
  }
});

// 4. Wipe All Brands (Reset whole multi-tenant database for clean slate)
app.post('/api/admin/brands/reset-all', async (req, res) => {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.gameSession.deleteMany({});
      await tx.qrToken.deleteMany({});
      await tx.gameplayCredit.deleteMany({});
      await tx.invoice.deleteMany({});
      await tx.session.deleteMany({});
      await tx.account.deleteMany({});
      await tx.user.deleteMany({});
      await tx.brand.deleteMany({});
    });

    console.log('[Core Admin] Completely wiped all brand and tenant records.');
    return res.json({ success: true, message: 'All brands and records have been deleted successfully.' });
  } catch (error) {
    console.error('[Reset Brands Error]:', error);
    return res.status(500).json({ error: error.message || 'Failed to reset brands' });
  }
});


// 3. Admin / Superadmin Login Verification (for brand dashboard access)
app.post('/api/admin/login', async (req, res) => {
  try {
    const { identifier, password, brandSlug } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/Email and password are required' });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: cleanIdentifier },
          { email: cleanIdentifier }
        ]
      },
      include: {
        brand: true
      }
    });

    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!['SUPERADMIN', 'ADMIN', 'CORE_ADMIN'].includes(user.role)) {
      return res.status(403).json({ error: 'Access denied: User is not an authorized administrator' });
    }

    // Optional Brand Isolation check (supporting aliases)
    if (brandSlug && user.brand && user.role !== 'CORE_ADMIN') {
      const brandRes = await resolveBrandAndAliases(brandSlug);
      if (!brandRes || !brandRes.matchesBrandId(user.brand.id)) {
        return res.status(403).json({ error: `This administrator account does not belong to ${brandSlug}` });
      }
    }

    const isValid = verifyAdminPassword(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = crypto.randomBytes(32).toString('hex');

    return res.json({
      success: true,
      message: 'Authentication successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        brandId: user.brandId,
        brand: user.brand ? {
          id: user.brand.id,
          name: user.brand.name,
          slug: user.brand.slug,
          gameName: user.brand.gameName
        } : null
      }
    });
  } catch (error) {
    console.error('[Admin Login Error]:', error);
    return res.status(500).json({ error: 'Internal login error' });
  }
});

// Basic Test Route
app.get('/', (req, res) => {
  res.send('GameFaktory Backend with Better Auth is running!');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

