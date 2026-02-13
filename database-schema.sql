-- ScentSystem Database Schema for PostgreSQL
-- Este schema replica toda a estrutura do database.json

-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Produtos (substitui "oils")
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Transações de Estoque
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

-- Tabela BOM (Bill of Materials) - Relacionamentos entre produtos
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

-- Tabela de Anexos/Arquivos
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

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_tag ON products(tag);
CREATE INDEX IF NOT EXISTS idx_transactions_product_id ON transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bom_variant ON bom(variant);
CREATE INDEX IF NOT EXISTS idx_attachments_oil_id ON attachments(associated_oil_id);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar updated_at em products
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inserir usuário admin padrão (senha: admin123)
-- Substitua o hash se quiser uma senha diferente
INSERT INTO users (name, password, role) 
VALUES ('admin', '$2a$10$YourHashedPasswordHere', 'admin')
ON CONFLICT (name) DO NOTHING;

-- Comentários nas tabelas
COMMENT ON TABLE users IS 'Usuários do sistema';
COMMENT ON TABLE products IS 'Produtos/matérias-primas (oils, bottles, caps, etc)';
COMMENT ON TABLE transactions IS 'Histórico de movimentações de estoque';
COMMENT ON TABLE bom IS 'Bill of Materials - receitas/composições de produtos';
COMMENT ON TABLE attachments IS 'Arquivos anexados (PDFs, documentos, imagens)';
