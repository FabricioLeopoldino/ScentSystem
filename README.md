# 🧴 ScentSystem - Sistema de Gestão de Estoque


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


## 📊 Estrutura do Banco

```
users         - Usuários do sistema
products      - Produtos/matérias-primas
transactions  - Histórico de movimentações
bom           - Bill of Materials (receitas)
attachments   - Arquivos anexados
```

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

