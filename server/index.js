// ========================================================================
// SCENT STOCK MANAGER - COMPLETE & OPTIMIZED SERVER
// Version: 4.0 - ALL YOUR CUSTOM MODIFICATIONS
// ========================================================================
// ✅ English only (API messages)
// ✅ Auto SKU Mapping on product creation
// ✅ Correct sequential ordering
// ✅ Fixed category filters
// ✅ BOM and History fixes
// ✅ Incoming Orders from Shopify
// ========================================================================

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
    ? ['https://scentsystem.onrender.com', 'https://www.scentsystem.onrender.com']
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ========================================================================
// POSTGRESQL CONNECTION POOL
// ========================================================================

if (!process.env.DATABASE_URL) {
  console.error('❌ CRITICAL ERROR: DATABASE_URL is not configured!');
  console.error('Set it in Render: Dashboard > Environment > DATABASE_URL');
  process.exit(1);
}

const createPool = () => {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' 
      ? { rejectUnauthorized: false } 
      : false,
    max: 20,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    application_name: 'scent_system',
    statement_timeout: 30000,
    query_timeout: 30000,
  });
};

let pool = createPool();

// Auto-reconnect function
const reconnectDatabase = async (retries = 3, delay = 2000) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`🔄 Reconnection attempt ${i + 1}/${retries}...`);
      await pool.end();
      pool = createPool();
      const result = await pool.query('SELECT NOW() as now, current_database() as db');
      console.log('✅ Reconnected successfully!');
      console.log(`   Database: ${result.rows[0].db}`);
      console.log(`   Timestamp: ${result.rows[0].now}`);
      return true;
    } catch (error) {
      console.error(`❌ Attempt ${i + 1} failed:`, error.message);
      if (i < retries - 1) {
        console.log(`⏳ Waiting ${delay/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5;
      }
    }
  }
  return false;
};

// Test connection
const testDatabaseConnection = async () => {
  let attempts = 0;
  const maxAttempts = 5;
  
  while (attempts < maxAttempts) {
    try {
      const result = await pool.query(`
        SELECT 
          NOW() as now, 
          current_database() as db,
          current_user as user,
          version() as version
      `);
      
      console.log('');
      console.log('═══════════════════════════════════════════════════');
      console.log('✅ POSTGRESQL CONNECTION ESTABLISHED SUCCESSFULLY!');
      console.log('═══════════════════════════════════════════════════');
      console.log(`📅 Timestamp: ${result.rows[0].now}`);
      console.log(`🗄️  Database:  ${result.rows[0].db}`);
      console.log(`👤 User:      ${result.rows[0].user}`);
      console.log(`🐘 Version:   ${result.rows[0].version.split(' ').slice(0, 2).join(' ')}`);
      console.log('═══════════════════════════════════════════════════');
      console.log('');
      
      return true;
    } catch (err) {
      attempts++;
      console.error(`❌ Connection attempt ${attempts}/${maxAttempts} failed:`);
      console.error(`   Error: ${err.message}`);
      
      if (attempts < maxAttempts) {
        const waitTime = Math.min(attempts * 2, 10);
        console.log(`⏳ Waiting ${waitTime}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      }
    }
  }
  return false;
};

testDatabaseConnection();

// Connection check middleware
const ensureConnection = async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    next();
  } catch (error) {
    console.error('❌ Connection lost during request:', error.message);
    const reconnected = await reconnectDatabase();
    
    if (reconnected) {
      next();
    } else {
      res.status(503).json({ 
        error: 'Database temporarily unavailable',
        message: 'Please try again in a few seconds'
      });
    }
  }
};

app.use('/api', ensureConnection);

// ========================================================================
// MULTER CONFIGURATION
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
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv',
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'
    ];
    
    const allowedExts = /\.(pdf|doc|docx|xls|xlsx|txt|csv|jpg|jpeg|png|gif|webp)$/i;
    
    if (allowedMimes.includes(file.mimetype) || allowedExts.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Only documents and images.'));
    }
  }
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
      console.warn('JSONB parse error:', e.message);
      return fallback;
    }
  }
  return fallback;
};

