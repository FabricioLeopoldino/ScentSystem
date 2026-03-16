import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { existsSync, mkdirSync } from 'fs';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// ========================================================================
// CORS CONFIGURATION
// ========================================================================
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? true // Allow all origins in production
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 600
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ========================================================================
// POSTGRESQL CONNECTION
// ========================================================================

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not configured!');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false,
  max: 20,
  min: 2,
  idleTimeoutMillis: 20000, // Close idle connections after 20s
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: false, // Don't exit on idle connections
});

// CRITICAL: Handle pool errors to prevent server crashes
pool.on('error', (err, client) => {
  console.error('⚠️ Unexpected database pool error:', err);
  console.error('Client:', client ? 'Active' : 'Unknown');
  // Don't exit - let the pool handle reconnection
});

// CRITICAL: Handle connection errors
pool.on('connect', (client) => {
  client.on('error', (err) => {
    console.error('⚠️ Database client error:', err.message);
    // Connection will be removed from pool automatically
  });
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('✅ Database connected:', res.rows[0].now);
  }
});

// ========================================================================
// IN-MEMORY WEBHOOK LOCK
// Prevents race conditions when two webhook requests arrive simultaneously
// (before either has written to the DB). This is the first line of defense.
// ========================================================================
const processingOrders = new Set();

// ========================================================================
// MULTER
// ========================================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = join(__dirname, '../uploads');
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitizedName}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 1 }
});

app.use('/uploads', express.static(join(__dirname, '../uploads')));

// ========================================================================
// HELPER: Create product in Shopify automatically
// ========================================================================
async function createProductInShopify(product) {
  if (!process.env.SHOPIFY_STORE_NAME || !process.env.SHOPIFY_API_KEY || !process.env.SHOPIFY_API_PASSWORD) {
    throw new Error('Shopify credentials not configured');
  }
  
  const shopifySkus = parseJSONB(product.shopifySkus);
  const productName = product.name;
  
  // Create variants for each SKU type with product name included
  //Para funcionar essa parte voce precisa configurar o ENV no render || SHOPIFY informacoes:
  //API_KEY
  //API_PASSWORD
  //SHOPIFY_STORE_NAME
  //SHOPIFY_SYNC_ENABLED = precisa estar TRUE
  const variants = [];
  const variantDetails = {
    'SA_CA': { 
      title: `${productName} Oil Cartridge (400ml)`, 
      price: '165.00', 
      weight: 400,
      sku_suffix: 'Oil Cartridge (400ml)'
    },
    'SA_HF': { 
      title: `${productName} -500ML Oil Refill Bottle`, 
      price: '150.00', 
      weight: 500,
      sku_suffix: '-500ML Oil Refill Bottle'
    },
    'SA_CDIFF': { 
      title: `${productName} -Oil Refill (700ml)`, 
      price: '275.00', 
      weight: 700,
      sku_suffix: '-Oil Refill (700ml)'
    },
    'SA_1L': { 
      title: `${productName} -1L Oil Refill Bottle`, 
      price: '218.90', 
      weight: 1000,
      sku_suffix: '-1L Oil Refill Bottle'
    },
    'SA_PRO': { 
      title: `${productName} -1L Oil Refill Pro Bottle`, 
      price: '275.00', 
      weight: 1000,
      sku_suffix: '-1L Oil Refill Pro Bottle'
    }
  };
  
  Object.entries(shopifySkus).forEach(([type, sku]) => {
    const details = variantDetails[type];
    if (details) {
      variants.push({
        option1: details.sku_suffix, // Size option value
        title: details.title, // Full variant title with product name
        sku: sku,
        price: details.price,
        weight: details.weight,
        weight_unit: 'g',
        inventory_management: null, // Don't track inventory in Shopify (we track locally)
        inventory_policy: 'continue' // Allow sales even if out of stock
      });
    }
  });
  
  // Create product in DRAFT status
  const shopifyProduct = {
    product: {
      title: product.name,
      body_html: `<p>${product.name}</p><p>Product Code: ${product.productCode}</p>`,
      vendor: product.supplier || 'Scent Australia',
      product_type: 'Fragrance Oil',
      status: 'draft', // DRAFT status - can add images/description manually later
      tags: [product.category, product.tag].filter(Boolean).join(', '),
      options: [
        {
          name: 'Size',
          values: variants.map(v => v.option1)
        }
      ],
      variants: variants
    }
  };
  
  const url = `https://${process.env.SHOPIFY_STORE_NAME}.myshopify.com/admin/api/2024-01/products.json`;
  const auth = Buffer.from(`${process.env.SHOPIFY_API_KEY}:${process.env.SHOPIFY_API_PASSWORD}`).toString('base64');
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`
    },
    body: JSON.stringify(shopifyProduct)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Shopify API error: ${error}`);
  }
  
  const data = await response.json();
  return data.product;
}

// ========================================================================
// HELPER FUNCTIONS
// ========================================================================

const parseJSONB = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (e) {
      return fallback;
    }
  }
  return fallback;
};

// Auto-generate SKUs for OILS
const generateAutoSkus = (category, baseNumber) => {
  const paddedNum = String(baseNumber).padStart(5, '0');
  
  if (category === 'OILS') {
    return {
      SA_CA: `SA_CA_${paddedNum}`,
      SA_1L: `SA_1L_${paddedNum}`,
      SA_CDIFF: `SA_CDIFF_${paddedNum}`,
      SA_PRO: `SA_PRO_${paddedNum}`,
      SA_HF: `SA_HF_${paddedNum}`
    };
  }
  
  if (category === 'RAW_MATERIALS') {
    return {
      SA_RM: `SA_RM_${paddedNum}`
    };
  }
  
  if (category === 'MACHINES_SPARES') {
    return {
      SA_MAC: `SA_MAC_${paddedNum}`
    };
  }
  
  return {};
};

// ========================================================================
// HEALTH CHECK — Smart (não acorda o Neon fora do horário comercial)
// ========================================================================
app.get('/api/health', async (req, res) => {
  const now = new Date();

  // Horário de Sydney (AEDT = UTC+11 / AEST = UTC+10)
  const sydneyDate = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));
  const sydneyHour = sydneyDate.getHours();
  const sydneyDay  = sydneyDate.getDay(); // 0 = Dom, 6 = Sab

  const isWeekday      = sydneyDay >= 1 && sydneyDay <= 5;
  const isBusinessHour = sydneyHour >= 7 && sydneyHour < 17; // 07:00–17:00 Sydney
  const isBusinessTime = isWeekday && isBusinessHour;

  // Fora do horário comercial → responde sem query no banco (Neon não é acordado)
  if (!isBusinessTime) {
    return res.json({
      status: 'ok',
      message: 'Service active (off-hours — DB not queried)',
      timestamp: now.toISOString(),
      businessHours: false
    });
  }

  // Dentro do horário → verifica o banco normalmente
  try {
    const result = await pool.query('SELECT NOW() as now, current_database() as db');
    res.json({
      status: 'ok',
      message: 'Service active',
      timestamp: result.rows[0].now,
      database: result.rows[0].db,
      businessHours: true
    });
  } catch (error) {
    res.status(503).json({ status: 'error', error: error.message });
  }
});

