import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function setupDatabase() {
  try {
    console.log('🔧 Verificando banco de dados...');
    
    // Verificar se tabelas já existem
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (!result.rows[0].exists) {
      console.log('📊 Criando tabelas no banco de dados...');
      
      // Ler e executar schema SQL
      const schema = fs.readFileSync('./database-schema.sql', 'utf8');
      await pool.query(schema);
      
      console.log('✅ Banco de dados configurado com sucesso!');
      console.log('✅ Tabelas criadas: users, products, transactions, bom, attachments');
    } else {
      console.log('✅ Banco de dados já está configurado!');
    }
    
    // Verificar quantas tabelas existem
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log(`📋 Tabelas no banco: ${tables.rows.map(r => r.table_name).join(', ')}`);
    
  } catch (error) {
    console.error('❌ Erro ao configurar banco de dados:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupDatabase();