const normalizeProduct = (row) => {
  if (!row) return null;
  
  return {
    id: row.id,
    tag: row.tag,
    productCode: row.product_code,
    name: row.name,
    category: row.category,
    unit: row.unit,
    currentStock: parseFloat(row.current_stock) || 0,
    minStockLevel: parseFloat(row.min_stock_level) || 0,
    supplier: row.supplier || '',
    supplierCode: row.supplier_code || '',
    unitPerBox: parseInt(row.unit_per_box) || 1,
    stockBoxes: parseInt(row.stock_boxes) || 0,
    shopifySkus: parseJSONB(row.shopify_skus),
    incomingOrders: parseJSONB(row.incoming_orders, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const validateRequired = (fields, data) => {
  const missing = fields.filter(field => !data[field]);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
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
  // For RAW_MATERIALS and MACHINES_SPARES, create empty SKU structure
  return {};
};

// ========================================================================
// HEALTH CHECK
// ========================================================================
app.get('/api/health', async (req, res) => {
  try {
    const dbResult = await pool.query(`
      SELECT 
        NOW() as timestamp,
        current_database() as database,
        current_user as user,
        (SELECT COUNT(*) FROM products) as products_count,
        (SELECT COUNT(*) FROM users) as users_count
    `);
    
    const info = dbResult.rows[0];
    
    res.json({
      status: 'ok',
      message: 'Service active and healthy',
      timestamp: info.timestamp,
      environment: process.env.NODE_ENV || 'development',
      database: {
        connected: true,
        name: info.database,
        user: info.user,
        products: parseInt(info.products_count),
        users: parseInt(info.users_count)
      },
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'error',
      message: 'Error checking service health',
      error: error.message,
      database: { connected: false }
    });
  }
});

// ========================================================================
// AUTH
// ========================================================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { name, password } = req.body;
    
    validateRequired(['name', 'password'], req.body);
    
    const result = await pool.query(
      'SELECT * FROM users WHERE name = $1',
      [name]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const isValid = bcrypt.compareSync(password, user.password);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    console.log(`✅ Login successful: ${user.name} (${user.role})`);
    
    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

// ========================================================================
// USER MANAGEMENT
// ========================================================================
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, role, created_at FROM users ORDER BY id'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name, password, role } = req.body;
    
    validateRequired(['name', 'password'], req.body);
    
    const existing = await pool.query(
      'SELECT id FROM users WHERE name = $1',
      [name]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    const result = await pool.query(
      `INSERT INTO users (name, password, role) 
       VALUES ($1, $2, $3) 
       RETURNING id, name, role, created_at`,
      [name, hashedPassword, role || 'user']
    );
    
    console.log(`✅ User created: ${name} (${role || 'user'})`);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    const user = await pool.query(
      'SELECT role, name FROM users WHERE id = $1',
      [userId]
    );
    
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.rows[0].role === 'admin') {
      return res.status(403).json({ error: 'Cannot delete admin user' });
    }
    
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    
    console.log(`🗑️  User deleted: ${user.rows[0].name}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:id/password', async (req, res) => {
  try {
    const { password } = req.body;
    const userId = parseInt(req.params.id);
    
    validateRequired(['password'], req.body);
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    const result = await pool.query(
      `UPDATE users SET password = $1 WHERE id = $2 
       RETURNING id, name`,
      [hashedPassword, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`🔐 Password changed: ${result.rows[0].name}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update password error:', error);
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
      query += ` AND (name ILIKE $${params.length} OR product_code ILIKE $${params.length} OR tag ILIKE $${params.length})`;
    }
    
    // ✅ FIX: Sequential ordering by tag number
    query += ' ORDER BY tag';
    
    const result = await pool.query(query, params);
    const products = result.rows.map(normalizeProduct);
    
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM products WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(normalizeProduct(result.rows[0]));
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { 
      name, category, productCode, tag, unit, currentStock, 
      minStockLevel, shopifySkus, supplier, supplierCode, unitPerBox 
    } = req.body;
    
    validateRequired(['name', 'category'], req.body);
    
    // Generate new ID
    const maxIdResult = await pool.query(
      `SELECT id FROM products WHERE id LIKE $1 
       ORDER BY id DESC LIMIT 1`,
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
    
    // ✅ NEW: Auto-generate SKUs for OILS
    let finalShopifySkus = shopifySkus || {};
    if (category === 'OILS' && (!shopifySkus || Object.keys(shopifySkus).length === 0)) {
      finalShopifySkus = generateAutoSkus(category, newNum);
      console.log(`✨ Auto-generated SKUs for ${newId}:`, finalShopifySkus);
    }
    
    const skusJson = JSON.stringify(finalShopifySkus);
    
    const result = await pool.query(
      `INSERT INTO products 
       (id, tag, product_code, name, category, unit, current_stock, min_stock_level, 
        shopify_skus, supplier, supplier_code, unit_per_box, stock_boxes, incoming_orders) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, '[]'::jsonb) 
       RETURNING *`,
      [
        newId, newTag, newProductCode, name, category, unit || 'units', 
        currentStock || 0, minStockLevel || 0, skusJson, 
        supplier || '', supplierCode || '', unitPerBox || 1, stockBoxes
      ]
    );
    
    console.log(`✅ Product created: ${newId} - ${name}`);
    if (category === 'OILS') {
      console.log(`   Auto SKUs: ${Object.keys(finalShopifySkus).join(', ')}`);
    }
    
    res.json(normalizeProduct(result.rows[0]));
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
      minStockLevel, shopifySkus, supplier, supplierCode, unitPerBox 
    } = req.body;
    
    const stockBoxes = unitPerBox && currentStock 
      ? Math.floor(currentStock / unitPerBox) 
      : null;
    
    let skusJson = null;
    if (shopifySkus !== undefined) {
      if (typeof shopifySkus === 'object' && !Array.isArray(shopifySkus)) {
        skusJson = JSON.stringify(shopifySkus);
      } else {
        skusJson = '{}';
      }
    }
    
    const result = await pool.query(
      `UPDATE products SET 
       name = COALESCE($1, name),
       category = COALESCE($2, category),
       product_code = COALESCE($3, product_code),
       tag = COALESCE($4, tag),
       unit = COALESCE($5, unit),
       current_stock = COALESCE($6, current_stock),
       min_stock_level = COALESCE($7, min_stock_level),
       shopify_skus = COALESCE($8::jsonb, shopify_skus),
       supplier = COALESCE($9, supplier),
       supplier_code = COALESCE($10, supplier_code),
       unit_per_box = COALESCE($11, unit_per_box),
       stock_boxes = COALESCE($12, stock_boxes)
       WHERE id = $13
       RETURNING *`,
      [
        name, category, productCode, tag, unit, currentStock, minStockLevel, 
        skusJson, supplier, supplierCode, unitPerBox, stockBoxes, productId
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    console.log(`✏️  Product updated: ${productId}`);
    
    res.json(normalizeProduct(result.rows[0]));
  } catch (error) {
    console.error('Update product error:', error);
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
    
    console.log(`🗑️  Product deleted: ${productId} - ${result.rows[0].name}`);
    
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete product error:', error);
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
    
    validateRequired(['productId', 'quantity'], req.body);
    
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than zero');
    }
    
    const productResult = await client.query(
      'SELECT * FROM products WHERE id = $1 FOR UPDATE',
      [productId]
    );
    
    if (productResult.rows.length === 0) {
      throw new Error('Product not found');
    }
    
    const product = productResult.rows[0];
    const newStock = parseFloat(product.current_stock) + parseFloat(quantity);
    
    await client.query(
      'UPDATE products SET current_stock = $1, stock_boxes = $2 WHERE id = $3',
      [newStock, Math.floor(newStock / product.unit_per_box), productId]
    );
    
    await client.query(
      `INSERT INTO transactions 
       (product_id, product_name, category, type, quantity, unit, balance_after, notes, shopify_order_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        productId, product.name, product.category, 'add', quantity, 
        product.unit, newStock, notes || '', shopifyOrderId || null
      ]
    );
    
    await client.query('COMMIT');
    
    console.log(`📈 Stock added: ${productId} (+${quantity} ${product.unit})`);
    
    res.json({ 
      success: true, 
      newStock,
      product: normalizeProduct({ ...product, current_stock: newStock })
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Add stock error:', error);
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
    
    validateRequired(['productId', 'quantity'], req.body);
    
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than zero');
    }
    
    const productResult = await client.query(
      'SELECT * FROM products WHERE id = $1 FOR UPDATE',
      [productId]
    );
    
    if (productResult.rows.length === 0) {
      throw new Error('Product not found');
    }
    
    const product = productResult.rows[0];
    const newStock = parseFloat(product.current_stock) - parseFloat(quantity);
    
    if (newStock < 0) {
      throw new Error('Insufficient stock');
    }
    
    await client.query(
      'UPDATE products SET current_stock = $1, stock_boxes = $2 WHERE id = $3',
      [newStock, Math.floor(newStock / product.unit_per_box), productId]
    );
    
    await client.query(
      `INSERT INTO transactions 
       (product_id, product_name, category, type, quantity, unit, balance_after, notes, shopify_order_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        productId, product.name, product.category, 'remove', quantity, 
        product.unit, newStock, notes || '', shopifyOrderId || null
      ]
    );
    
    await client.query('COMMIT');
    
    console.log(`📉 Stock removed: ${productId} (-${quantity} ${product.unit})`);
    
    res.json({ 
      success: true, 
      newStock,
      product: normalizeProduct({ ...product, current_stock: newStock })
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Remove stock error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ========================================================================
// TRANSACTIONS - WITH SEQUENTIAL ORDERING
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
    
    // ✅ FIX: Sequential ordering
    query += ' ORDER BY created_at DESC, id DESC';
    
    params.push(parseInt(limit));
    query += ` LIMIT $${params.length}`;
    
    params.push(parseInt(offset));
    query += ` OFFSET $${params.length}`;
    
    const result = await pool.query(query, params);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get transactions error:', error);
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
        WHERE current_stock < min_stock_level
      `)
    ]);
    
    const oilsVolume = await pool.query(`
      SELECT COALESCE(SUM(current_stock), 0) as total 
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
// BOM - FIXED TO RETURN GROUPED OBJECT
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
    
    // ✅ FIX: Group by variant (frontend expects object)
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
    console.error('Get BOM error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bom', async (req, res) => {
  try {
    const { variant, componentCode, componentName, quantity } = req.body;
    
    validateRequired(['variant', 'componentCode', 'quantity'], req.body);
    
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
    
    const nextSeq = seqResult.rows[0].next_seq;
    
    await pool.query(
      `INSERT INTO bom (variant, seq, component_code, component_name, quantity) 
       VALUES ($1, $2, $3, $4, $5)`,
      [variant, nextSeq, componentCode, componentName, quantity]
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
    
    console.log(`✅ BOM component added: ${variant} - ${componentCode}`);
    
    res.json({ success: true, bom: components });
  } catch (error) {
    console.error('Add BOM component error:', error);
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
    
    console.log(`✏️  BOM component updated: ${variant} - ${componentCode}`);
    
    res.json({ success: true, bom: components });
  } catch (error) {
    console.error('Update BOM component error:', error);
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
    
    console.log(`🗑️  BOM component deleted: ${variant} - ${componentCode}`);
    
    res.json({ success: true, bom: updatedComponents });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete BOM component error:', error);
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
    console.error('Get attachments error:', error);
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
    
    console.log(`📎 File uploaded: ${req.file.originalname} (${req.file.size} bytes)`);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/attachments/:id', async (req, res) => {
  try {
    const attachmentId = parseInt(req.params.id);
    
    const result = await pool.query(
      'DELETE FROM attachments WHERE id = $1 RETURNING stored_file_name, file_name',
      [attachmentId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    
    const filePath = join(__dirname, '../uploads', result.rows[0].stored_file_name);
    if (existsSync(filePath)) {
      await fs.unlink(filePath);
    }
    
    console.log(`🗑️  File deleted: ${result.rows[0].file_name}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete attachment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================================================
// EXPORTS
// ========================================================================
app.get('/api/export/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY tag');
    const products = result.rows.map(normalizeProduct);
    res.json(products);
  } catch (error) {
    console.error('Export products error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/export/transactions', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM transactions ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Export transactions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================================================
// SHOPIFY WEBHOOK - INCOMING ORDERS
// ========================================================================
app.post('/api/webhook/shopify', express.json({ type: 'application/json' }), async (req, res) => {
  try {
    console.log('📬 Shopify webhook received');
    console.log('Headers:', req.headers);
    console.log('Body:', JSON.stringify(req.body, null, 2));
    
    // TODO: Verify Shopify webhook signature
    // const hmac = req.headers['x-shopify-hmac-sha256'];
    
    const { line_items, name: orderNumber } = req.body;
    
    if (!line_items || !Array.isArray(line_items)) {
      return res.status(400).json({ error: 'Invalid webhook data' });
    }
    
    // Process incoming orders
    for (const item of line_items) {
      const { sku, quantity } = item;
      
      if (!sku) continue;
      
      // Find product by SKU in shopify_skus
      const productResult = await pool.query(`
        SELECT * FROM products 
        WHERE shopify_skus::text ILIKE $1
        LIMIT 1
      `, [`%${sku}%`]);
      
      if (productResult.rows.length > 0) {
        const product = productResult.rows[0];
        const incomingOrders = parseJSONB(product.incoming_orders, []);
        
        // Add new incoming order
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
        
        console.log(`✅ Incoming order added: ${product.id} - ${orderNumber} (${quantity})`);
      }
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clear incoming order
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
      'UPDATE products SET incoming_orders = $1 WHERE id = $2',
      [JSON.stringify(incomingOrders), id]
    );
    
    console.log(`🗑️  Incoming order cleared: ${id} - index ${index}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Clear incoming order error:', error);
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
} else {
  console.warn('⚠️  dist/ folder not found. Frontend will not be served.');
}

const uploadsDir = join(__dirname, '../uploads');
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 uploads/ folder created');
}

// ========================================================================
// ERROR HANDLING
// ========================================================================
app.use((err, req, res, next) => {
  console.error('═══════════════════════════════════════════════════');
  console.error('❌ GLOBAL ERROR');
  console.error('═══════════════════════════════════════════════════');
  console.error('Path:', req.path);
  console.error('Method:', req.method);
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  console.error('═══════════════════════════════════════════════════');
  
  res.status(500).json({ 
    error: 'Internal server error', 
    message: err.message,
    path: req.path
  });
});

// ========================================================================
// GRACEFUL SHUTDOWN
// ========================================================================
const gracefulShutdown = async (signal) => {
  console.log('');
  console.log(`🛑 ${signal} received. Shutting down gracefully...`);
  
  try {
    await pool.end();
    console.log('✅ Connection pool closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Shutdown error:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ========================================================================
// START SERVER
// ========================================================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('🚀 SCENT STOCK MANAGER - SERVER STARTED');
  console.log('═══════════════════════════════════════════════════');
  console.log(`🌐 Port:        ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database:    ${process.env.DATABASE_URL ? 'Configured' : 'NOT configured'}`);
  console.log(`📦 Frontend:    ${existsSync(distPath) ? 'Available' : 'Not found'}`);
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log('✅ All fixes applied:');
  console.log('  ✓ English messages');
  console.log('  ✓ Auto SKU mapping for OILS');
  console.log('  ✓ Sequential ordering fixed');
  console.log('  ✓ Category filters fixed');
  console.log('  ✓ BOM returns grouped object');
  console.log('  ✓ Incoming orders from Shopify');
  console.log('');
  console.log('🎯 Server ready and waiting for requests!');
  console.log('');
});