// ========================================================================
// AUTH
// ========================================================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { name, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE name = $1', [name]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const isValid = bcrypt.compareSync(password, user.password);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================================
// USERS
// ========================================================================
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, role, created_at FROM users ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name, password, role } = req.body;
    
    const existing = await pool.query('SELECT id FROM users WHERE name = $1', [name]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, password, role) VALUES ($1, $2, $3) RETURNING id, name, role, created_at',
      [name, hashedPassword, role || 'user']
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    
    if (user.rows.length > 0 && user.rows[0].role === 'admin') {
      return res.status(403).json({ error: 'Cannot delete admin user' });
    }
    
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:id/password', async (req, res) => {
  try {
    const { password } = req.body;
    const userId = parseInt(req.params.id);
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    const result = await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2 RETURNING id',
      [hashedPassword, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================================
// PRODUCTS - WITH AUTO SKU MAPPING & SEQUENTIAL ORDERING
// ========================================================================
app.get('/api/products', async (req, res) => {
  try {
    const { category, search } = req.query;
    
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];
    
    if (category && category !== 'ALL') {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (name ILIKE $${params.length} OR "productCode" ILIKE $${params.length} OR tag ILIKE $${params.length})`;
    }
    
    // ✅ Sequential ordering
    query += ' ORDER BY tag';
    
    const result = await pool.query(query, params);
    
    // Map to camelCase for frontend
    const products = result.rows.map(row => ({
      id: row.id,
      tag: row.tag,
      productCode: row.productCode,
      name: row.name,
      category: row.category,
      sub_category: row.sub_category || '',
      color: row.color || '',
      location: row.location || '',
      bin_location: row.bin_location || '',
      unit: row.unit,
      currentStock: parseFloat(row.currentStock) || 0,
      minStockLevel: parseFloat(row.minStockLevel) || 0,
      supplier: row.supplier || '',
      supplier_code: row.supplier_code || '',
      unitPerBox: parseInt(row.unitPerBox) || 1,
      stockBoxes: parseInt(row.stockBoxes) || 0,
      shopifySkus: parseJSONB(row.shopifySkus),
      incomingOrders: parseJSONB(row.incoming_orders, []),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const row = result.rows[0];
    res.json({
      id: row.id,
      tag: row.tag,
      productCode: row.productCode,
      name: row.name,
      category: row.category,
      sub_category: row.sub_category || '',
      color: row.color || '',
      location: row.location || '',
      bin_location: row.bin_location || '',
      unit: row.unit,
      currentStock: parseFloat(row.currentStock) || 0,
      minStockLevel: parseFloat(row.minStockLevel) || 0,
      supplier: row.supplier || '',
      supplier_code: row.supplier_code || '',
      unitPerBox: parseInt(row.unitPerBox) || 1,
      stockBoxes: parseInt(row.stockBoxes) || 0,
      shopifySkus: parseJSONB(row.shopifySkus),
      incomingOrders: parseJSONB(row.incoming_orders, [])
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { 
      name, category, productCode, tag, unit, currentStock, 
      minStockLevel, shopifySkus, supplier, supplier_code, unitPerBox,
      subCategory, sub_category, color, location, bin_location
    } = req.body;
    
    // Map both camelCase and snake_case
    const finalSubCategory = sub_category || subCategory || null;
    const finalColor = color || null;
    const finalLocation = location || null;
    const finalBinLocation = bin_location || null;
    
    console.log('📥 Received:', { subCategory, sub_category, color, location, bin_location });
    console.log('✅ Using:', { finalSubCategory, finalColor, finalLocation, finalBinLocation });
    
    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }
    
    // Generate new ID (with proper numeric ordering)
    const maxIdResult = await pool.query(
      `SELECT id FROM products 
       WHERE id LIKE $1 
       ORDER BY CAST(SUBSTRING(id FROM '[0-9]+') AS INTEGER) DESC 
       LIMIT 1`,
      [`${category.toUpperCase()}_%`]
    );
    
    let maxNum = 0;
    if (maxIdResult.rows.length > 0) {
      const parts = maxIdResult.rows[0].id.split('_');
      maxNum = parseInt(parts[1]) || 0;
    }
    
    const newNum = maxNum + 1;
    let newId = `${category.toUpperCase()}_${newNum}`;
    
    // Safety check: ensure ID doesn't already exist
    const checkExisting = await pool.query('SELECT id FROM products WHERE id = $1', [newId]);
    if (checkExisting.rows.length > 0) {
      // ID exists, find the next available
      let safeNum = newNum + 1;
      let attempts = 0;
      while (attempts < 100) { // Max 100 attempts
        const testId = `${category.toUpperCase()}_${safeNum}`;
        const exists = await pool.query('SELECT id FROM products WHERE id = $1', [testId]);
        if (exists.rows.length === 0) {
          newId = testId;
          break;
        }
        safeNum++;
        attempts++;
      }
      console.log(`⚠️ ID ${category.toUpperCase()}_${newNum} exists, using ${newId} instead`);
    }
    
    const newTag = tag || `#${category.toUpperCase().substring(0, 2)}${String(newNum).padStart(5, '0')}`;
    const newProductCode = productCode || `${category.toUpperCase()}_${String(newNum).padStart(5, '0')}`;
    const stockBoxes = unitPerBox ? Math.floor((currentStock || 0) / unitPerBox) : 0;
    
    // ✅ Extract number from TAG for SKU generation
    let skuNumber = newNum; // Default: use ID number
    if (tag) {
      // If tag provided, extract number from it
      // Tag format: #SA00275 or #SA275 → extract 275
      const tagMatch = tag.match(/\d+/);
      if (tagMatch) {
        skuNumber = parseInt(tagMatch[0]);
      }
    }
    
    // ✅ Auto-generate SKUs using TAG number (for all categories)
    let finalShopifySkus = shopifySkus || {};
    if (!shopifySkus || Object.keys(shopifySkus).length === 0) {
      finalShopifySkus = generateAutoSkus(category, skuNumber);
      if (Object.keys(finalShopifySkus).length > 0) {
        console.log(`✨ Auto-generated SKUs for ${newId} (${category}) using number ${skuNumber} from tag ${tag || newTag}`);
      }
    }
    
    const skusJson = JSON.stringify(finalShopifySkus);
    
    const result = await pool.query(
      `INSERT INTO products 
       (id, tag, "productCode", name, category, unit, "currentStock", "minStockLevel", 
        "shopifySkus", supplier, "supplier_code", "unitPerBox", "stockBoxes", "incoming_orders",
        sub_category, color, location, bin_location) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) 
       RETURNING *`,
      [
        newId, newTag, newProductCode, name, category, unit || 'units', 
        currentStock || 0, minStockLevel || 0, skusJson, 
        supplier || '', supplier_code || '', unitPerBox || 1, stockBoxes, '[]',
        finalSubCategory, finalColor, finalLocation, finalBinLocation
      ]
    );
    
    const row = result.rows[0];
    
    // ========================================================================
    // OPTIONAL: Auto-create products in Shopify
    //Para funcionar essa parte voce precisa configurar o ENV no render || SHOPIFY informacoes:
    //API_KEY
    //API_PASSWORD
    //SHOPIFY_STORE_NAME
    //SHOPIFY_SYNC_ENABLED = precisa estar TRUE
    // ========================================================================
    if (category === 'OILS' && process.env.SHOPIFY_SYNC_ENABLED === 'true') {
      try {
        await createProductInShopify(row);
        console.log(`✅ Product synced to Shopify: ${row.name}`);
      } catch (shopifyError) {
        console.error('⚠️ Shopify sync failed:', shopifyError.message);
        // Continue anyway - product created locally
      }
    }
    
    res.json({
      id: row.id,
      tag: row.tag,
      productCode: row.productCode,
      name: row.name,
      category: row.category,
      sub_category: row.sub_category || '',
      color: row.color || '',
      location: row.location || '',
      bin_location: row.bin_location || '',
      unit: row.unit,
      currentStock: parseFloat(row.currentStock),
      minStockLevel: parseFloat(row.minStockLevel),
      supplier: row.supplier,
      supplier_code: row.supplier_code,
      unitPerBox: parseInt(row.unitPerBox),
      stockBoxes: parseInt(row.stockBoxes),
      shopifySkus: parseJSONB(row.shopifySkus),
      incoming_orders: []
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const { 
      name, category, productCode, tag, unit, currentStock, 
      minStockLevel, shopifySkus, supplier, supplier_code, unitPerBox,
      subCategory, sub_category, color, location, bin_location
    } = req.body;
    
    // Map both camelCase and snake_case
    const finalSubCategory = sub_category || subCategory;
    const finalColor = color;
    const finalLocation = location;
    const finalBinLocation = bin_location;
    
    console.log('📥 PUT Received:', { subCategory, sub_category, color, location, bin_location });
    console.log('✅ PUT Using:', { finalSubCategory, finalColor, finalLocation, finalBinLocation });
    
    const stockBoxes = unitPerBox && currentStock 
      ? Math.floor(currentStock / unitPerBox) 
      : null;
    
    let skusJson = null;
    if (shopifySkus !== undefined) {
      skusJson = JSON.stringify(shopifySkus);
    }
    
    const result = await pool.query(
      `UPDATE products SET 
       name = COALESCE($1, name),
       category = COALESCE($2, category),
       "productCode" = COALESCE($3, "productCode"),
       tag = COALESCE($4, tag),
       unit = COALESCE($5, unit),
       "currentStock" = COALESCE($6, "currentStock"),
       "minStockLevel" = COALESCE($7, "minStockLevel"),
       "shopifySkus" = COALESCE($8, "shopifySkus"),
       supplier = COALESCE($9, supplier),
       "supplier_code" = COALESCE($10, "supplier_code"),
       "unitPerBox" = COALESCE($11, "unitPerBox"),
       "stockBoxes" = COALESCE($12, "stockBoxes"),
       sub_category = CASE WHEN $13::text IS NOT NULL THEN $13 ELSE sub_category END,
       color = CASE WHEN $14::text IS NOT NULL THEN $14 ELSE color END,
       location = CASE WHEN $15::text IS NOT NULL THEN $15 ELSE location END,
       bin_location = CASE WHEN $16::text IS NOT NULL THEN $16 ELSE bin_location END
       WHERE id = $17
       RETURNING *`,
      [
        name, category, productCode, tag, unit, currentStock, minStockLevel, 
        skusJson, supplier, supplier_code, unitPerBox, stockBoxes,
        finalSubCategory ?? null, finalColor ?? null, finalLocation ?? null, finalBinLocation ?? null, productId
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const row = result.rows[0];
    res.json({
      id: row.id,
      tag: row.tag,
      productCode: row.productCode,
      name: row.name,
      category: row.category,
      sub_category: row.sub_category || '',
      color: row.color || '',
      location: row.location || '',
      bin_location: row.bin_location || '',
      unit: row.unit,
      currentStock: parseFloat(row.currentStock),
      minStockLevel: parseFloat(row.minStockLevel),
      supplier: row.supplier,
      supplier_code: row.supplier_code,
      unitPerBox: parseInt(row.unitPerBox),
      stockBoxes: parseInt(row.stockBoxes),
      shopifySkus: parseJSONB(row.shopifySkus)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const productId = req.params.id;
    await client.query('DELETE FROM transactions WHERE product_id = $1', [productId]);
    
    const result = await client.query(
      'DELETE FROM products WHERE id = $1 RETURNING id, name',
      [productId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Product not found');
    }
    
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ========================================================================
// STOCK OPERATIONS
// ========================================================================
app.post('/api/stock/add', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { productId, quantity, notes, shopifyOrderId } = req.body;
    
    if (!productId || !quantity || quantity <= 0) {
      throw new Error('Invalid input');
    }
    
    const productResult = await client.query(
      'SELECT * FROM products WHERE id = $1 FOR UPDATE',
      [productId]
    );
    
    if (productResult.rows.length === 0) {
      throw new Error('Product not found');
    }
    
    const product = productResult.rows[0];
    const newStock = parseFloat(product.currentStock) + parseFloat(quantity);
    
    await client.query(
      'UPDATE products SET "currentStock" = $1, "stockBoxes" = $2 WHERE id = $3',
      [newStock, Math.floor(newStock / product.unitPerBox), productId]
    );
    
    await client.query(
      `INSERT INTO transactions 
       (product_id, product_code, product_name, category, type, quantity, unit, balance_after, notes, shopify_order_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [productId, product.productCode || product.tag, product.name, product.category, 'add', quantity, product.unit, newStock, notes || '', shopifyOrderId || null]
    );
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      newStock,
      product: {
        ...product,
        currentStock: newStock
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.post('/api/stock/remove', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { productId, quantity, notes, shopifyOrderId } = req.body;
    
    if (!productId || !quantity || quantity <= 0) {
      throw new Error('Invalid input');
    }
    
    const productResult = await client.query(
      'SELECT * FROM products WHERE id = $1 FOR UPDATE',
      [productId]
    );
    
    if (productResult.rows.length === 0) {
      throw new Error('Product not found');
    }
    
    const product = productResult.rows[0];
    const newStock = parseFloat(product.currentStock) - parseFloat(quantity);
    
    // Allow negative stock to track discrepancies
    
    await client.query(
      'UPDATE products SET "currentStock" = $1, "stockBoxes" = $2 WHERE id = $3',
      [newStock, Math.floor(newStock / product.unitPerBox), productId]
    );
    
    await client.query(
      `INSERT INTO transactions 
       (product_id, product_code, product_name, category, type, quantity, unit, balance_after, notes, shopify_order_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [productId, product.productCode || product.tag, product.name, product.category, 'remove', quantity, product.unit, newStock, notes || '', shopifyOrderId || null]
    );
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      newStock,
      product: {
        ...product,
        currentStock: newStock
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ========================================================================
// STOCK ADJUST - Manual stock adjustments (add or remove)
// ========================================================================
app.post('/api/stock/adjust', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { productId, quantity, type, note } = req.body;
    
    if (!productId || !quantity || !type) {
      throw new Error('Missing required fields: productId, quantity, type');
    }
    
    if (!['add', 'remove'].includes(type)) {
      throw new Error('Type must be either "add" or "remove"');
    }
    
    const productResult = await client.query(
      'SELECT * FROM products WHERE id = $1',
      [productId]
    );
    
    if (productResult.rows.length === 0) {
      throw new Error('Product not found');
    }
    
    const product = productResult.rows[0];
    const currentStock = parseFloat(product.currentStock) || 0;
    const adjustQuantity = parseFloat(quantity);
    
    let newStock;
    if (type === 'add') {
      newStock = currentStock + adjustQuantity;
    } else {
      newStock = currentStock - adjustQuantity;
      // Allow negative stock to track discrepancies
    }
    
    // Update product stock
    await client.query(
      'UPDATE products SET "currentStock" = $1, "stockBoxes" = $2 WHERE id = $3',
      [newStock, Math.floor(newStock / (product.unitPerBox || 1)), productId]
    );
    
    // Create transaction record
    await client.query(
      `INSERT INTO transactions 
       (product_id, product_code, product_name, category, type, quantity, unit, balance_after, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        productId,
        product.productCode || product.tag, // Add product code
        product.name, 
        product.category, 
        type, 
        adjustQuantity, 
        product.unit || 'units', 
        newStock, 
        note || `Manual ${type} adjustment`
      ]
    );
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      newStock,
      product: {
        ...product,
        currentStock: newStock,
        stockBoxes: Math.floor(newStock / (product.unitPerBox || 1))
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ========================================================================
// TRANSACTIONS
// ========================================================================
app.get('/api/transactions', async (req, res) => {
  try {
    const { limit = 100, offset = 0, productId, type, category } = req.query;
    
    let query = 'SELECT * FROM transactions WHERE 1=1';
    const params = [];
    
    if (productId) {
      params.push(productId);
      query += ` AND product_id = $${params.length}`;
    }
    
    if (type) {
      params.push(type);
      query += ` AND type = $${params.length}`;
    }
    
    if (category && category !== 'ALL') {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    
    query += ' ORDER BY created_at DESC, id DESC';
    
    params.push(parseInt(limit));
    query += ` LIMIT $${params.length}`;
    
    params.push(parseInt(offset));
    query += ` OFFSET $${params.length}`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================================
// DASHBOARD
// ========================================================================
app.get('/api/dashboard', async (req, res) => {
  try {
    const [productsResult, transactionsResult, lowStockResult] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM products'),
      pool.query('SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10'),
      pool.query(`
        SELECT COUNT(*) as count 
        FROM products 
        WHERE "currentStock" < "minStockLevel"
      `)
    ]);
    
    const oilsVolume = await pool.query(`
      SELECT COALESCE(SUM("currentStock"), 0) as total 
      FROM products 
      WHERE category = 'OILS'
    `);
    
    res.json({
      totalProducts: parseInt(productsResult.rows[0].count),
      lowStockCount: parseInt(lowStockResult.rows[0].count),
      totalStockValue: {
        oils: Math.round(parseFloat(oilsVolume.rows[0].total) * 100) / 100
      },
      recentTransactions: transactionsResult.rows
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================================================
// BOM
// ========================================================================
app.get('/api/bom', async (req, res) => {
  try {
    const { variant } = req.query;
    
    let query = 'SELECT * FROM bom';
    const params = [];
    
    if (variant) {
      params.push(variant);
      query += ' WHERE variant = $1';
    }
    
    query += ' ORDER BY variant, seq';
    
    const result = await pool.query(query, params);
    
    // Group by variant
    const bomGrouped = {};
    result.rows.forEach(row => {
      if (!bomGrouped[row.variant]) {
        bomGrouped[row.variant] = [];
      }
      bomGrouped[row.variant].push({
        seq: row.seq,
        componentCode: row.component_code,
        componentName: row.component_name,
        quantity: parseFloat(row.quantity)
      });
    });
    
    res.json(bomGrouped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bom', async (req, res) => {
  try {
    const { variant, componentCode, componentName, quantity } = req.body;
    
    const existing = await pool.query(
      'SELECT * FROM bom WHERE variant = $1 AND component_code = $2',
      [variant, componentCode]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Component already exists in this BOM' });
    }
    
    const seqResult = await pool.query(
      'SELECT COALESCE(MAX(seq), 0) + 1 as next_seq FROM bom WHERE variant = $1',
      [variant]
    );
    
    await pool.query(
      `INSERT INTO bom (variant, seq, component_code, component_name, quantity) 
       VALUES ($1, $2, $3, $4, $5)`,
      [variant, seqResult.rows[0].next_seq, componentCode, componentName, quantity]
    );
    
    const result = await pool.query(
      'SELECT * FROM bom WHERE variant = $1 ORDER BY seq',
      [variant]
    );
    
    const components = result.rows.map(row => ({
      seq: row.seq,
      componentCode: row.component_code,
      componentName: row.component_name,
      quantity: parseFloat(row.quantity)
    }));
    
    res.json({ success: true, bom: components });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/bom/:variant/component/:componentCode', async (req, res) => {
  try {
    const { variant, componentCode } = req.params;
    const { componentName, quantity } = req.body;
    
    const result = await pool.query(
      `UPDATE bom SET 
       component_name = COALESCE($1, component_name),
       quantity = COALESCE($2, quantity)
       WHERE variant = $3 AND component_code = $4
       RETURNING *`,
      [componentName, quantity, variant, componentCode]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Component not found' });
    }
    
    const allComponents = await pool.query(
      'SELECT * FROM bom WHERE variant = $1 ORDER BY seq',
      [variant]
    );
    
    const components = allComponents.rows.map(row => ({
      seq: row.seq,
      componentCode: row.component_code,
      componentName: row.component_name,
      quantity: parseFloat(row.quantity)
    }));
    
    res.json({ success: true, bom: components });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/bom/:variant/component/:componentCode', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { variant, componentCode } = req.params;
    
    const deleteResult = await client.query(
      'DELETE FROM bom WHERE variant = $1 AND component_code = $2 RETURNING id',
      [variant, componentCode]
    );
    
    if (deleteResult.rows.length === 0) {
      throw new Error('Component not found');
    }
    
    const components = await client.query(
      'SELECT * FROM bom WHERE variant = $1 ORDER BY seq',
      [variant]
    );
    
    for (let i = 0; i < components.rows.length; i++) {
      await client.query(
        'UPDATE bom SET seq = $1 WHERE id = $2',
        [i + 1, components.rows[i].id]
      );
    }
    
    await client.query('COMMIT');
    
    const result = await pool.query(
      'SELECT * FROM bom WHERE variant = $1 ORDER BY seq',
      [variant]
    );
    
    const updatedComponents = result.rows.map(row => ({
      seq: row.seq,
      componentCode: row.component_code,
      componentName: row.component_name,
      quantity: parseFloat(row.quantity)
    }));
    
    res.json({ success: true, bom: updatedComponents });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ========================================================================
// DIFFUSER MACHINE BOM
// ========================================================================

app.get('/api/diffuser-bom', async (req, res) => {
  try {
    const { machineType } = req.query;
    
    let query = 'SELECT * FROM diffuser_bom';
    const params = [];
    
    if (machineType) {
      params.push(machineType);
      query += ' WHERE machine_type = $1';
    }
    
    query += ' ORDER BY machine_type, seq';
    
    const result = await pool.query(query, params);
    
    // Group by machine type
    const bomGrouped = {};
    result.rows.forEach(row => {
      if (!bomGrouped[row.machine_type]) {
        bomGrouped[row.machine_type] = [];
      }
      bomGrouped[row.machine_type].push({
        id: row.id,
        seq: row.seq,
        componentCode: row.component_code,
        componentName: row.component_name,
        quantity: parseFloat(row.quantity)
      });
    });
    
    res.json(bomGrouped);
  } catch (error) {
    console.error('Get diffuser BOM error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/diffuser-bom', async (req, res) => {
  try {
    const { machineType, componentCode, componentName, quantity } = req.body;
    
    // Check if component already exists
    const existing = await pool.query(
      'SELECT * FROM diffuser_bom WHERE machine_type = $1 AND component_code = $2',
      [machineType, componentCode]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Component already exists in this BOM' });
    }
    
    // Get next sequence number
    const seqResult = await pool.query(
      'SELECT COALESCE(MAX(seq), 0) + 1 as next_seq FROM diffuser_bom WHERE machine_type = $1',
      [machineType]
    );
    
    // Insert component
    await pool.query(
      `INSERT INTO diffuser_bom (machine_type, seq, component_code, component_name, quantity) 
       VALUES ($1, $2, $3, $4, $5)`,
      [machineType, seqResult.rows[0].next_seq, componentCode, componentName, quantity || 1]
    );
    
    // Return updated BOM
    const result = await pool.query(
      'SELECT * FROM diffuser_bom WHERE machine_type = $1 ORDER BY seq',
      [machineType]
    );
    
    const components = result.rows.map(row => ({
      id: row.id,
      seq: row.seq,
      componentCode: row.component_code,
      componentName: row.component_name,
      quantity: parseFloat(row.quantity)
    }));
    
    res.json({ success: true, bom: components });
  } catch (error) {
    console.error('Add diffuser BOM component error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/diffuser-bom/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { componentName, quantity } = req.body;
    
    // Update component
    const updateResult = await pool.query(
      `UPDATE diffuser_bom SET 
       component_name = COALESCE($1, component_name),
       quantity = COALESCE($2, quantity),
       updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING machine_type`,
      [componentName, quantity, id]
    );
    
    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Component not found' });
    }
    
    const machineType = updateResult.rows[0].machine_type;
    
    // Return updated BOM
    const result = await pool.query(
      'SELECT * FROM diffuser_bom WHERE machine_type = $1 ORDER BY seq',
      [machineType]
    );
    
    const components = result.rows.map(row => ({
      id: row.id,
      seq: row.seq,
      componentCode: row.component_code,
      componentName: row.component_name,
      quantity: parseFloat(row.quantity)
    }));
    
    res.json({ success: true, bom: components });
  } catch (error) {
    console.error('Update diffuser BOM component error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/diffuser-bom/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    
    // Delete component and get machine type
    const deleteResult = await client.query(
      'DELETE FROM diffuser_bom WHERE id = $1 RETURNING machine_type',
      [id]
    );
    
    if (deleteResult.rows.length === 0) {
      throw new Error('Component not found');
    }
    
    const machineType = deleteResult.rows[0].machine_type;
    
    // Resequence remaining components
    const components = await client.query(
      'SELECT * FROM diffuser_bom WHERE machine_type = $1 ORDER BY seq',
      [machineType]
    );
    
    for (let i = 0; i < components.rows.length; i++) {
      await client.query(
        'UPDATE diffuser_bom SET seq = $1 WHERE id = $2',
        [i + 1, components.rows[i].id]
      );
    }
    
    await client.query('COMMIT');
    
    // Return updated BOM
    const result = await pool.query(
      'SELECT * FROM diffuser_bom WHERE machine_type = $1 ORDER BY seq',
      [machineType]
    );
    
    const updatedComponents = result.rows.map(row => ({
      id: row.id,
      seq: row.seq,
      componentCode: row.component_code,
      componentName: row.component_name,
      quantity: parseFloat(row.quantity)
    }));
    
    res.json({ success: true, bom: updatedComponents });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete diffuser BOM component error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ========================================================================
// ATTACHMENTS 
// Secao desabilitada pois esta com problema quando eu faco o upload do arquivo o mesmo esta crashando o banco de dados, nao irei arrumar esta secao ainda1
//Possivel causa banco de dados+code (Fabricio Leopoldino 23/02/26
// ========================================================================
app.get('/api/attachments', async (req, res) => {
  try {
    const { oilId, fileType } = req.query;
    
    let query = 'SELECT * FROM attachments WHERE 1=1';
    const params = [];
    
    if (oilId) {
      params.push(oilId);
      query += ` AND associated_oil_id = $${params.length}`;
    }
    
    if (fileType) {
      params.push(`%${fileType}%`);
      query += ` AND file_type ILIKE $${params.length}`;
    }
    
    query += ' ORDER BY upload_date DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/attachments/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { associatedOilId, associatedOilName, uploadedBy, notes } = req.body;
    
    const result = await pool.query(
      `INSERT INTO attachments 
       (file_name, stored_file_name, file_type, file_size, file_path, 
        associated_oil_id, associated_oil_name, uploaded_by, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [
        req.file.originalname,
        req.file.filename,
        req.file.mimetype,
        req.file.size,
        `/uploads/${req.file.filename}`,
        associatedOilId || 'GENERAL',
        associatedOilName || 'General Documents',
        uploadedBy || 'admin',
        notes || ''
      ]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/attachments/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM attachments WHERE id = $1 RETURNING stored_file_name',
      [parseInt(req.params.id)]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    
    const filePath = join(__dirname, '../uploads', result.rows[0].stored_file_name);
    if (existsSync(filePath)) {
      await fs.unlink(filePath);
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================================
// EXPORTS
// ========================================================================
app.get('/api/export/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY tag');
    const products = result.rows.map(row => ({
      id: row.id,
      tag: row.tag,
      productCode: row.productCode,
      name: row.name,
      category: row.category,
      currentStock: parseFloat(row.currentStock),
      minStockLevel: parseFloat(row.minStockLevel),
      supplier: row.supplier,
      shopifySkus: parseJSONB(row.shopifySkus)
    }));
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/export/transactions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM transactions ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================================
// HELPER: Get volume from SKU type
// ========================================================================
const getVolumeFromSKU = (sku) => {
  const skuUpper = sku.toUpperCase();
  
  // Volume mapping
  if (skuUpper.includes('SA_CA')) return 400;      // Cartridge = 400ml
  if (skuUpper.includes('SA_1L')) return 1000;     // 1 Liter = 1000ml
  if (skuUpper.includes('SA_HF')) return 500;      // Half = 500ml
  if (skuUpper.includes('SA_PRO')) return 1000;    // Pro = 1000ml
  if (skuUpper.includes('SA_CDIFF')) return 700;   // Bottle Diffuser = 700ml
  
  return 1; // Default fallback
};

// ========================================================================
// HELPER: Get variant from SKU
// ========================================================================
const getVariantFromSKU = (sku) => {
  const skuUpper = sku.toUpperCase();
  
  if (skuUpper.includes('SA_CA')) return 'SA_CA';
  if (skuUpper.includes('SA_1L')) return 'SA_1L';
  if (skuUpper.includes('SA_HF')) return 'SA_HF';
  if (skuUpper.includes('SA_PRO')) return 'SA_PRO';
  if (skuUpper.includes('SA_CDIFF')) return 'SA_CDIFF';
  
  return null;
};

// ========================================================================
// SHOPIFY WEBHOOK - SMART ORDER HANDLER WITH BOM INTEGRATION
// ========================================================================
app.post('/api/webhook/shopify', express.json(), async (req, res) => {
  const client = await pool.connect();
  // Declare outside try so catch block can access for lock cleanup
  let orderNumber = null;
  let clientReleased = false; // Guard against double-release in finally
  
  try {
    console.log('📬 Shopify webhook received');
    const webhookTopic = req.headers['x-shopify-topic'];
    // Shopify sends a unique delivery ID per webhook attempt
    const webhookDeliveryId = req.headers['x-shopify-webhook-id'] || req.headers['x-shopify-delivery-id'] || null;
    console.log('📦 Webhook type:', webhookTopic || 'unknown');
    console.log('🔑 Webhook delivery ID:', webhookDeliveryId || 'none');
    
    const { line_items, name: orderNumber_body, id: orderId } = req.body;
    orderNumber = orderNumber_body; // assign to outer variable
    
    if (!line_items || !Array.isArray(line_items)) {
      return res.status(400).json({ error: 'Invalid webhook data' });
    }
    
    // ========================================================================
    // OPTION 1: ORDER FULFILLMENT - Auto debit stock + BOM components
    // ========================================================================
    if (webhookTopic === 'orders/fulfilled' || webhookTopic === 'fulfillments/create') {
      console.log('🚚 Order Fulfillment - Auto debiting stock + BOM...');

      // ════════════════════════════════════════════════════════════════════
      // 🔒 3-LAYER IDEMPOTENCY GUARD — prevents any order from being
      //    processed more than once, regardless of order size or timing.
      //
      // LAYER 1 — In-memory lock (catches simultaneous requests on same server)
      // LAYER 2 — DB unique lock via INSERT (catches restarts / race conditions)  
      // LAYER 3 — Transaction check (final fallback, catches everything else)
      // ════════════════════════════════════════════════════════════════════

      // ── LAYER 1: In-memory lock ───────────────────────────────────────────
      // Two webhook requests arriving within milliseconds of each other will
      // both pass the DB check before either writes — the in-memory Set catches
      // this race condition instantly.
      if (processingOrders.has(orderNumber)) {
        console.log(`⚠️  [LAYER 1] Order ${orderNumber} is currently being processed — ignoring duplicate.`);
        clientReleased = true; client.release();
        return res.status(200).json({ success: true, message: 'Order already being processed', order: orderNumber });
      }
      processingOrders.add(orderNumber);

      // ── LAYER 2: DB unique lock ───────────────────────────────────────────
      // Uses INSERT ... ON CONFLICT DO NOTHING with a UNIQUE constraint on
      // (shopify_order_id, type) in the webhook_processed table.
      // Even across server restarts or multiple instances, only one INSERT wins.
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS webhook_processed (
            order_id TEXT NOT NULL,
            webhook_type TEXT NOT NULL,
            processed_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT webhook_processed_unique UNIQUE (order_id, webhook_type)
          )
        `);
        const lockResult = await pool.query(`
          INSERT INTO webhook_processed (order_id, webhook_type)
          VALUES ($1, 'fulfillment')
          ON CONFLICT (order_id, webhook_type) DO NOTHING
          RETURNING order_id
        `, [orderNumber]);
        if (lockResult.rowCount === 0) {
          console.log(`⚠️  [LAYER 2] Order ${orderNumber} already locked in DB — ignoring duplicate.`);
          processingOrders.delete(orderNumber);
          clientReleased = true; client.release();
          return res.status(200).json({ success: true, message: 'Order already processed', order: orderNumber });
        }
        console.log(`✅ [LAYER 2] Lock acquired for order ${orderNumber}`);
      } catch (lockErr) {
        console.error('⚠️  Webhook lock error (non-fatal):', lockErr.message);
        // Continue — Layer 3 will catch it if needed
      }

      // ── LAYER 3: Transaction check (final fallback) ───────────────────────
      const dupOrder = await pool.query(
        `SELECT 1 FROM transactions WHERE shopify_order_id = $1 AND type = 'shopify_sale' LIMIT 1`,
        [orderNumber]
      );
      if (dupOrder.rows.length > 0) {
        console.log(`⚠️  [LAYER 3] Order ${orderNumber} found in transactions — ignoring duplicate.`);
        processingOrders.delete(orderNumber);
        clientReleased = true; client.release();
        return res.status(200).json({ success: true, message: 'Order already processed', order: orderNumber });
      }

      // ── All guards passed — safe to process ──────────────────────────────
      console.log(`✅ All 3 guards passed — processing order ${orderNumber}`);

      // Acknowledge Shopify IMMEDIATELY so it stops retrying.
      // Large orders take time — responding first prevents the retry loop.
      res.status(200).json({ success: true, message: 'Webhook acknowledged, processing...', order: orderNumber });
      
      await client.query('BEGIN');
      
      for (const item of line_items) {
        const { sku, quantity } = item;
        
        if (!sku || !quantity) continue;
        
        // Find product by SKU
        const productResult = await client.query(`
          SELECT * FROM products 
          WHERE "shopifySkus"::text ILIKE $1
          LIMIT 1
        `, [`%${sku}%`]);
        
        if (productResult.rows.length > 0) {
          const product = productResult.rows[0];
          
          // ========================================================================
          // STEP 1: Calculate stock change based on product category
          // ========================================================================
          let totalDeduction;
          let notes;
          
          // Check if product is a Machine (SCENT_MACHINES or MACHINES_SPARES) - no BOM, direct debit
          if (product.category === 'SCENT_MACHINES' || product.category === 'MACHINES_SPARES') {
            // Machines: Simple quantity debit (no volume calculation, no BOM)
            totalDeduction = parseFloat(quantity);
            notes = `Shopify Order ${orderNumber} - Fulfilled (${quantity} units)`;
            console.log(`📦 Machine SKU: ${sku}, Qty: ${quantity} units`);
          } else {
            // Oils: Calculate volume based on SKU
            const volumePerUnit = getVolumeFromSKU(sku);
            totalDeduction = volumePerUnit * parseFloat(quantity);
            notes = `Shopify Order ${orderNumber} - Fulfilled (${quantity}x ${volumePerUnit}ml)`;
            console.log(`📊 Oil SKU: ${sku}, Volume/unit: ${volumePerUnit}ml, Qty: ${quantity}, Total: ${totalDeduction}ml`);
          }
          
          const currentStock = parseFloat(product.currentStock) || 0;
          const newStock = currentStock - totalDeduction; // Allow negative stock
          
          // Update stock
          await client.query(
            'UPDATE products SET "currentStock" = $1, "stockBoxes" = $2 WHERE id = $3',
            [newStock, Math.floor(newStock / (product.unitPerBox || 1)), product.id]
          );
          
          // Create transaction
          await client.query(
            `INSERT INTO transactions 
             (product_id, product_code, product_name, category, type, quantity, unit, balance_after, notes, shopify_order_id) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              product.id,
              product.productCode || product.tag,
              product.name,
              product.category,
              'shopify_sale',
              totalDeduction,
              product.unit || 'mL',
              newStock,
              notes,
              orderNumber
            ]
          );
          
          console.log(`✅ ${(product.category === 'SCENT_MACHINES' || product.category === 'MACHINES_SPARES') ? 'Machine' : 'Oil'} debited: ${product.name} -${totalDeduction} ${product.unit} (New: ${newStock} ${product.unit})`);
          
          // ========================================================================
          // STEP 2: Debit BOM components (ONLY FOR OILS, NOT MACHINES)
          // ========================================================================
          if (product.category !== 'SCENT_MACHINES' && product.category !== 'MACHINES_SPARES') {
            const variant = getVariantFromSKU(sku);
            
            if (variant) {
              console.log(`🔍 Looking for BOM components for variant: ${variant}`);
              
              // Get BOM components for this variant
              const bomResult = await client.query(
                'SELECT * FROM bom WHERE variant = $1 ORDER BY seq',
                [variant]
              );
              
              if (bomResult.rows.length > 0) {
                console.log(`📦 Found ${bomResult.rows.length} BOM components for ${variant}`);
                
                for (const bomItem of bomResult.rows) {
                  const componentCode = bomItem.component_code;
                  const componentQty = parseFloat(bomItem.quantity) * parseFloat(quantity);
                  
                  // Find component product
                  const componentResult = await client.query(
                    'SELECT * FROM products WHERE "productCode" = $1 OR tag = $1 OR id = $1',
                    [componentCode]
                  );
                  
                  if (componentResult.rows.length > 0) {
                    const component = componentResult.rows[0];
                    const compCurrentStock = parseFloat(component.currentStock) || 0;
                    const compNewStock = compCurrentStock - componentQty; // Allow negative stock
                    
                    // Update component stock
                    await client.query(
                      'UPDATE products SET "currentStock" = $1, "stockBoxes" = $2 WHERE id = $3',
                      [compNewStock, Math.floor(compNewStock / (component.unitPerBox || 1)), component.id]
                    );
                    
                    // Create transaction for component
                    await client.query(
                      `INSERT INTO transactions 
                       (product_id, product_code, product_name, category, type, quantity, unit, balance_after, notes, shopify_order_id) 
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                      [
                        component.id,
                        component.productCode || component.tag,
                        component.name,
                        component.category,
                        'shopify_sale',
                        componentQty,
                        component.unit || 'units',
                        compNewStock,
                        `Shopify Order ${orderNumber} - BOM Component (${quantity}x ${variant})`,
                        orderNumber
                      ]
                    );
                    
                    console.log(`  ✅ BOM component: ${component.name} -${componentQty} ${component.unit} (New: ${compNewStock})`);
                  } else {
                    console.log(`  ⚠️ BOM component not found: ${componentCode}`);
                  }
                }
              } else {
                console.log(`ℹ️ No BOM found for variant ${variant}`);
              }
            }
          } else {
            console.log(`ℹ️ Machine product - No BOM processing needed`);
          }
          
        } else {
          console.log(`⚠️ SKU not found: ${sku}`);
        }
      }
      
      await client.query('COMMIT');
      console.log(`✅ Order ${orderNumber} fulfillment processed successfully`);
      processingOrders.delete(orderNumber); // Release in-memory lock
      // Note: HTTP response was already sent above (early 200) to prevent Shopify retries.
      return; // CRITICAL: stop here — do not fall through to other webhook handlers
    }
    
    // ========================================================================
    // OPTION 2: ORDER CREATION - Add to incoming orders
    // ========================================================================
    if (webhookTopic === 'orders/create') {
      console.log('📝 Order Creation - Adding to incoming orders...');
      
      for (const item of line_items) {
        const { sku, quantity } = item;
        
        if (!sku) continue;
        
        const productResult = await pool.query(`
          SELECT * FROM products 
          WHERE "shopifySkus"::text ILIKE $1
          LIMIT 1
        `, [`%${sku}%`]);
        
        if (productResult.rows.length > 0) {
          const product = productResult.rows[0];
          const incomingOrders = parseJSONB(product.incoming_orders, []);
          
          incomingOrders.push({
            orderNumber,
            sku,
            quantity,
            receivedAt: new Date().toISOString()
          });
          
          await pool.query(
            'UPDATE products SET incoming_orders = $1 WHERE id = $2',
            [JSON.stringify(incomingOrders), product.id]
          );
          
          console.log(`📋 Incoming order added: ${product.name} - Order ${orderNumber}`);
        }
      }
      
      return res.status(200).json({ 
        success: true, 
        message: 'Incoming order added',
        order: orderNumber 
      });
    }
    
    // Unknown webhook type
    console.log('⚠️ Unknown webhook type:', webhookTopic);
    res.status(200).json({ received: true, message: 'Webhook received but not processed' });
    
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch(e) {}
    }
    console.error('❌ Webhook error:', error);
    // Clean up in-memory lock so a manual retry can be attempted if needed
    if (orderNumber) processingOrders.delete(orderNumber);
    // Only send error response if we haven't already responded (early 200 for fulfillment)
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  } finally {
    if (client && !clientReleased) client.release();
  }
});

// ========================================================================
// PURCHASE ORDERS - Add Incoming Order
// ========================================================================
app.post('/api/products/:id/incoming', async (req, res) => {
  try {
    const { id } = req.params;
    const { orderNumber, quantity, supplier, notes, addedBy } = req.body;
    
    if (!orderNumber || !quantity) {
      return res.status(400).json({ error: 'Order number and quantity are required' });
    }
    
    // Get current product
    const productResult = await pool.query(
      'SELECT * FROM products WHERE id = $1',
      [id]
    );
    
    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const product = productResult.rows[0];
    const incomingOrders = parseJSONB(product.incoming_orders, []);
    
    // Add new incoming order
    const newIncoming = {
      orderNumber,
      quantity: parseFloat(quantity),
      supplier: supplier || product.supplier || '',
      notes: notes || '',
      addedAt: new Date().toISOString(),
      addedBy: addedBy || 'manual'
    };
    
    incomingOrders.push(newIncoming);
    
    // Update product with JSONB cast
    await pool.query(
      'UPDATE products SET incoming_orders = $1::jsonb WHERE id = $2',
      [JSON.stringify(incomingOrders), id]
    );
    
    console.log(`📋 Incoming order added manually: ${product.name} - ${orderNumber} (${quantity} ${product.unit})`);
    
    res.json({ 
      success: true, 
      incomingOrders,
      message: 'Incoming order added successfully'
    });
  } catch (error) {
    console.error('Add incoming order error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id/incoming/:index', async (req, res) => {
  try {
    const { id, index } = req.params;
    
    const productResult = await pool.query(
      'SELECT incoming_orders FROM products WHERE id = $1',
      [id]
    );
    
    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const incomingOrders = parseJSONB(productResult.rows[0].incoming_orders, []);
    incomingOrders.splice(parseInt(index), 1);
    
    await pool.query(
      'UPDATE products SET incoming_orders = $1::jsonb WHERE id = $2',
      [JSON.stringify(incomingOrders), id]
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================================
// RECEIVE INCOMING ORDER - Mark as Received and Update Stock
// ========================================================================
app.post('/api/products/:id/incoming/:index/receive', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id, index } = req.params;
    const { quantityReceived, notes, receivedBy } = req.body;
    
    // Get product
    const productResult = await client.query(
      'SELECT * FROM products WHERE id = $1',
      [id]
    );
    
    if (productResult.rows.length === 0) {
      throw new Error('Product not found');
    }
    
    const product = productResult.rows[0];
    const incomingOrders = parseJSONB(product.incoming_orders, []);
    const incomingOrder = incomingOrders[parseInt(index)];
    
    if (!incomingOrder) {
      throw new Error('Incoming order not found');
    }
    
    const receivedQty = parseFloat(quantityReceived);
    
    // Update stock
    const currentStock = parseFloat(product.currentStock) || 0;
    const newStock = currentStock + receivedQty;
    const newBoxes = Math.floor(newStock / (product.unitPerBox || 1));
    
    await client.query(
      'UPDATE products SET "currentStock" = $1, "stockBoxes" = $2 WHERE id = $3',
      [newStock, newBoxes, id]
    );
    
    // Create transaction
    await client.query(
      `INSERT INTO transactions 
       (product_id, product_code, product_name, category, type, quantity, unit, balance_after, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        product.id,
        product.productCode || product.tag,
        product.name,
        product.category,
        'add',
        receivedQty,
        product.unit || 'units',
        newStock,
        `PO Received: ${incomingOrder.orderNumber} - ${notes || 'Incoming order received'}${receivedBy ? ` (by ${receivedBy})` : ''}`
      ]
    );
    
    // Remove incoming order
    incomingOrders.splice(parseInt(index), 1);
    await client.query(
      'UPDATE products SET incoming_orders = $1::jsonb WHERE id = $2',
      [JSON.stringify(incomingOrders), id]
    );
    
    await client.query('COMMIT');
    
    console.log(`✅ PO Received: ${product.name} - ${incomingOrder.orderNumber} (+${receivedQty} ${product.unit})`);
    
    res.json({ 
      success: true, 
      newStock,
      message: 'Incoming order received and stock updated'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Receive incoming order error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ========================================================================
// REPLENISHMENT DASHBOARD
// ========================================================================

// ── Migration: create forecasts table + suppliers table + add lead_time to products (idempotent)
app.get('/api/migrate-replenishment', async (req, res) => {
  try {
    // 1. lead_time column on products (override per product)
    await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS lead_time INTEGER DEFAULT NULL`);

    // 2. forecasts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS forecasts (
        id                SERIAL PRIMARY KEY,
        product_code      TEXT NOT NULL,
        forecast_120_days NUMERIC(12,2) NOT NULL DEFAULT 0,
        import_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        imported_by       TEXT NOT NULL DEFAULT 'system'
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_forecasts_product_code ON forecasts(product_code)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_forecasts_import_date ON forecasts(import_date DESC)`);

    // 3. suppliers table — stores default lead times per supplier name
    await pool.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL UNIQUE,
        lead_time  INTEGER NOT NULL DEFAULT 30,
        notes      TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 4. Seed known suppliers (ON CONFLICT = update lead_time if already exists)
    const knownSuppliers = [
      { name: 'Luxaroma',         lead_time: 15  },
      { name: 'Smart Fragrances', lead_time: 90  },
      { name: 'FIA',              lead_time: 15  },
      { name: 'Scent Method',     lead_time: 15  },
      { name: 'BELL',             lead_time: 90  },
      { name: 'Natarom',          lead_time: 90  },
    ];
    for (const s of knownSuppliers) {
      await pool.query(
        `INSERT INTO suppliers (name, lead_time) VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET lead_time = EXCLUDED.lead_time, updated_at = NOW()`,
        [s.name, s.lead_time]
      );
    }

    console.log('✅ Replenishment migration complete');
    res.json({ success: true, message: 'Migration complete: lead_time column added, forecasts + suppliers tables created with default suppliers seeded.' });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── POST /api/forecast/import — Upload Salesforce Excel forecast
app.post('/api/forecast/import', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const { read, utils } = await import('xlsx');
    const workbook = read(req.file.path, { type: 'file' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // ── Parse raw rows (no header auto-detection — file has blank row 1, header on row 2)
    const rawRows = utils.sheet_to_json(sheet, { header: 1, defval: null });

    // Find the actual header row (first row that contains 'productCode' or 'product_code')
    let headerRowIndex = -1;
    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row) continue;
      const hasProductCol = row.some(cell =>
        cell && String(cell).toLowerCase().replace(/\s/g,'').includes('productcode')
      );
      if (hasProductCol) { headerRowIndex = i; break; }
    }

    if (headerRowIndex === -1) {
      return res.status(400).json({ error: 'Could not find header row. Make sure the file has a "productCode" column.' });
    }

    const headers = rawRows[headerRowIndex].map(h => (h ? String(h).trim() : ''));
    const dataRows = rawRows.slice(headerRowIndex + 1);

    // Find column indexes (flexible matching)
    const productCodeIdx = headers.findIndex(h => h.toLowerCase().replace(/[\s_]/g,'').includes('productcode'));
    const forecastIdx    = headers.findIndex(h => h.toLowerCase().includes('forecast') || h.toLowerCase().includes('demand'));

    if (productCodeIdx === -1 || forecastIdx === -1) {
      return res.status(400).json({
        error: 'Could not find required columns.',
        found: headers,
        expected: ['productCode (or product_code)', 'any column with "forecast" or "demand"']
      });
    }

    const importedBy = req.body.imported_by || 'system';
    const importDate = new Date();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      let inserted = 0, skipped = 0;

      for (const row of dataRows) {
        if (!row || row.every(c => c === null || c === '')) continue; // skip empty rows

        const productCode = row[productCodeIdx] ? String(row[productCodeIdx]).trim() : '';
        const rawForecast = row[forecastIdx];
        const forecast    = parseFloat(rawForecast) || 0;

        // Skip blank/invalid product codes (e.g. "(blank)" row at end)
        if (!productCode || productCode === '' || productCode.toLowerCase() === '(blank)') {
          skipped++;
          continue;
        }

        await client.query(
          `INSERT INTO forecasts (product_code, forecast_120_days, import_date, imported_by) VALUES ($1, $2, $3, $4)`,
          [productCode, forecast, importDate, importedBy]
        );
        inserted++;
      }

      await client.query('COMMIT');
      try { await fs.unlink(req.file.path); } catch (_) {}

      res.json({ success: true, inserted, skipped, importDate: importDate.toISOString(), importedBy });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Forecast import error:', error);
    try { if (req.file) await fs.unlink(req.file.path); } catch (_) {}
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/forecast/last — Export last forecast as Excel backup
app.get('/api/forecast/last', async (req, res) => {
  try {
    const lastImport = await pool.query(`SELECT import_date, imported_by FROM forecasts ORDER BY import_date DESC LIMIT 1`);
    if (!lastImport.rows.length) return res.status(404).json({ error: 'No forecast imported yet' });

    const { import_date } = lastImport.rows[0];
    const rows = await pool.query(
      `SELECT product_code, forecast_120_days, import_date, imported_by FROM forecasts
       WHERE DATE_TRUNC('second', import_date) = DATE_TRUNC('second', $1::timestamptz)
       ORDER BY product_code`,
      [import_date]
    );

    const { utils, write } = await import('xlsx');
    const ws = utils.json_to_sheet(rows.rows.map(r => ({
      product_code: r.product_code,
      forecast_120_days: parseFloat(r.forecast_120_days),
      import_date: new Date(r.import_date).toISOString().split('T')[0],
      imported_by: r.imported_by
    })));
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Forecast');
    const buffer = write(wb, { type: 'buffer', bookType: 'xlsx' });
    const dateStr = new Date(import_date).toISOString().split('T')[0];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="forecast_backup_${dateStr}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    console.error('Forecast export error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/forecast/import-history — List import batches
app.get('/api/forecast/import-history', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DATE_TRUNC('second', import_date) AS import_date, imported_by, COUNT(*) AS product_count
      FROM forecasts GROUP BY DATE_TRUNC('second', import_date), imported_by
      ORDER BY import_date DESC LIMIT 20
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/suppliers — List all suppliers with their lead times
app.get('/api/suppliers', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM suppliers ORDER BY name`);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /api/suppliers — Create a new supplier
app.post('/api/suppliers', async (req, res) => {
  try {
    const { name, lead_time, notes } = req.body;
    if (!name || !lead_time) return res.status(400).json({ error: 'name and lead_time are required' });
    const result = await pool.query(
      `INSERT INTO suppliers (name, lead_time, notes) VALUES ($1, $2, $3)
       ON CONFLICT (name) DO UPDATE SET lead_time = EXCLUDED.lead_time, notes = EXCLUDED.notes, updated_at = NOW()
       RETURNING *`,
      [name.trim(), parseInt(lead_time), notes || '']
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── PUT /api/suppliers/:id — Update supplier lead time
app.put('/api/suppliers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, lead_time, notes } = req.body;
    const result = await pool.query(
      `UPDATE suppliers SET
         name      = COALESCE($1, name),
         lead_time = COALESCE($2, lead_time),
         notes     = COALESCE($3, notes),
         updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [name || null, lead_time ? parseInt(lead_time) : null, notes ?? null, parseInt(id)]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Supplier not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── DELETE /api/suppliers/:id — Delete a supplier
app.delete('/api/suppliers/:id', async (req, res) => {
  try {
    const result = await pool.query(`DELETE FROM suppliers WHERE id = $1 RETURNING id`, [parseInt(req.params.id)]);
    if (!result.rows.length) return res.status(404).json({ error: 'Supplier not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── PUT /api/products/:id/lead-time — Override lead_time for a specific product (NULL = use supplier default)
app.put('/api/products/:id/lead-time', async (req, res) => {
  try {
    const { id } = req.params;
    const { lead_time } = req.body; // pass null to reset to supplier default
    const val = lead_time === null || lead_time === '' ? null : parseInt(lead_time);
    if (val !== null && isNaN(val)) return res.status(400).json({ error: 'lead_time must be a number or null' });
    const result = await pool.query(
      `UPDATE products SET lead_time = $1 WHERE id = $2 RETURNING id, lead_time`,
      [val, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true, id: result.rows[0].id, lead_time: result.rows[0].lead_time });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/dashboard/replenishment — Main data endpoint (smart demand calculation)
app.get('/api/dashboard/replenishment', async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [productsResult, salesByDayResult, forecastResult, lastForecastResult, suppliersResult] = await Promise.all([
      // Products with lead_time resolved: product override → supplier default → 30d fallback
      pool.query(`
        SELECT
          p.id,
          p."productCode",
          p.name,
          p."currentStock",
          p.supplier,
          p.lead_time AS product_lead_time_override,
          COALESCE(p.lead_time, s.lead_time, 30) AS lead_time,
          p.category
        FROM products p
        LEFT JOIN suppliers s ON LOWER(TRIM(p.supplier)) = LOWER(TRIM(s.name))
        ORDER BY p.name
      `),
      // Sales broken down by product AND day — needed for spike detection
      pool.query(`
        SELECT
          product_id,
          DATE(created_at) AS sale_date,
          SUM(quantity) AS daily_volume
        FROM transactions
        WHERE type IN ('remove', 'shopify_sale', 'sale')
          AND created_at >= $1
        GROUP BY product_id, DATE(created_at)
        ORDER BY product_id, sale_date
      `, [thirtyDaysAgo.toISOString()]),
      // Latest forecast per product
      pool.query(`
        SELECT DISTINCT ON (product_code)
          product_code, forecast_120_days, import_date
        FROM forecasts
        ORDER BY product_code, import_date DESC
      `),
      pool.query(`SELECT import_date, imported_by FROM forecasts ORDER BY import_date DESC LIMIT 1`),
      pool.query(`SELECT id, name, lead_time, notes FROM suppliers ORDER BY name`)
    ]);

    // ── Build per-product daily sales map { productId -> [{ date, volume }] }
    const dailySalesMap = {};
    for (const row of salesByDayResult.rows) {
      if (!dailySalesMap[row.product_id]) dailySalesMap[row.product_id] = [];
      dailySalesMap[row.product_id].push(parseFloat(row.daily_volume) || 0);
    }

    // ── Forecast map
    const forecastMap = {};
    for (const row of forecastResult.rows) {
      forecastMap[row.product_code] = {
        forecast_120_days: parseFloat(row.forecast_120_days) || 0,
        import_date: row.import_date
      };
    }

    // ── Supplier lead-time map
    const supplierMap = {};
    for (const row of suppliersResult.rows) {
      supplierMap[row.name.toLowerCase().trim()] = row.lead_time;
    }

    // ════════════════════════════════════════════════════════════════════════
    // SMART DEMAND CALCULATOR
    // Removes spikes (backlog artifacts), uses dynamic window, blends with
    // forecast based on how much clean historical data we have.
    // ════════════════════════════════════════════════════════════════════════
    const calcSmartDemand = (dailyVolumes, forecastDaily) => {
      const MIN_DAILY = 0.1;

      // Step 1: No data at all
      if (!dailyVolumes || dailyVolumes.length === 0) {
        if (forecastDaily != null && forecastDaily > 0) {
          // No history — trust forecast fully but apply 80% to be conservative
          return {
            avgDailyDemand: forecastDaily * 0.8,
            cleanDays: 0,
            totalSold30d: 0,
            dataConfidence: 'forecast_only',
            spikesRemoved: 0
          };
        }
        return {
          avgDailyDemand: MIN_DAILY,
          cleanDays: 0,
          totalSold30d: 0,
          dataConfidence: 'no_data',
          spikesRemoved: 0
        };
      }

      const totalDays = dailyVolumes.length;
      const totalVolume = dailyVolumes.reduce((a, b) => a + b, 0);

      // Step 2: Spike detection
      // A day is a spike if its volume > 3x the average of all OTHER days
      // This catches the backlog days (09-11/03) automatically
      const cleanVolumes = [];
      let spikesRemoved = 0;

      if (totalDays === 1) {
        // Only 1 day of data — can't reliably detect spikes, use it as-is
        cleanVolumes.push(dailyVolumes[0]);
      } else {
        for (let i = 0; i < dailyVolumes.length; i++) {
          const otherDays = dailyVolumes.filter((_, j) => j !== i);
          const otherAvg = otherDays.reduce((a, b) => a + b, 0) / otherDays.length;
          const spikeThreshold = otherAvg * 3;

          if (dailyVolumes[i] > spikeThreshold && otherAvg > 0) {
            spikesRemoved++;
            // Don't discard entirely — add at capped level (1x average) to preserve signal
            cleanVolumes.push(otherAvg);
          } else {
            cleanVolumes.push(dailyVolumes[i]);
          }
        }
      }

      const cleanTotal = cleanVolumes.reduce((a, b) => a + b, 0);
      const cleanDays  = cleanVolumes.length;

      // Step 3: Clean average daily demand (using actual days with data, not 30 fixed)
      const avgDailyClean = cleanDays > 0 ? cleanTotal / cleanDays : MIN_DAILY;

      // Step 4: Blend with forecast based on data maturity
      // The less clean history we have, the more we trust the Salesforce forecast
      let avgDailyDemand;
      let dataConfidence;

      if (forecastDaily != null && forecastDaily > 0) {
        if (cleanDays >= 25) {
          // 25+ clean days: history is mature — trust it more
          avgDailyDemand = (avgDailyClean * 0.7) + (forecastDaily * 0.3);
          dataConfidence = 'high';
        } else if (cleanDays >= 15) {
          // 15-24 clean days: balanced blend
          avgDailyDemand = (avgDailyClean * 0.5) + (forecastDaily * 0.5);
          dataConfidence = 'medium';
        } else if (cleanDays >= 5) {
          // 5-14 clean days: lean on forecast more
          avgDailyDemand = (avgDailyClean * 0.3) + (forecastDaily * 0.7);
          dataConfidence = 'low';
        } else {
          // 1-4 clean days: almost entirely forecast
          avgDailyDemand = (avgDailyClean * 0.1) + (forecastDaily * 0.9);
          dataConfidence = 'very_low';
        }
      } else {
        // No forecast — use clean history only
        avgDailyDemand = avgDailyClean > 0 ? avgDailyClean : MIN_DAILY;
        dataConfidence = cleanDays >= 20 ? 'high_no_forecast'
                       : cleanDays >= 10 ? 'medium_no_forecast'
                       : 'low_no_forecast';
      }

      // Never go below minimum
      if (avgDailyDemand < MIN_DAILY) avgDailyDemand = MIN_DAILY;

      return {
        avgDailyDemand,
        cleanDays,
        totalSold30d: totalVolume,
        dataConfidence,
        spikesRemoved
      };
    };

    // ── Build final product data
    const MIN_DAILY = 0.1;

    const data = productsResult.rows.map(p => {
      const realStock  = parseFloat(p.currentStock) || 0;
      const leadTime   = parseInt(p.lead_time) || 30;
      const leadTimeSource = p.product_lead_time_override != null
        ? 'product_override'
        : (p.supplier && supplierMap[p.supplier.toLowerCase().trim()] ? 'supplier_default' : 'fallback');

      const fc           = forecastMap[p.productCode] || null;
      const forecast120  = fc ? fc.forecast_120_days : null;
      const forecastDaily = forecast120 != null ? forecast120 / 120 : null;

      const dailyVolumes = dailySalesMap[p.id] || [];
      const demand = calcSmartDemand(dailyVolumes, forecastDaily);

      const avgDailyDemand = demand.avgDailyDemand;

      // Projected daily = MAX(smart demand, forecast) — always plan for worst case
      const projectedDaily = forecastDaily != null
        ? Math.max(avgDailyDemand, forecastDaily)
        : avgDailyDemand;

      // Safety stock = smart demand × lead time × 1.5 safety factor
      const safetyStockLevel = avgDailyDemand * leadTime * 1.5;

      const projectedDaysOfStock = projectedDaily > 0
        ? realStock / projectedDaily
        : (realStock > 0 ? 9999 : 0);

      const daysOfStockActual = avgDailyDemand > MIN_DAILY
        ? realStock / avgDailyDemand
        : (realStock > 0 ? 9999 : 0);

      const gap = projectedDaysOfStock - daysOfStockActual;

      const safetyStatus = daysOfStockActual < 45   ? 'Critical'
                         : daysOfStockActual <= 90  ? 'Attention'
                         : 'Safe';

      return {
        id:                  p.id,
        productCode:         p.productCode,
        name:                p.name,
        realStock:           Math.round(realStock * 100) / 100,
        safetyStockLevel:    Math.round(safetyStockLevel * 100) / 100,
        avgDailyDemand:      Math.round(avgDailyDemand * 1000) / 1000,
        totalSold30d:        Math.round(demand.totalSold30d * 100) / 100,
        forecast120Days:     forecast120 != null ? Math.round(forecast120 * 100) / 100 : null,
        forecastDaily:       forecastDaily != null ? Math.round(forecastDaily * 1000) / 1000 : null,
        forecastImportDate:  fc ? fc.import_date : null,
        projectedDaily:      Math.round(projectedDaily * 1000) / 1000,
        projectedDaysOfStock: projectedDaysOfStock >= 9999 ? 9999 : Math.round(projectedDaysOfStock * 10) / 10,
        daysOfStockActual:   daysOfStockActual >= 9999 ? 9999 : Math.round(daysOfStockActual * 10) / 10,
        gap:                 Math.round(gap * 10) / 10,
        safetyStatus,
        leadTime,
        leadTimeSource,
        supplier:            p.supplier || '',
        category:            p.category,
        // Data quality indicators
        noSalesData:         demand.totalSold30d === 0,
        hasForecast:         fc != null,
        dataConfidence:      demand.dataConfidence,
        cleanDays:           demand.cleanDays,
        spikesRemoved:       demand.spikesRemoved
      };
    });

    const statusOrder = { Critical: 0, Attention: 1, Safe: 2 };
    data.sort((a, b) => {
      const diff = statusOrder[a.safetyStatus] - statusOrder[b.safetyStatus];
      return diff !== 0 ? diff : a.projectedDaysOfStock - b.projectedDaysOfStock;
    });

    res.json({
      products: data,
      meta: {
        totalProducts:     data.length,
        critical:          data.filter(d => d.safetyStatus === 'Critical').length,
        attention:         data.filter(d => d.safetyStatus === 'Attention').length,
        safe:              data.filter(d => d.safetyStatus === 'Safe').length,
        lastForecastImport: lastForecastResult.rows[0] || null,
        suppliers:         suppliersResult.rows,
        calculatedAt:      new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Replenishment dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================================================
// FRONTEND SERVING
// ========================================================================
const distPath = join(__dirname, '../dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  console.log('📦 Serving frontend from dist/');
  
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(join(distPath, 'index.html'));
    }
  });
}

const uploadsDir = join(__dirname, '../uploads');
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}


// ========================================================================
// PRODUCT RETURNS ENDPOINT
// ========================================================================
app.post('/api/returns', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { items, notes, returnedBy } = req.body;
    
    // Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('No items provided');
    }
    
    if (!returnedBy || !returnedBy.trim()) {
      throw new Error('returnedBy is required');
    }
    
    const processedItems = [];
    
    // Process each return item
    for (const item of items) {
      const { productId, quantity } = item;
      
      if (!productId || !quantity || quantity <= 0) {
        continue; // Skip invalid items
      }
      
      // Get product FOR UPDATE to lock row
      const productResult = await client.query(
        'SELECT * FROM products WHERE id = $1 FOR UPDATE',
        [productId]
      );
      
      if (productResult.rows.length === 0) {
        console.error(`Product not found: ${productId}`);
        continue; // Skip if product not found
      }
      
      const product = productResult.rows[0];
      const currentStock = parseFloat(product.currentStock) || 0;
      const quantityToAdd = parseFloat(quantity);
      const newStock = currentStock + quantityToAdd;
      
      // Update product stock
      await client.query(
        'UPDATE products SET "currentStock" = $1, "stockBoxes" = $2 WHERE id = $3',
        [newStock, Math.floor(newStock / (product.unitPerBox || 1)), productId]
      );
      
      // Create return transaction with notes and returnedBy
      const transactionNotes = notes && notes.trim() 
        ? `Return: ${notes.trim()} | Returned by: ${returnedBy.trim()}`
        : `Product return | Returned by: ${returnedBy.trim()}`;
      
      await client.query(
        `INSERT INTO transactions 
         (product_id, product_code, product_name, category, type, quantity, unit, balance_after, notes) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          productId,
          product.productCode || product.tag,
          product.name,
          product.category,
          'return', // New transaction type
          quantityToAdd,
          product.unit,
          newStock,
          transactionNotes
        ]
      );
      
      processedItems.push({
        productId,
        productName: product.name,
        quantityReturned: quantityToAdd,
        newStock,
        unit: product.unit
      });
      
      console.log(`✅ Return processed: ${product.name} +${quantityToAdd} ${product.unit} → ${newStock} ${product.unit}`);
    }
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      processedCount: processedItems.length,
      items: processedItems,
      returnedBy: returnedBy.trim(),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Process returns error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ========================================================================
// CLEANUP JOB — Limpeza automática do webhook_processed (roda 1x por dia)
// Mantém só os últimos 30 dias — evita crescimento infinito da tabela
// ========================================================================
const runCleanup = async () => {
  try {
    const result = await pool.query(`
      DELETE FROM webhook_processed
      WHERE processed_at < NOW() - INTERVAL '30 days'
    `);
    if (result.rowCount > 0) {
      console.log(`🧹 Cleanup: removed ${result.rowCount} old webhook_processed records`);
    }
  } catch (err) {
    console.error('⚠️ Cleanup job error:', err.message);
  }
};

// Roda uma vez na inicialização do servidor
runCleanup();

// Roda todo dia às 03:00 AM Sydney time (intervalo de 24h)
setInterval(() => {
  const sydneyHour = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Australia/Sydney' })
  ).getHours();
  if (sydneyHour === 3) runCleanup();
}, 60 * 60 * 1000); // Checa a cada 1 hora

// ========================================================================
// ERROR HANDLING
// ========================================================================
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ========================================================================
// START SERVER
// ========================================================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('    Scent Australia -  SCENT STOCK MANAGER ');
  console.log('═══════════════════════════════════════════════════');
  console.log(`🌐 Port:        ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('Powered by: Fabricio Leopoldino 2026');
  console.log('');
  console.log('');
  console.log('');
  console.log('');
  console.log('');
  console.log('');
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('           Server ready!');
  console.log('═══════════════════════════════════════════════');
});
