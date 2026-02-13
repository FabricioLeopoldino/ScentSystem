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

// Middlewares
app.use(cors({
  origin: true, // ou especifique 'https://scentsystem.onrender.com' se preferir mais restrição
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// PostgreSQL Connection Pool - CRIADO NO TOPO
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Teste de conexão inicial com o banco (roda ao iniciar o servidor)
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Falha ao conectar no PostgreSQL (Neon):', err.message);
    console.error('Detalhes do erro:', err.stack);
  } else {
    console.log('✅ Conexão com PostgreSQL (Neon) estabelecida com sucesso!');
    console.log('Hora atual no banco:', res.rows[0].now);
  }
});

// Rota de health check - usada pelo UptimeRobot para manter o serviço acordado
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Serviço ativo e saudável', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ==================== DASHBOARD EXEMPLO ====================
app.get('/api/dashboard', async (req, res) => {
  try {
    console.log('Requisição para /api/dashboard recebida');
    const result = await pool.query('SELECT COUNT(*) FROM products');
    console.log('Query ok:', result.rows);
    res.json({ productsCount: result.rows[0].count });
  } catch (err) {
    console.error('Erro em /api/dashboard:', err.message, err.stack);
    res.status(500).json({ error: 'Erro interno no dashboard', details: err.message });
  }
});

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

// ... (o restante das rotas de products, stock, transactions, webhooks, bom, attachments, exports
// permanece exatamente igual ao seu código original. Não repeti aqui para não ficar muito longo,
// mas mantenha todas elas no arquivo)

// ==================== FRONTEND SERVING (deve ficar no final, após todas as rotas API) ====================
const distPath = join(__dirname, '../dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  console.log('📦 Serving frontend from dist/');
  
  // Catch-all para SPA - serve index.html para qualquer rota não-API
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(join(distPath, 'index.html'));
    }
  });
} else {
  console.warn('⚠️ Pasta dist/ não encontrada. Frontend não será servido.');
}

// Ensure uploads directory exists
const uploadsDir = join(__dirname, '../uploads');
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

// ==================== MIDDLEWARE GLOBAL DE ERRO (último) ====================
app.use((err, req, res, next) => {
  console.error('Erro global capturado:', err.stack);
  res.status(500).json({ error: 'Erro interno no servidor', message: err.message });
});

// Iniciar o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🗄️ Database: ${process.env.DATABASE_URL ? 'PostgreSQL connected' : 'No database configured'}`);
});
