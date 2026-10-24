require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { auth } = require('./auth');

const app = express();

// Middleware
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/
  ], // Allow requests from any Vite frontend port
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

    // Strict multi-tenant brand isolation check
    if (token.brand.slug !== brandSlug) {
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

// ----------------------------------------------------
// BRAND-ISOLATED GAMEPLAY SESSIONS & SCORES
// ----------------------------------------------------

// Helper to resolve or provision a player for brand session linkage
async function resolveSessionUser(userId, phone, brandId) {
  if (userId) {
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (existing) return existing;
  }
  if (phone) {
    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
    const existing = await prisma.user.findUnique({ where: { phone: cleanPhone } });
    if (existing) return existing;

    // Create user by phone if registering inline
    return await prisma.user.create({
      data: {
        email: `runner_${cleanPhone}@popular.sparky`,
        phone: cleanPhone,
        name: 'Sparky Runner',
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
        name: 'Showroom Guest',
        phone: '0000000000',
      },
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

      if (!tokenCode) {
        return res.status(400).json({ success: false, error: 'Token is required' });
      }

      const brand = await prisma.brand.findUnique({ where: { slug: brandSlug } });
      if (!brand) {
        return res.status(404).json({ success: false, error: `Brand '${brandSlug}' not found`, livesRemaining: 0 });
      }

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

      // Multi-tenant brand isolation check
      if (token.brand.slug !== brandSlug) {
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

      // Resolve player linked to this session
      const targetUserId = userId || token.userId;
      const user = await resolveSessionUser(targetUserId, phone, brand.id);

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

      const brand = await prisma.brand.findUnique({ where: { slug: brandSlug } });
      if (!brand) {
        return res.status(404).json({ success: false, error: `Brand '${brandSlug}' not found` });
      }

      // Query session with strict brand and token verification
      let session = await prisma.gameSession.findUnique({
        where: { sessionToken },
        include: { brand: true, user: true },
      });

      if (!session) {
        // Fallback: If session not found by token, look for active session for this user/brand
        session = await prisma.gameSession.findFirst({
          where: { brandId: brand.id, isCompleted: false },
          orderBy: { startedAt: 'desc' },
          include: { brand: true, user: true },
        });
      }

      if (!session) {
        return res.status(404).json({ success: false, error: 'Invalid or expired game session token.' });
      }

      // Multi-tenant check: ensure session belongs strictly to this brand
      if (session.brandId !== brand.id) {
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

      // Calculate player's brand-specific stats (isolated strictly to this brandId)
      const userBrandSessions = await prisma.gameSession.findMany({
        where: {
          userId: session.userId,
          brandId: brand.id,
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

      const brand = await prisma.brand.findUnique({ where: { slug: brandSlug } });
      if (!brand) return res.status(404).json({ error: `Brand '${brandSlug}' not found` });

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

      // STRICT BRAND ISOLATION: query ONLY sessions matching brandId == brand.id
      const sessions = await prisma.gameSession.findMany({
        where: {
          brandId: brand.id,
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

// 4. Admin / Dashboard Endpoint: Fetch All Players Registered/Played for this Brand Only
app.get(['/api/brands/:brandSlug/players', '/api/players'], async (req, res) => {
  try {
    const brandSlug = (req.params.brandSlug || 'popular').trim().toLowerCase();
    const brand = await prisma.brand.findUnique({ where: { slug: brandSlug } });
    if (!brand) return res.status(404).json({ error: `Brand '${brandSlug}' not found` });

    // Find all completed game sessions for this brand
    const brandSessions = await prisma.gameSession.findMany({
      where: {
        brandId: brand.id,
        isCompleted: true,
      },
      include: { user: true },
      orderBy: { completedAt: 'desc' },
    });

    // 2. Also include users who claimed or have tokens under this brand
    const brandTokens = await prisma.qrToken.findMany({
      where: { brandId: brand.id, userId: { not: null } },
      include: { user: true },
    });

    // 3. Also include users registered or credited under this brand
    const brandCredits = await prisma.gameplayCredit.findMany({
      where: { brandId: brand.id },
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

// Basic Test Route
app.get('/', (req, res) => {
  res.send('GameFaktory Backend with Better Auth is running!');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
