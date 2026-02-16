-- ========================================================================
-- SCENT SYSTEM - SCHEMA COMPLETO E CORRIGIDO
-- Version: 5.0 - PostgreSQL com todas as tabelas necessárias
-- ========================================================================
-- Execute este script no Neon SQL Editor para criar o banco de dados completo
-- ========================================================================

-- 1. TABELA DE USUÁRIOS
-- ========================================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABELA DE CATEGORIAS
-- ========================================================================
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABELA DE FORNECEDORES
-- ========================================================================
CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABELA DE ARMAZÉNS
-- ========================================================================
CREATE TABLE IF NOT EXISTS warehouses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    location VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. TABELA DE PRODUTOS (PRINCIPAL)
-- ========================================================================
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(50) PRIMARY KEY,
    tag VARCHAR(50) UNIQUE NOT NULL,
    product_code VARCHAR(50) UNIQUE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    unit VARCHAR(20) DEFAULT 'units',
    current_stock DECIMAL(10, 2) DEFAULT 0,
    min_stock_level DECIMAL(10, 2) DEFAULT 0,
    supplier VARCHAR(255),
    supplier_code VARCHAR(100),
    unit_per_box INTEGER DEFAULT 1,
    stock_boxes INTEGER DEFAULT 0,
    shopify_skus JSONB DEFAULT '{}',
    incoming_orders JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABELA DE TRANSAÇÕES DE ESTOQUE
