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
app.use(cors());
app.use(express.json());

// PostgreSQL Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err);
  } else {
    console.log('✅ Database connected successfully at', res.rows[0].now);
  }
});

// Configure multer for file uploads (você pode usar Cloudinary ou S3 depois)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = join(__dirname, '../uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|xls|xlsx|txt|jpg|jpeg|png|gif|csv/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype || extname) {
      return cb(null, true);
    }
    cb(new Error('Only documents and images are allowed'));
  }
});

// Serve uploaded files
app.use('/uploads', express.static(join(__dirname, '../uploads')));

// ==================== AUTH ====================
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
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== USER MANAGEMENT ====================
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
    
    // Check if user exists
    const existingUser = await pool.query('SELECT id FROM users WHERE name = $1', [name]);
    if (existingUser.rows.length > 0) {
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
    
    // Check if user is admin
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

// ==================== PRODUCTS ====================
app.get('/api/products', async (req, res) => {
  try {
    const { category } = req.query;
    
    let query = 'SELECT * FROM products';
    let params = [];
    
    if (category) {
      query += ' WHERE category = $1';
      params.push(category);
    }
    
    query += ' ORDER BY id';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { name, category, productCode, tag, unit, currentStock, minStockLevel, shopifySkus, supplier, supplierCode, unitPerBox } = req.body;
    
    // Generate new ID
    const maxIdResult = await pool.query(
      `SELECT id FROM products WHERE id LIKE $1 ORDER BY id DESC LIMIT 1`,
      [`${category.toLowerCase()}_%`]
    );
    
    let maxNum = 0;
    if (maxIdResult.rows.length > 0) {
      const parts = maxIdResult.rows[0].id.split('_');
      maxNum = parseInt(parts[1]) || 0;
    }
    
    const newId = `${category.toLowerCase()}_${maxNum + 1}`;
    const newTag = tag || `#${category}${String(maxNum + 1).padStart(5, '0')}`;
    const newProductCode = productCode || `${category}_${String(maxNum + 1).padStart(5, '0')}`;
    const stockBoxes = unitPerBox ? Math.floor((currentStock || 0) / unitPerBox) : 0;
    
    const result = await pool.query(
      `INSERT INTO products 
       (id, tag, product_code, name, category, unit, current_stock, min_stock_level, 
        shopify_skus, supplier, supplier_code, unit_per_box, stock_boxes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
       RETURNING *`,
      [newId, newTag, newProductCode, name, category, unit || 'units', 
       currentStock || 0, minStockLevel || 0, JSON.stringify(shopifySkus || {}), 
       supplier || '', supplierCode || '', unitPerBox || 1, stockBoxes]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const { name, category, productCode, tag, unit, currentStock, minStockLevel, 
            shopifySkus, supplier, supplierCode, unitPerBox } = req.body;
    
    const stockBoxes = unitPerBox && currentStock ? Math.floor(currentStock / unitPerBox) : 0;
    
    const result = await pool.query(
      `UPDATE products SET 
       name = COALESCE($1, name),
       category = COALESCE($2, category),
       product_code = COALESCE($3, product_code),
       tag = COALESCE($4, tag),
       unit = COALESCE($5, unit),
       current_stock = COALESCE($6, current_stock),
       min_stock_level = COALESCE($7, min_stock_level),
       shopify_skus = COALESCE($8, shopify_skus),
       supplier = COALESCE($9, supplier),
       supplier_code = COALESCE($10, supplier_code),
       unit_per_box = COALESCE($11, unit_per_box),
       stock_boxes = $12
       WHERE id = $13
       RETURNING *`,
      [name, category, productCode, tag, unit, currentStock, minStockLevel, 
       shopifySkus ? JSON.stringify(shopifySkus) : null, supplier, supplierCode, 
       unitPerBox, stockBoxes, productId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== STOCK ADJUSTMENT ====================
app.post('/api/stock/adjust', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { productId, quantity, type, notes } = req.body;
    
    // Get current product
    const productResult = await client.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (productResult.rows.length === 0) {
      throw new Error('Product not found');
    }
    
    const product = productResult.rows[0];
    const oldStock = parseFloat(product.current_stock);
    const newStock = type === 'add' ? oldStock + quantity : oldStock - quantity;
    
    // Update product stock
    const stockBoxes = product.unit_per_box > 1 ? Math.floor(newStock / product.unit_per_box) : 0;
    
    await client.query(
      'UPDATE products SET current_stock = $1, stock_boxes = $2 WHERE id = $3',
      [newStock, stockBoxes, productId]
    );
    
    // Create transaction record
    await client.query(
      `INSERT INTO transactions 
       (product_id, product_name, category, type, quantity, unit, balance_after, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [productId, product.name, product.category, type, quantity, product.unit, newStock, notes || '']
    );
    
    await client.query('COMMIT');
    
    res.json({ success: true, newStock });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Stock adjustment error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ==================== TRANSACTIONS ====================
app.get('/api/transactions', async (req, res) => {
  try {
    const { productId, limit = 100 } = req.query;
    
    let query = 'SELECT * FROM transactions';
    let params = [];
    
    if (productId) {
      query += ' WHERE product_id = $1';
      params.push(productId);
    }
    
    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(parseInt(limit));
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== SHOPIFY WEBHOOK ====================
app.post('/api/webhooks/shopify/orders/create', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const order = req.body;
    console.log('📦 Shopify webhook received - Order:', order.order_number || order.id);
    
    if (!order.line_items || order.line_items.length === 0) {
      console.log('⚠️ No line items in order');
      return res.json({ success: true, message: 'No items to process' });
    }
    
    // Process each line item
    for (const item of order.line_items) {
      const sku = item.sku?.trim();
      const quantity = item.quantity || 1;
      
      if (!sku) {
        console.log('⚠️ Item without SKU:', item.name);
        continue;
      }
      
      // Find product by shopify_skus
      const productResult = await client.query(
        `SELECT * FROM products WHERE shopify_skus ? $1`,
        [sku]
      );
      
      if (productResult.rows.length > 0) {
        const product = productResult.rows[0];
        const skuData = product.shopify_skus[sku];
        const qtyToDeduct = quantity * (skuData?.quantity || 1);
        
        const oldStock = parseFloat(product.current_stock);
        const newStock = oldStock - qtyToDeduct;
        const stockBoxes = product.unit_per_box > 1 ? Math.floor(newStock / product.unit_per_box) : 0;
        
        // Update stock
        await client.query(
          'UPDATE products SET current_stock = $1, stock_boxes = $2 WHERE id = $3',
          [newStock, stockBoxes, product.id]
        );
        
        // Log transaction
        await client.query(
          `INSERT INTO transactions 
           (product_id, product_name, category, type, quantity, unit, balance_after, notes, shopify_order_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [product.id, product.name, product.category, 'remove', qtyToDeduct, 
           product.unit, newStock, `Shopify Order #${order.order_number || 'N/A'}`, 
           order.id?.toString() || Date.now().toString()]
        );
        
        console.log(`✅ Deducted: ${product.name} - ${qtyToDeduct} ${product.unit}`);
      } else {
        // Try simple products (direct SKU match to product code)
        const simpleResult = await client.query(
          `SELECT * FROM products WHERE product_code = $1 OR tag = $1`,
          [sku]
        );
        
        if (simpleResult.rows.length > 0) {
          const product = simpleResult.rows[0];
          const oldStock = parseFloat(product.current_stock);
          const newStock = oldStock - quantity;
          const stockBoxes = product.unit_per_box > 1 ? Math.floor(newStock / product.unit_per_box) : 0;
          
          await client.query(
            'UPDATE products SET current_stock = $1, stock_boxes = $2 WHERE id = $3',
            [newStock, stockBoxes, product.id]
          );
          
          await client.query(
            `INSERT INTO transactions 
             (product_id, product_name, category, type, quantity, unit, balance_after, notes, shopify_order_id) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [product.id, product.name, product.category, 'remove', quantity, 
             product.unit, newStock, `Shopify Order #${order.order_number || 'N/A'}`, 
             order.id?.toString() || Date.now().toString()]
          );
          
          console.log(`✅ Product deducted: ${product.name} - ${quantity} ${product.unit}`);
        } else {
          console.log(`⚠️ Product not found for SKU: ${sku}`);
        }
      }
    }
    
    await client.query('COMMIT');
    console.log('💾 Database updated successfully');
    
    res.json({ success: true, message: 'Webhook processed successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ==================== BOM (Bill of Materials) ====================
app.get('/api/bom', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bom ORDER BY variant, seq');
    
    // Group by variant
    const bomByVariant = {};
    result.rows.forEach(row => {
      if (!bomByVariant[row.variant]) {
        bomByVariant[row.variant] = [];
      }
      bomByVariant[row.variant].push({
        seq: row.seq,
        componentCode: row.component_code,
        componentName: row.component_name,
        quantity: parseFloat(row.quantity)
      });
    });
    
    res.json(bomByVariant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/bom/:variant', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM bom WHERE variant = $1 ORDER BY seq',
      [req.params.variant]
    );
    
    const components = result.rows.map(row => ({
      seq: row.seq,
      componentCode: row.component_code,
      componentName: row.component_name,
      quantity: parseFloat(row.quantity)
    }));
    
    res.json(components);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/bom/:variant', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { variant } = req.params;
    const { components } = req.body;
    
    // Delete existing BOM for this variant
    await client.query('DELETE FROM bom WHERE variant = $1', [variant]);
    
    // Insert new components
    for (const comp of components) {
      await client.query(
        `INSERT INTO bom (variant, seq, component_code, component_name, quantity) 
         VALUES ($1, $2, $3, $4, $5)`,
        [variant, comp.seq, comp.componentCode, comp.componentName, comp.quantity]
      );
    }
    
    await client.query('COMMIT');
    res.json({ success: true, bom: components });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.post('/api/bom/:variant/component', async (req, res) => {
  try {
    const { variant } = req.params;
    const { componentCode, componentName, quantity } = req.body;
    
    // Check if already exists
    const existing = await pool.query(
      'SELECT id FROM bom WHERE variant = $1 AND component_code = $2',
      [variant, componentCode]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Component already exists in BOM' });
    }
    
    // Get next seq
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
    
    // Return all components for this variant
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
      return res.status(404).json({ error: 'Component not found in BOM' });
    }
    
    // Return all components for this variant
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
    
    // Delete component
    const deleteResult = await client.query(
      'DELETE FROM bom WHERE variant = $1 AND component_code = $2 RETURNING id',
      [variant, componentCode]
    );
    
    if (deleteResult.rows.length === 0) {
      throw new Error('Component not found in BOM');
    }
    
    // Re-sequence remaining components
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
    
    // Return updated components
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

// ==================== EXPORTS ====================
app.get('/api/export/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id');
    res.json(result.rows);
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

// ==================== ATTACHMENTS ====================
app.get('/api/attachments', async (req, res) => {
  try {
    const { oilId, fileType } = req.query;
    
    let query = 'SELECT * FROM attachments';
    const params = [];
    const conditions = [];
    
    if (oilId) {
      conditions.push(`associated_oil_id = $${params.length + 1}`);
      params.push(oilId);
    }
    
    if (fileType) {
      conditions.push(`file_type LIKE $${params.length + 1}`);
      params.push(`%${fileType}%`);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
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
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/attachments/:id', async (req, res) => {
  try {
    const attachmentId = parseInt(req.params.id);
    
    const result = await pool.query(
      'DELETE FROM attachments WHERE id = $1 RETURNING stored_file_name',
      [attachmentId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    
    // Delete file from disk
    const filePath = join(__dirname, '../uploads', result.rows[0].stored_file_name);
    if (existsSync(filePath)) {
      await fs.unlink(filePath);
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== FRONTEND SERVING ====================
const distPath = join(__dirname, '../dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(join(distPath, 'index.html'));
    }
  });
  console.log('📦 Serving frontend from dist/');
}

// Ensure uploads directory exists
const uploadsDir = join(__dirname, '../uploads');
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🗄️  Database: ${process.env.DATABASE_URL ? 'PostgreSQL connected' : 'No database configured'}`);
});
