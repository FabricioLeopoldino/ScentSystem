# 🧴 ScentSystem - Sistema de Gestão de Estoque

Sistema completo de gerenciamento de estoque integrado com Shopify, com suporte a PostgreSQL para dados persistentes.

## ✨ Funcionalidades

- 📦 **Gestão de Produtos** - Óleos, frascos, tampas e componentes
- 📊 **Controle de Estoque** - Rastreamento em tempo real
- 🔄 **Integração Shopify** - Webhook automático de pedidos
- 👥 **Multi-usuário** - Sistema de autenticação e permissões
- 🏗️ **BOM (Bill of Materials)** - Receitas de produtos
- 📎 **Anexos** - Upload de documentos e imagens
- 📈 **Histórico Completo** - Todas as movimentações
- 📋 **SKU Mapping** - Vinculação com produtos Shopify
- 📊 **Relatórios Excel** - Exportação de dados

## 🗄️ Stack Tecnológico

### Backend
- **Node.js + Express** - API REST
- **PostgreSQL** - Banco de dados persistente
- **Bcrypt** - Segurança de senhas
- **Multer** - Upload de arquivos

### Frontend
- **React 18** - Interface moderna
- **Vite** - Build ultra-rápido
- **Wouter** - Roteamento leve
- **Lucide React** - Ícones

### Infraestrutura
- **Render** - Hospedagem (Free tier)
- **PostgreSQL (Render)** - Database gratuito
- **GitHub** - Controle de versão

## 🚀 Deploy Rápido

### Pré-requisitos
- Conta no [Render](https://render.com) (gratuita)
- Repositório GitHub
- Conta Shopify (para webhooks)

### Passos Rápidos

1. **Criar PostgreSQL no Render**
   - New + → PostgreSQL
   - Copiar Internal Database URL

2. **Executar Schema**
   - PSQL Console → Colar `database-schema.sql`

3. **Upload para GitHub**
   - Criar repo → Upload deste projeto

4. **Criar Web Service**
   - New + → Web Service
   - Conectar GitHub repo
   - Build: `npm run render-build`
   - Start: `npm start`

5. **Configurar Environment**
   ```
   DATABASE_URL=postgresql://...
   NODE_ENV=production
   ```

6. **Deploy!**
   - Aguardar build
   - Acessar URL fornecida

**📖 Guia Completo**: Ver `DEPLOY_RENDER.md`

## 🔑 Acesso Padrão

Após executar o schema SQL:

- **Usuário**: admin
- **Senha**: admin123

⚠️ **Altere a senha após primeiro login!**

## 💻 Desenvolvimento Local

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/scentsystem.git
cd scentsystem

# Instale dependências
npm install

# Configure ambiente
cp .env.example .env
# Edite .env com suas credenciais

# Instale PostgreSQL local
# Ubuntu: sudo apt install postgresql
# macOS: brew install postgresql

# Crie banco e execute schema
createdb scentsystem
psql scentsystem < database-schema.sql

# Inicie desenvolvimento
npm run dev
```

Acesse: http://localhost:5173

## 📡 Webhook Shopify

### Configuração

1. Shopify Admin → Settings → Notifications → Webhooks
2. Create webhook:
   - **Event**: Order creation
   - **Format**: JSON
   - **URL**: `https://seu-app.onrender.com/api/webhooks/shopify/orders/create`
   - **Version**: Latest

3. Testar: "Send test notification"

### Como Funciona

```
Cliente compra no Shopify
    ↓
Shopify envia webhook
    ↓
Sistema recebe order data
    ↓
Identifica produtos pelos SKUs
    ↓
Deduz quantidades do estoque
    ↓
Cria registro de transação
    ↓
Atualiza current_stock
```

## 📊 Estrutura do Banco

```
users         - Usuários do sistema
products      - Produtos/matérias-primas
transactions  - Histórico de movimentações
bom           - Bill of Materials (receitas)
attachments   - Arquivos anexados
```

## 🔒 Segurança

- ✅ Senhas com bcrypt (10 rounds)
- ✅ SQL injection protection (prepared statements)
- ✅ CORS configurado
- ✅ Validação de tipos de arquivo
- ✅ Environment variables para credenciais

## 📁 Estrutura de Pastas

```
SA_ScentSystem-POSTGRES/
├── server/
│   └── index.js              # API Express + PostgreSQL
├── src/
│   ├── App.jsx               # App principal
│   ├── main.jsx              # Entry point
│   └── pages/                # Componentes de página
│       ├── Login.jsx
│       ├── Dashboard.jsx
│       ├── ProductManagement.jsx
│       ├── StockManagement.jsx
│       ├── SkuMapping.jsx
│       ├── BOMViewer.jsx
│       ├── TransactionHistory.jsx
│       ├── Attachments.jsx
│       └── UserManagement.jsx
├── public/                   # Assets
├── database-schema.sql       # Schema PostgreSQL
├── migrate-to-postgres.js    # Script de migração
├── DEPLOY_RENDER.md          # Guia de deploy
├── package.json
└── vite.config.js
```

## 🔄 Migração de Dados

Se você tem um `database.json` antigo:

```bash
# No Shell do Render (após deploy)
npm run migrate
```

Isso vai transferir todos os dados para PostgreSQL.

## 📈 Performance

- ✅ Connection pooling (PostgreSQL)
- ✅ Índices em colunas críticas
- ✅ Transações ACID
- ✅ Queries otimizadas

## 🔄 Backup

### Backup Manual

```bash
# Backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

### Backup Automático

- Render Pro: Backup automático diário
- Free tier: Export manual quando necessário

## 🐛 Troubleshooting

### Conexão com banco falha
```bash
# Verificar DATABASE_URL
echo $DATABASE_URL

# Testar conexão
psql $DATABASE_URL
```

### Webhook não funciona
```bash
# Teste manual
curl -X POST https://seu-app.onrender.com/api/webhooks/shopify/orders/create \
  -H "Content-Type: application/json" \
  -d '{"id": 123, "line_items": []}'
```

### Dados não aparecem
```sql
-- Verificar no PSQL Console
SELECT COUNT(*) FROM products;
SELECT COUNT(*) FROM transactions;
```

## 📚 Scripts Disponíveis

```bash
npm run dev          # Desenvolvimento (frontend + backend)
npm run build        # Build de produção
npm start            # Iniciar servidor
npm run migrate      # Migrar dados do JSON para PostgreSQL
npm run render-build # Build para Render (automático)
```

## 🌟 Melhorias Futuras

- [ ] Cloudinary para uploads persistentes
- [ ] Dashboard com gráficos
- [ ] Relatórios avançados
- [ ] API para integração com outros sistemas
- [ ] Notificações de estoque baixo
- [ ] Multi-warehouse support

## 📄 Licença

Uso privado.

## 👥 Autor

Desenvolvido para gerenciamento profissional de estoque de produtos de perfumaria.

## 🙏 Tecnologias

- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Express](https://expressjs.com/)
- [PostgreSQL](https://www.postgresql.org/)
- [Render](https://render.com/)

---

**Versão**: 2.1.0 (PostgreSQL)

**Status**: ✅ Produção

**Última atualização**: Fevereiro 2026

**Deploy**: Render (Free tier)
