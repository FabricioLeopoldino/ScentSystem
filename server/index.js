// ========================================================================
// SCENT STOCK MANAGER - FINAL VERSION - SNAKE_CASE SCHEMA
// Version: 4.2 - 100% COMPATIBLE WITH YOUR DATABASE
// ========================================================================
// Uses snake_case columns (product_code, current_stock, etc)
// All your modifications implemented
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

// CORS
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(express.json({ limit: '50mb' }));

// Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false,
  max: 20
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('❌ DB Error:', err.message);
  else console.log('✅ DB Connected:', res.rows[0].now);
});

// Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = join(__dirname, '../uploads');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const name = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    cb(null, name);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });
app.use('/uploads', express.static(join(__dirname, '../uploads')));

// Helpers
const parseJSON = (val, fallback = {}) => {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    const parsed = JSON.parse(val);
    return typeof parsed === 'object' ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
};

const generateAutoSkus = (category, num) => {
  if (category === 'OILS') {
    const pad = String(num).padStart(5, '0');
    return {
      SA_CA: `SA_CA_${pad}`,
      SA_1L: `SA_1L_${pad}`,
      SA_CDIFF: `SA_CDIFF_${pad}`,
      SA_PRO: `SA_PRO_${pad}`,
      SA_HF: `SA_HF_${pad}`
    };
  }
  return {};
};

