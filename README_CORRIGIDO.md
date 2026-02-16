# 🧴 ScentSystem v5.0 - Sistema de Gestão de Estoque (CORRIGIDO)

Sistema completo de gerenciamento de estoque integrado com Shopify, com suporte a PostgreSQL e **todas as correções aplicadas**.

---

## ✅ O Que Foi Corrigido Nesta Versão

Esta é a versão **totalmente funcional** do ScentSystem. Os principais problemas foram resolvidos:

1.  **Nomenclatura Corrigida:** Todas as queries SQL e mapeamentos de dados agora usam `snake_case` corretamente (ex: `product_code`, `current_stock`).
2.  **Schema Completo:** O arquivo `database-schema-COMPLETO.sql` inclui todas as 12 tabelas necessárias para o funcionamento completo do sistema.
3.  **Hash de Senha Válido:** O usuário admin já vem com um hash bcrypt válido pré-configurado.
4.  **Documentação Atualizada:** Guia de deploy completo e passo a passo detalhado.

---

## 📦 Funcionalidades

*   **Gestão de Produtos:** Óleos, frascos, tampas e componentes.
*   **Controle de Estoque:** Rastreamento em tempo real com histórico completo.
*   **Integração Shopify:** Webhook automático de pedidos (pronto para configurar).
*   **Multi-usuário:** Sistema de autenticação e permissões (admin/user).
*   **BOM (Bill of Materials):** Receitas de produtos.
*   **Anexos:** Upload de documentos e imagens.
*   **SKU Mapping:** Vinculação com produtos Shopify.
*   **Relatórios Excel:** Exportação de dados.

---

## 🗄️ Stack Tecnológico

### Backend
*   **Node.js + Express:** API REST.
*   **PostgreSQL:** Banco de dados persistente (Neon ou Render).
*   **Bcrypt:** Segurança de senhas.
*   **Multer:** Upload de arquivos.

### Frontend
*   **React 18:** Interface moderna.
*   **Vite:** Build ultra-rápido.
*   **Wouter:** Roteamento leve.
*   **Lucide React:** Ícones.

### Infraestrutura
*   **Render:** Hospedagem (Free tier).
*   **Neon:** PostgreSQL gratuito.
*   **GitHub:** Controle de versão.

---

## 🚀 Deploy Rápido

**Siga o guia completo:** `DEPLOY_COMPLETO.md`

**Resumo:**

1.  Criar banco de dados no Neon.
2.  Executar `database-schema-COMPLETO.sql` no SQL Editor do Neon.
3.  Fazer upload do projeto para o GitHub.
4.  Criar Web Service no Render conectado ao GitHub.
5.  Configurar variáveis de ambiente (`DATABASE_URL` e `NODE_ENV`).
6.  Aguardar o deploy e acessar a aplicação.

**Tempo estimado:** 25-35 minutos.

---

## 🔑 Acesso Padrão

Após executar o schema SQL:

*   **Usuário:** `admin`
*   **Senha:** `admin123`

**⚠️ IMPORTANTE:** Altere a senha após o primeiro login!

---

## 📁 Estrutura de Arquivos

```
ScentSystem-CORRIGIDO/
├── server/
│   └── index.js                    # API Express + PostgreSQL (CORRIGIDO)
├── src/
│   ├── App.jsx                     # App principal
│   ├── main.jsx                    # Entry point
│   └── pages/                      # Componentes de página
│       ├── Login.jsx
│       ├── Dashboard.jsx
│       ├── ProductManagement.jsx
│       ├── StockManagement.jsx
│       ├── SkuMapping.jsx
│       ├── BOMViewer.jsx
│       ├── TransactionHistory.jsx
│       ├── Attachments.jsx
│       └── UserManagement.jsx
├── public/                         # Assets
├── database-schema-COMPLETO.sql    # Schema PostgreSQL COMPLETO
├── DEPLOY_COMPLETO.md              # ⭐ Guia de deploy passo a passo
├── README_CORRIGIDO.md             # Este arquivo
├── .env.example                    # Template de variáveis de ambiente
├── .gitignore                      # Arquivos ignorados pelo Git
├── package.json
└── vite.config.js
```

---

## 🔒 Segurança

*   Senhas com bcrypt (10 rounds).
*   SQL injection protection (prepared statements).
*   CORS configurado.
*   Validação de tipos de arquivo.
*   Environment variables para credenciais.

---

## 📊 Estrutura do Banco de Dados

O schema completo inclui 12 tabelas:

| Tabela | Descrição |
|:---|:---|
| `users` | Usuários do sistema |
| `products` | Produtos/matérias-primas |
| `transactions` | Histórico de movimentações |
| `bom` | Bill of Materials (receitas) |
| `attachments` | Arquivos anexados |
| `categories` | Categorias de produtos |
| `suppliers` | Fornecedores |
| `warehouses` | Armazéns |
| `product_stock` | Estoque por produto e armazém |
| `incoming_orders` | Pedidos de entrada |
| `shopify_products` | Mapeamento com Shopify |
| `roles` | Roles de usuários |

---

## 🐛 Troubleshooting

Consulte o arquivo `DEPLOY_COMPLETO.md` para soluções de problemas comuns.

---

## 📄 Licença

Uso privado.

---

**Versão:** 5.0 (Corrigida)

**Status:** ✅ Pronto para Deploy

**Última atualização:** Fevereiro 2026
