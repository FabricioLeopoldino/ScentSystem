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
// HELPER FUNCTIONS
// ========================================================================

const parseJSONB = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
    } catch (e) {
      return fallback;
    }
  }
  return fallback;
};

// Auto-generate SKUs for OILS
const generateAutoSkus = (category, baseNumber) => {
  if (category === 'OILS') {
    const paddedNum = String(baseNumber).padStart(5, '0');
    return {
      SA_CA: `SA_CA_${paddedNum}`,
      SA_1L: `SA_1L_${paddedNum}`,
      SA_CDIFF: `SA_CDIFF_${paddedNum}`,
      SA_PRO: `SA_PRO_${paddedNum}`,
      SA_HF: `SA_HF_${paddedNum}`
    };
  }
  return {};
};

// ========================================================================
// HEALTH CHECK
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
      unit: row.unit,
      currentStock: parseFloat(row.currentStock) || 0,
      minStockLevel: parseFloat(row.minStockLevel) || 0,
      supplier: row.supplier || '',
      supplier_code: row.supplier_code || '',
      unitPerBox: parseInt(row.unitPerBox) || 1,
      stockBoxes: parseInt(row.stockBoxes) || 0,
      shopifySkus: parseJSONB(row.shopifySkus),
      incoming_orders: parseJSONB(row.incoming_orders, []),
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
      unit: row.unit,
      currentStock: parseFloat(row.currentStock) || 0,
      minStockLevel: parseFloat(row.minStockLevel) || 0,
      supplier: row.supplier || '',
      supplier_code: row.supplier_code || '',
      unitPerBox: parseInt(row.unitPerBox) || 1,
      stockBoxes: parseInt(row.stockBoxes) || 0,
      shopifySkus: parseJSONB(row.shopifySkus),
      incoming_orders: parseJSONB(row.incoming_orders, [])
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { 
      name, category, productCode, tag, unit, currentStock, 
      minStockLevel, shopifySkus, supplier, supplier_code, unitPerBox 
    } = req.body;
    
    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }
    
    // Generate new ID
    const maxIdResult = await pool.query(
      `SELECT id FROM products WHERE id LIKE $1 ORDER BY id DESC LIMIT 1`,
      [`${category.toUpperCase()}_%`]
    );
    
    let maxNum = 0;
    if (maxIdResult.rows.length > 0) {
      const parts = maxIdResult.rows[0].id.split('_');
      maxNum = parseInt(parts[1]) || 0;
    }
    
    const newNum = maxNum + 1;
    const newId = `${category.toUpperCase()}_${newNum}`;
    const newTag = tag || `#${category.toUpperCase().substring(0, 2)}${String(newNum).padStart(5, '0')}`;
    const newProductCode = productCode || `${category.toUpperCase()}_${String(newNum).padStart(5, '0')}`;
    const stockBoxes = unitPerBox ? Math.floor((currentStock || 0) / unitPerBox) : 0;
    
    // ✅ Auto-generate SKUs for OILS
    let finalShopifySkus = shopifySkus || {};
    if (category === 'OILS' && (!shopifySkus || Object.keys(shopifySkus).length === 0)) {
      finalShopifySkus = generateAutoSkus(category, newNum);
      console.log(`✨ Auto-generated SKUs for ${newId}`);
    }
    
    const skusJson = JSON.stringify(finalShopifySkus);
    
    const result = await pool.query(
      `INSERT INTO products 
       (id, tag, "productCode", name, category, unit, "currentStock", "minStockLevel", 
        "shopifySkus", supplier, "supplier_code", "unitPerBox", "stockBoxes", "incoming_orders") 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
       RETURNING *`,
      [
        newId, newTag, newProductCode, name, category, unit || 'units', 
        currentStock || 0, minStockLevel || 0, skusJson, 
        supplier || '', supplier_code || '', unitPerBox || 1, stockBoxes, '[]'
      ]
    );
    
    const row = result.rows[0];
    res.json({
      id: row.id,
      tag: row.tag,
      productCode: row.productCode,
      name: row.name,
      category: row.category,
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
      minStockLevel, shopifySkus, supplier, supplier_code, unitPerBox 
    } = req.body;
    
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
       "stockBoxes" = COALESCE($12, "stockBoxes")
       WHERE id = $13
       RETURNING *`,
      [
        name, category, productCode, tag, unit, currentStock, minStockLevel, 
        skusJson, supplier, supplier_code, unitPerBox, stockBoxes, productId
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
       (product_id, product_name, category, type, quantity, unit, balance_after, notes, shopify_order_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [productId, product.name, product.category, 'add', quantity, product.unit, newStock, notes || '', shopifyOrderId || null]
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
    
    if (newStock < 0) {
      throw new Error('Insufficient stock');
    }
    
    await client.query(
      'UPDATE products SET "currentStock" = $1, "stockBoxes" = $2 WHERE id = $3',
      [newStock, Math.floor(newStock / product.unitPerBox), productId]
    );
    
    await client.query(
      `INSERT INTO transactions 
       (product_id, product_name, category, type, quantity, unit, balance_after, notes, shopify_order_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [productId, product.name, product.category, 'remove', quantity, product.unit, newStock, notes || '', shopifyOrderId || null]
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
      
      if (newStock < 0) {
        throw new Error('Insufficient stock - cannot reduce below 0');
      }
    }
    
    // Update product stock
    await client.query(
      'UPDATE products SET "currentStock" = $1, "stockBoxes" = $2 WHERE id = $3',
      [newStock, Math.floor(newStock / (product.unitPerBox || 1)), productId]
    );
    
    // Create transaction record
    await client.query(
      `INSERT INTO transactions 
       (product_id, product_name, category, type, quantity, unit, balance_after, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        productId, 
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
// ATTACHMENTS
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
// SHOPIFY WEBHOOK - INCOMING ORDERS
// ========================================================================
app.post('/api/webhook/shopify', express.json(), async (req, res) => {
  try {
    console.log('📬 Shopify webhook received');
    
    const { line_items, name: orderNumber } = req.body;
    
    if (!line_items || !Array.isArray(line_items)) {
      return res.status(400).json({ error: 'Invalid webhook data' });
    }
    
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
        const incomingOrders = parseJSONB(product.incomingOrders, []);
        
        incomingOrders.push({
          orderNumber,
          sku,
          quantity,
          receivedAt: new Date().toISOString()
        });
        
        await pool.query(
          'UPDATE products SET "incomingOrders" = $1 WHERE id = $2',
          [JSON.stringify(incomingOrders), product.id]
        );
        
        console.log(`✅ Incoming order added: ${product.id} - ${orderNumber}`);
      }
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id/incoming/:index', async (req, res) => {
  try {
    const { id, index } = req.params;
    
    const productResult = await pool.query(
      'SELECT "incomingOrders" FROM products WHERE id = $1',
      [id]
    );
    
    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const incomingOrders = parseJSONB(productResult.rows[0].incomingOrders, []);
    incomingOrders.splice(parseInt(index), 1);
    
    await pool.query(
      'UPDATE products SET "incomingOrders" = $1 WHERE id = $2',
      [JSON.stringify(incomingOrders), id]
    );
    
    res.json({ success: true });
  } catch (error) {
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
  console.log('🚀 SCENT STOCK MANAGER - v4.1');
  console.log('═══════════════════════════════════════════════════');
  console.log(`🌐 Port:        ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('');
  console.log('✅ All fixes applied:');
  console.log('  ✓ Compatible with existing camelCase schema');
  console.log('  ✓ Auto SKU mapping for OILS');
  console.log('  ✓ Sequential ordering fixed');
  console.log('  ✓ Category filters fixed');
  console.log('  ✓ BOM returns grouped object');
  console.log('  ✓ Incoming orders from Shopify');
  console.log('');
  console.log('🎯 Server ready!');
  console.log('');
});
