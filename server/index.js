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
// HEALTH CHECK || Funcionamento junto com o UPTIMEROBOt
// ========================================================================
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as now, current_database() as db');
    res.json({
      status: 'ok',
      message: 'Service active',
      timestamp: result.rows[0].now,
      database: result.rows[0].db
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
       sub_category = COALESCE($13, sub_category),
       color = COALESCE($14, color),
       location = COALESCE($15, location),
       bin_location = COALESCE($16, bin_location)
       WHERE id = $17
       RETURNING *`,
      [
        name, category, productCode, tag, unit, currentStock, minStockLevel, 
        skusJson, supplier, supplier_code, unitPerBox, stockBoxes,
        finalSubCategory, finalColor, finalLocation, finalBinLocation, productId
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
  
  try {
    console.log('📬 Shopify webhook received');
    const webhookTopic = req.headers['x-shopify-topic'];
    // Shopify sends a unique delivery ID per webhook attempt
    const webhookDeliveryId = req.headers['x-shopify-webhook-id'] || req.headers['x-shopify-delivery-id'] || null;
    console.log('📦 Webhook type:', webhookTopic || 'unknown');
    console.log('🔑 Webhook delivery ID:', webhookDeliveryId || 'none');
    
    const { line_items, name: orderNumber, id: orderId } = req.body;
    
    if (!line_items || !Array.isArray(line_items)) {
      return res.status(400).json({ error: 'Invalid webhook data' });
    }
    
    // ========================================================================
    // OPTION 1: ORDER FULFILLMENT - Auto debit stock + BOM components
    // ========================================================================
    if (webhookTopic === 'orders/fulfilled' || webhookTopic === 'fulfillments/create') {
      console.log('🚚 Order Fulfillment - Auto debiting stock + BOM...');

      // ── IDEMPOTENCY GUARD ─────────────────────────────────────────────────
      // Shopify retries webhooks if no 2xx is received within ~5s.
      // A large order (25 SKUs + BOM components) can take >5s to process,
      // causing the webhook to fire multiple times and double-debit stock.
      //
      // Guard: check if this order was already fully processed as a sale.
      // ─────────────────────────────────────────────────────────────────────
      const dupOrder = await pool.query(
        `SELECT 1 FROM transactions WHERE shopify_order_id = $1 AND type = 'shopify_sale' LIMIT 1`,
        [orderNumber]
      );
      if (dupOrder.rows.length > 0) {
        console.log(`⚠️  Order ${orderNumber} already processed — ignoring duplicate fulfillment webhook.`);
        client.release();
        return res.status(200).json({ success: true, message: 'Order already processed', order: orderNumber });
      }

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
      console.log('✅ Order fulfillment processed successfully');
      // Note: HTTP response was already sent above (early 200) to prevent Shopify retries.
      // Do NOT call res.json() again here.
    }
    
    // ========================================================================
    // OPTION 2: ORDER CREATION - Add to incoming orders
    // ========================================================================
    if (webhookTopic === 'orders/create' || !webhookTopic) {
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
    // Only send error response if we haven't already responded (early 200 for fulfillment)
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  } finally {
    if (client) client.release();
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