-- ========================================================================
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(50) REFERENCES products(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    category VARCHAR(50),
    type VARCHAR(20) CHECK (type IN ('add', 'remove', 'adjustment')),
    quantity DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(20),
    balance_after DECIMAL(10, 2),
    notes TEXT,
    shopify_order_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. TABELA BOM (BILL OF MATERIALS)
-- ========================================================================
CREATE TABLE IF NOT EXISTS bom (
    id SERIAL PRIMARY KEY,
    variant VARCHAR(100) NOT NULL,
    seq INTEGER NOT NULL,
    component_code VARCHAR(50) NOT NULL,
    component_name VARCHAR(255),
    quantity DECIMAL(10, 4) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(variant, component_code)
);

-- 8. TABELA DE ANEXOS/ARQUIVOS
-- ========================================================================
CREATE TABLE IF NOT EXISTS attachments (
    id SERIAL PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    stored_file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    file_size BIGINT,
    file_path VARCHAR(500),
    file_url TEXT,
    associated_oil_id VARCHAR(50),
    associated_oil_name VARCHAR(255),
    uploaded_by VARCHAR(100),
    notes TEXT,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. TABELA DE ESTOQUE POR ARMAZÉM (FUTURA)
-- ========================================================================
CREATE TABLE IF NOT EXISTS product_stock (
    product_id VARCHAR(50) REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE CASCADE,
    current_stock DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (product_id, warehouse_id)
);

-- 10. TABELA DE PEDIDOS DE ENTRADA (FUTURA)
-- ========================================================================
CREATE TABLE IF NOT EXISTS incoming_orders (
    id BIGSERIAL PRIMARY KEY,
    product_id VARCHAR(50) REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE CASCADE,
    order_number VARCHAR(100),
    shopify_order_id VARCHAR(100),
    quantity DECIMAL(10, 2) NOT NULL,
    expected_date TIMESTAMP,
    received_date TIMESTAMP,
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. TABELA DE PRODUTOS SHOPIFY (FUTURA)
-- ========================================================================
CREATE TABLE IF NOT EXISTS shopify_products (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(50) REFERENCES products(id) ON DELETE CASCADE,
    shopify_product_id VARCHAR(100),
    shopify_variant_id VARCHAR(100) UNIQUE,
    sku VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. TABELA DE ROLES (FUTURA)
-- ========================================================================
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================================
-- ÍNDICES PARA PERFORMANCE
-- ========================================================================

-- Índices em products
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_tag ON products(tag);
CREATE INDEX IF NOT EXISTS idx_products_shopify_skus ON products USING gin(shopify_skus);
CREATE INDEX IF NOT EXISTS idx_products_incoming ON products USING gin(incoming_orders);

-- Índices em transactions
CREATE INDEX IF NOT EXISTS idx_transactions_product_id ON transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

-- Índices em bom
CREATE INDEX IF NOT EXISTS idx_bom_variant ON bom(variant);
CREATE INDEX IF NOT EXISTS idx_bom_component ON bom(component_code);

-- Índices em attachments
CREATE INDEX IF NOT EXISTS idx_attachments_oil_id ON attachments(associated_oil_id);

-- Índices em product_stock
CREATE INDEX IF NOT EXISTS idx_product_stock_product ON product_stock(product_id);
CREATE INDEX IF NOT EXISTS idx_product_stock_warehouse ON product_stock(warehouse_id);

-- Índices em incoming_orders
CREATE INDEX IF NOT EXISTS idx_incoming_orders_product ON incoming_orders(product_id);
CREATE INDEX IF NOT EXISTS idx_incoming_orders_warehouse ON incoming_orders(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_incoming_orders_status ON incoming_orders(status);

-- Índices em shopify_products
CREATE INDEX IF NOT EXISTS idx_shopify_products_product ON shopify_products(product_id);
CREATE INDEX IF NOT EXISTS idx_shopify_products_sku ON shopify_products(sku);

-- ========================================================================
-- TRIGGERS E FUNÇÕES
-- ========================================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para products
CREATE TRIGGER update_products_updated_at 
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para product_stock
CREATE TRIGGER update_product_stock_updated_at 
BEFORE UPDATE ON product_stock
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================================================
-- DADOS INICIAIS
-- ========================================================================

-- Inserir usuário admin padrão
-- Senha: admin123 (hash bcrypt)
INSERT INTO users (name, password, role) 
VALUES ('admin', '$2a$10$pDDpEJA6zwQNy4.6nVaijeho7BLQ3IeeLaeLMkzetP67BvPnmKXyi', 'admin')
ON CONFLICT (name) DO NOTHING;

-- Senha do admin: admin123
-- ⚠️ IMPORTANTE: Altere esta senha após o primeiro login!

-- Categorias padrão
INSERT INTO categories (name) VALUES 
    ('OILS'),
    ('BOTTLES'),
    ('CAPS'),
    ('LABELS'),
    ('BOXES'),
    ('OTHER')
ON CONFLICT (name) DO NOTHING;

-- Armazém padrão
INSERT INTO warehouses (name, location) VALUES 
    ('Main Warehouse', 'Melbourne, VIC, Australia')
ON CONFLICT (name) DO NOTHING;

-- Roles padrão
INSERT INTO roles (name) VALUES 
    ('admin'),
    ('user')
ON CONFLICT (name) DO NOTHING;

-- ========================================================================
-- COMENTÁRIOS NAS TABELAS
-- ========================================================================

COMMENT ON TABLE users IS 'Usuários do sistema com autenticação';
COMMENT ON TABLE products IS 'Produtos/matérias-primas (oils, bottles, caps, etc)';
COMMENT ON TABLE transactions IS 'Histórico completo de movimentações de estoque';
COMMENT ON TABLE bom IS 'Bill of Materials - receitas/composições de produtos';
COMMENT ON TABLE attachments IS 'Arquivos anexados (PDFs, documentos, imagens)';
COMMENT ON TABLE categories IS 'Categorias de produtos';
COMMENT ON TABLE suppliers IS 'Fornecedores de produtos';
COMMENT ON TABLE warehouses IS 'Armazéns/locais de estoque';
COMMENT ON TABLE product_stock IS 'Estoque por produto e armazém (multi-warehouse)';
COMMENT ON TABLE incoming_orders IS 'Pedidos de entrada de estoque';
COMMENT ON TABLE shopify_products IS 'Mapeamento de produtos com Shopify';
COMMENT ON TABLE roles IS 'Roles/permissões de usuários';

-- ========================================================================
-- VERIFICAÇÃO FINAL
-- ========================================================================

DO $$
DECLARE
    tables_count INTEGER;
    indexes_count INTEGER;
BEGIN
    -- Contar tabelas
    SELECT COUNT(*) INTO tables_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE';
    
    -- Contar índices
    SELECT COUNT(*) INTO indexes_count
    FROM pg_indexes
    WHERE schemaname = 'public';
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '           SCENT SYSTEM - SCHEMA CRIADO            ';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE 'Tabelas criadas: %', tables_count;
    RAISE NOTICE 'Índices criados: %', indexes_count;
    RAISE NOTICE '';
    
    IF tables_count >= 12 THEN
        RAISE NOTICE '✅ SCHEMA CRIADO COM SUCESSO!';
        RAISE NOTICE '';
        RAISE NOTICE 'Próximos passos:';
        RAISE NOTICE '1. Gerar hash bcrypt para senha admin';
        RAISE NOTICE '2. Atualizar a senha do admin no INSERT acima';
        RAISE NOTICE '3. Fazer deploy do servidor Node.js';
        RAISE NOTICE '4. Testar login com admin/admin123';
        RAISE NOTICE '';
    ELSE
        RAISE WARNING '⚠️ Algumas tabelas podem não ter sido criadas';
    END IF;
    
    RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;

-- ========================================================================
-- FIM DO SCRIPT
-- ========================================================================
