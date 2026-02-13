import pkg from 'pg';
import { Pool } from 'pg';
import fs from 'fs/promises';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import 'dotenv/config';
console.log('DATABASE_URL carregada:', process.env.DATABASE_URL || 'NÃO ENCONTRADA!');

// Configuração do PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrateData() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Iniciando migração dos dados...\n');
    
    // Ler o database.json
    const dbPath = join(__dirname, 'database.json');
    const jsonData = await fs.readFile(dbPath, 'utf8');
    const data = JSON.parse(jsonData);
    
    await client.query('BEGIN');
    
    // ==================== MIGRAR USUÁRIOS ====================
    console.log('👤 Migrando usuários...');
    let userCount = 0;
    
    for (const user of data.users || []) {
      try {
        await client.query(
          'INSERT INTO users (id, name, password, role, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
          [user.id, user.name, user.password, user.role, user.createdAt || new Date().toISOString()]
        );
        userCount++;
      } catch (err) {
        console.error(`  ❌ Erro ao migrar usuário ${user.name}:`, err.message);
      }
    }
    
    console.log(`  ✅ ${userCount} usuários migrados\n`);
    
    // ==================== MIGRAR PRODUTOS ====================
    console.log('📦 Migrando produtos...');
    let productCount = 0;
    
    for (const product of data.products || []) {
      try {
        await client.query(
          `INSERT INTO products 
           (id, tag, product_code, name, category, unit, current_stock, min_stock_level, 
            shopify_skus, supplier, supplier_code, unit_per_box, stock_boxes, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (id) DO UPDATE SET
           current_stock = EXCLUDED.current_stock,
           stock_boxes = EXCLUDED.stock_boxes,
           updated_at = EXCLUDED.updated_at`,
          [
            product.id,
            product.tag,
            product.productCode || product.product_code,
            product.name,
            product.category,
            product.unit || 'units',
            product.currentStock || product.current_stock || 0,
            product.minStockLevel || product.min_stock_level || 0,
            JSON.stringify(product.shopifySkus || product.shopify_skus || {}),
            product.supplier || '',
            product.supplierCode || product.supplier_code || '',
            product.unitPerBox || product.unit_per_box || 1,
            product.stockBoxes || product.stock_boxes || 0,
            product.createdAt || product.created_at || new Date().toISOString(),
            product.updatedAt || product.updated_at || new Date().toISOString()
          ]
        );
        productCount++;
      } catch (err) {
        console.error(`  ❌ Erro ao migrar produto ${product.name}:`, err.message);
      }
    }
    
    console.log(`  ✅ ${productCount} produtos migrados\n`);
    
    // ==================== MIGRAR TRANSAÇÕES ====================
    console.log('📊 Migrando transações...');
    let transactionCount = 0;
    
    for (const trans of data.transactions || []) {
      try {
        await client.query(
          `INSERT INTO transactions 
           (product_id, product_name, category, type, quantity, unit, balance_after, notes, shopify_order_id, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            trans.productId || trans.product_id,
            trans.productName || trans.product_name,
            trans.category,
            trans.type,
            trans.quantity,
            trans.unit,
            trans.balanceAfter || trans.balance_after,
            trans.notes || '',
            trans.shopifyOrderId || trans.shopify_order_id || null,
            trans.createdAt || trans.created_at || new Date().toISOString()
          ]
        );
        transactionCount++;
      } catch (err) {
        console.error(`  ❌ Erro ao migrar transação:`, err.message);
      }
    }
    
    console.log(`  ✅ ${transactionCount} transações migradas\n`);
    
    // ==================== MIGRAR BOM ====================
    console.log('🔧 Migrando BOM (Bill of Materials)...');
    let bomCount = 0;
    
    const bom = data.bom || {};
    for (const [variant, components] of Object.entries(bom)) {
      for (const comp of components) {
        try {
          await client.query(
            `INSERT INTO bom (variant, seq, component_code, component_name, quantity) 
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (variant, component_code) DO UPDATE SET
             seq = EXCLUDED.seq,
             component_name = EXCLUDED.component_name,
             quantity = EXCLUDED.quantity`,
            [
              variant,
              comp.seq,
              comp.componentCode || comp.component_code,
              comp.componentName || comp.component_name,
              comp.quantity
            ]
          );
          bomCount++;
        } catch (err) {
          console.error(`  ❌ Erro ao migrar BOM ${variant}:`, err.message);
        }
      }
    }
    
    console.log(`  ✅ ${bomCount} componentes BOM migrados\n`);
    
    // ==================== MIGRAR ATTACHMENTS ====================
    console.log('📎 Migrando anexos...');
    let attachmentCount = 0;
    
    for (const att of data.attachments || []) {
      try {
        await client.query(
          `INSERT INTO attachments 
           (file_name, stored_file_name, file_type, file_size, file_path, file_url,
            associated_oil_id, associated_oil_name, uploaded_by, notes, upload_date) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            att.fileName || att.file_name,
            att.storedFileName || att.stored_file_name,
            att.fileType || att.file_type,
            att.fileSize || att.file_size,
            att.filePath || att.file_path,
            att.fileUrl || att.file_url || null,
            att.associatedOilId || att.associated_oil_id || 'GENERAL',
            att.associatedOilName || att.associated_oil_name || 'General Documents',
            att.uploadedBy || att.uploaded_by || 'admin',
            att.notes || '',
            att.uploadDate || att.upload_date || new Date().toISOString()
          ]
        );
        attachmentCount++;
      } catch (err) {
        console.error(`  ❌ Erro ao migrar anexo:`, err.message);
      }
    }
    
    console.log(`  ✅ ${attachmentCount} anexos migrados\n`);
    
    await client.query('COMMIT');
    
    console.log('✨ Migração concluída com sucesso!');
    console.log('\n📊 Resumo:');
    console.log(`   Usuários: ${userCount}`);
    console.log(`   Produtos: ${productCount}`);
    console.log(`   Transações: ${transactionCount}`);
    console.log(`   BOM: ${bomCount}`);
    console.log(`   Anexos: ${attachmentCount}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro durante a migração:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Executar migração
migrateData()
  .then(() => {
    console.log('\n✅ Migração finalizada!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migração falhou:', error);
    process.exit(1);
  });