// ========================================================================
// HEALTH
// ========================================================================
app.get('/api/health', async (req, res) => {
  try {
    const r = await pool.query('SELECT NOW() as now');
    res.json({ status: 'ok', timestamp: r.rows[0].now });
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
    const r = await pool.query('SELECT * FROM users WHERE name = $1', [name]);
    
    if (r.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = r.rows[0];
    if (!bcrypt.compareSync(password, user.password)) {
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
    const r = await pool.query('SELECT id, name, role, created_at FROM users ORDER BY id');
    res.json(r.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name, password, role } = req.body;
    
    const exists = await pool.query('SELECT id FROM users WHERE name = $1', [name]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    const hash = bcrypt.hashSync(password, 10);
    const r = await pool.query(
      'INSERT INTO users (name, password, role) VALUES ($1, $2, $3) RETURNING id, name, role, created_at',
      [name, hash, role || 'user']
    );
    
    res.json(r.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const u = await pool.query('SELECT role FROM users WHERE id = $1', [id]);
    
    if (u.rows.length > 0 && u.rows[0].role === 'admin') {
      return res.status(403).json({ error: 'Cannot delete admin' });
    }
    
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:id/password', async (req, res) => {
  try {
    const { password } = req.body;
    const id = parseInt(req.params.id);
    const hash = bcrypt.hashSync(password, 10);
    
    const r = await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2 RETURNING id',
      [hash, id]
    );
    
    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================================
// PRODUCTS - AUTO SKU + SEQUENTIAL ORDER
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
    
    query += ' ORDER BY tag';
    
    const r = await pool.query(query, params);
    
    const products = r.rows.map(row => ({
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
      shopifySkus: parseJSON(row.shopify_skus),
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
    const r = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    
    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const row = r.rows[0];
    res.json({
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
      shopifySkus: parseJSON(row.shopify_skus)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { 
      name, category, productCode, tag, unit, currentStock, 
      minStockLevel, shopifySkus, supplier, supplierCode, unitPerBox 
    } = req.body;
    
    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category required' });
    }
    
    // Get max ID
    const maxR = await pool.query(
      `SELECT id FROM products WHERE id LIKE $1 ORDER BY id DESC LIMIT 1`,
      [`${category.toUpperCase()}_%`]
    );
    
    let maxNum = 0;
    if (maxR.rows.length > 0) {
      const parts = maxR.rows[0].id.split('_');
      maxNum = parseInt(parts[1]) || 0;
    }
    
    const newNum = maxNum + 1;
    const newId = `${category.toUpperCase()}_${newNum}`;
    const newTag = tag || `#${category.toUpperCase().substring(0, 2)}${String(newNum).padStart(5, '0')}`;
    const newCode = productCode || `${category.toUpperCase()}_${String(newNum).padStart(5, '0')}`;
    const boxes = unitPerBox ? Math.floor((currentStock || 0) / unitPerBox) : 0;
    
    // Auto-generate SKUs for OILS
    let finalSkus = shopifySkus || {};
    if (category === 'OILS' && (!shopifySkus || Object.keys(shopifySkus).length === 0)) {
      finalSkus = generateAutoSkus(category, newNum);
      console.log(`✨ Auto SKUs generated for ${newId}`);
    }
    
    const r = await pool.query(
      `INSERT INTO products 
       (id, tag, product_code, name, category, unit, current_stock, min_stock_level, 
        shopify_skus, supplier, supplier_code, unit_per_box, stock_boxes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
       RETURNING *`,
      [
        newId, newTag, newCode, name, category, unit || 'units', 
        currentStock || 0, minStockLevel || 0, JSON.stringify(finalSkus), 
        supplier || '', supplierCode || '', unitPerBox || 1, boxes
      ]
    );
    
    const row = r.rows[0];
    res.json({
      id: row.id,
      tag: row.tag,
      productCode: row.product_code,
      name: row.name,
      category: row.category,
      unit: row.unit,
      currentStock: parseFloat(row.current_stock),
      minStockLevel: parseFloat(row.min_stock_level),
      supplier: row.supplier,
      supplierCode: row.supplier_code,
      unitPerBox: parseInt(row.unit_per_box),
      stockBoxes: parseInt(row.stock_boxes),
      shopifySkus: parseJSON(row.shopify_skus)
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { 
      name, category, productCode, tag, unit, currentStock, 
      minStockLevel, shopifySkus, supplier, supplierCode, unitPerBox 
    } = req.body;
    
    const boxes = unitPerBox && currentStock 
      ? Math.floor(currentStock / unitPerBox) 
      : null;
    
    let skusJson = null;
    if (shopifySkus !== undefined) {
      skusJson = JSON.stringify(shopifySkus);
    }
    
    const r = await pool.query(
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
        skusJson, supplier, supplierCode, unitPerBox, boxes, req.params.id
      ]
    );
    
    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const row = r.rows[0];
    res.json({
      id: row.id,
      tag: row.tag,
      productCode: row.product_code,
      name: row.name,
      category: row.category,
      currentStock: parseFloat(row.current_stock),
      shopifySkus: parseJSON(row.shopify_skus)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM transactions WHERE product_id = $1', [req.params.id]);
    const r = await client.query('DELETE FROM products WHERE id = $1 RETURNING id', [req.params.id]);
    if (r.rows.length === 0) throw new Error('Product not found');
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
// STOCK
// ========================================================================
app.post('/api/stock/add', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { productId, quantity, notes, shopifyOrderId } = req.body;
    if (!productId || !quantity || quantity <= 0) {
      throw new Error('Invalid input');
    }
    
    const pr = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [productId]);
    if (pr.rows.length === 0) throw new Error('Product not found');
    
    const p = pr.rows[0];
    const newStock = parseFloat(p.current_stock) + parseFloat(quantity);
    
    await client.query(
      'UPDATE products SET current_stock = $1, stock_boxes = $2 WHERE id = $3',
      [newStock, Math.floor(newStock / p.unit_per_box), productId]
    );
    
    await client.query(
      `INSERT INTO transactions 
       (product_id, product_name, category, type, quantity, unit, balance_after, notes, shopify_order_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [productId, p.name, p.category, 'add', quantity, p.unit, newStock, notes || '', shopifyOrderId || null]
    );
    
    await client.query('COMMIT');
    res.json({ success: true, newStock });
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
    
    const pr = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [productId]);
    if (pr.rows.length === 0) throw new Error('Product not found');
    
    const p = pr.rows[0];
    const newStock = parseFloat(p.current_stock) - parseFloat(quantity);
    if (newStock < 0) throw new Error('Insufficient stock');
    
    await client.query(
      'UPDATE products SET current_stock = $1, stock_boxes = $2 WHERE id = $3',
      [newStock, Math.floor(newStock / p.unit_per_box), productId]
    );
    
    await client.query(
      `INSERT INTO transactions 
       (product_id, product_name, category, type, quantity, unit, balance_after, notes, shopify_order_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [productId, p.name, p.category, 'remove', quantity, p.unit, newStock, notes || '', shopifyOrderId || null]
    );
    
    await client.query('COMMIT');
    res.json({ success: true, newStock });
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
    
    const r = await pool.query(query, params);
    res.json(r.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================================
// DASHBOARD
// ========================================================================
app.get('/api/dashboard', async (req, res) => {
  try {
    const [pCount, trans, lowStock] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM products'),
      pool.query('SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10'),
      pool.query('SELECT COUNT(*) as count FROM products WHERE current_stock < min_stock_level')
    ]);
    
    const oilVol = await pool.query(`
      SELECT COALESCE(SUM(current_stock), 0) as total 
      FROM products 
      WHERE category = 'OILS'
    `);
    
    res.json({
      totalProducts: parseInt(pCount.rows[0].count),
      lowStockCount: parseInt(lowStock.rows[0].count),
      totalStockValue: {
        oils: parseFloat(oilVol.rows[0].total)
      },
      recentTransactions: trans.rows
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
    
    const r = await pool.query(query, params);
    
    const grouped = {};
    r.rows.forEach(row => {
      if (!grouped[row.variant]) grouped[row.variant] = [];
      grouped[row.variant].push({
        seq: row.seq,
        componentCode: row.component_code,
        componentName: row.component_name,
        quantity: parseFloat(row.quantity)
      });
    });
    
    res.json(grouped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bom', async (req, res) => {
  try {
    const { variant, componentCode, componentName, quantity } = req.body;
    
    const exists = await pool.query(
      'SELECT * FROM bom WHERE variant = $1 AND component_code = $2',
      [variant, componentCode]
    );
    
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: 'Component already exists' });
    }
    
    const seqR = await pool.query(
      'SELECT COALESCE(MAX(seq), 0) + 1 as next_seq FROM bom WHERE variant = $1',
      [variant]
    );
    
    await pool.query(
      'INSERT INTO bom (variant, seq, component_code, component_name, quantity) VALUES ($1, $2, $3, $4, $5)',
      [variant, seqR.rows[0].next_seq, componentCode, componentName, quantity]
    );
    
    const r = await pool.query('SELECT * FROM bom WHERE variant = $1 ORDER BY seq', [variant]);
    
    const components = r.rows.map(row => ({
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
    
    const r = await pool.query(
      `UPDATE bom SET 
       component_name = COALESCE($1, component_name),
       quantity = COALESCE($2, quantity)
       WHERE variant = $3 AND component_code = $4
       RETURNING *`,
      [componentName, quantity, variant, componentCode]
    );
    
    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'Component not found' });
    }
    
    const all = await pool.query('SELECT * FROM bom WHERE variant = $1 ORDER BY seq', [variant]);
    
    const components = all.rows.map(row => ({
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
    
    const delR = await client.query(
      'DELETE FROM bom WHERE variant = $1 AND component_code = $2 RETURNING id',
      [variant, componentCode]
    );
    
    if (delR.rows.length === 0) throw new Error('Component not found');
    
    const comps = await client.query('SELECT * FROM bom WHERE variant = $1 ORDER BY seq', [variant]);
    
    for (let i = 0; i < comps.rows.length; i++) {
      await client.query('UPDATE bom SET seq = $1 WHERE id = $2', [i + 1, comps.rows[i].id]);
    }
    
    await client.query('COMMIT');
    
    const r = await pool.query('SELECT * FROM bom WHERE variant = $1 ORDER BY seq', [variant]);
    
    const components = r.rows.map(row => ({
      seq: row.seq,
      componentCode: row.component_code,
      componentName: row.component_name,
      quantity: parseFloat(row.quantity)
    }));
    
    res.json({ success: true, bom: components });
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
    
    const r = await pool.query(query, params);
    res.json(r.rows);
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
    
    const r = await pool.query(
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
        associatedOilName || 'General',
        uploadedBy || 'admin',
        notes || ''
      ]
    );
    
    res.json(r.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/attachments/:id', async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM attachments WHERE id = $1 RETURNING stored_file_name',
      [parseInt(req.params.id)]
    );
    
    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    
    const filePath = join(__dirname, '../uploads', r.rows[0].stored_file_name);
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
    const r = await pool.query('SELECT * FROM products ORDER BY tag');
    const products = r.rows.map(row => ({
      id: row.id,
      tag: row.tag,
      productCode: row.product_code,
      name: row.name,
      currentStock: parseFloat(row.current_stock),
      shopifySkus: parseJSON(row.shopify_skus)
    }));
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/export/transactions', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM transactions ORDER BY created_at DESC');
    res.json(r.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================================
// SHOPIFY WEBHOOK
// ========================================================================
app.post('/api/webhook/shopify', express.json(), async (req, res) => {
  try {
    console.log('📬 Shopify webhook');
    res.status(200).json({ received: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================================
// FRONTEND
// ========================================================================
const distPath = join(__dirname, '../dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  console.log('📦 Frontend from dist/');
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

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('🚀 SCENT SYSTEM v4.2 READY');
  console.log(`Port: ${PORT}`);
  console.log('✅ All fixes applied');
  console.log('');
});
