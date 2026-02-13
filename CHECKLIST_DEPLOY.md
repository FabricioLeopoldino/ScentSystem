# ✅ CHECKLIST DE DEPLOY - USE ISTO!

## 📋 ANTES DE COMEÇAR

- [ ] Li o arquivo `LEIA_PRIMEIRO.md`
- [ ] Li o arquivo `DEPLOY_RENDER.md`
- [ ] Tenho acesso ao Render Dashboard
- [ ] Tenho acesso ao GitHub
- [ ] Reservei ~30 minutos para fazer

---

## 🗄️ PASSO 1: PostgreSQL (10 min)

- [ ] Acessei https://dashboard.render.com
- [ ] Cliquei em "New +" → "PostgreSQL"
- [ ] Configurei:
  - Name: scentsystem-db
  - Database: scentsystem
  - Region: Oregon (ou mais próxima)
  - Instance Type: Free
- [ ] Cliquei em "Create Database"
- [ ] Aguardei provisionamento (2-5 min)
- [ ] **COPIEI** a Internal Database URL
- [ ] **SALVEI** a URL em local seguro

---

## 📊 PASSO 2: Criar Tabelas (5 min)

- [ ] Abri PSQL Console no Render PostgreSQL
- [ ] Copiei TODO o conteúdo de `database-schema.sql`
- [ ] Colei no console e executei
- [ ] Verifiquei tabelas criadas: `\dt`
- [ ] Vi: users, products, transactions, bom, attachments

---

## 📤 PASSO 3: GitHub (5 min)

- [ ] Criei novo repositório no GitHub
- [ ] Nome do repo: scentsystem (ou outro)
- [ ] Fiz upload de TODOS os arquivos desta pasta
- [ ] Commit: "Initial commit - PostgreSQL version"

---

## 🌐 PASSO 4: Web Service (5 min)

- [ ] Render Dashboard → "New +" → "Web Service"
- [ ] Conectei meu repositório GitHub
- [ ] Configurei:
  - Name: scentsystem
  - Region: Same as database
  - Branch: main
  - Build Command: `npm run render-build`
  - Start Command: `npm start`
  - Instance Type: Free
- [ ] **NÃO CRIEI AINDA** (próximo passo primeiro!)

---

## 🔧 PASSO 5: Variáveis de Ambiente (3 min)

ANTES de criar o service, adicionei Environment Variables:

- [ ] Key: `DATABASE_URL`
- [ ] Value: [Colei a URL do PostgreSQL]
- [ ] Key: `NODE_ENV`
- [ ] Value: `production`
- [ ] **AGORA SIM** cliquei em "Create Web Service"

---

## ⏳ PASSO 6: Deploy (5 min)

- [ ] Aguardei build completar
- [ ] Verifiquei logs - sem erros
- [ ] Vi mensagem: "✅ Server running on port..."
- [ ] Copiei URL da aplicação

---

## 🔄 PASSO 7: Migrar Dados (OPCIONAL - 2 min)

**SE tenho database.json antigo:**

- [ ] Abri Shell no Web Service
- [ ] Executei: `npm run migrate`
- [ ] Vi: "✨ Migração concluída com sucesso!"

**SE é instalação nova:**
- [ ] Pulei este passo

---

## ✅ PASSO 8: Testar (5 min)

- [ ] Acessei a URL da aplicação
- [ ] Fiz login (admin / admin123)
- [ ] **ALTEREI A SENHA IMEDIATAMENTE**
- [ ] Testei:
  - [ ] Ver produtos
  - [ ] Adicionar produto
  - [ ] Ver transações
  - [ ] Logout/Login

---

## 🛍️ PASSO 9: Shopify Webhook (OPCIONAL)

- [ ] Shopify Admin → Settings → Notifications → Webhooks
- [ ] Criei webhook:
  - Event: Order creation
  - Format: JSON
  - URL: `https://meu-app.onrender.com/api/webhooks/shopify/orders/create`
- [ ] Salvei
- [ ] Testei: "Send test notification"
- [ ] Verifiquei logs do Render

---

## 🎉 DEPLOY COMPLETO!

- [ ] Sistema funciona ✅
- [ ] Login funciona ✅
- [ ] Produtos aparecem ✅
- [ ] Webhook configurado ✅
- [ ] Senha alterada ✅

---

## 📝 ANOTAÇÕES

**URL da Aplicação:**
```
https://_____________________.onrender.com
```

**URL do PostgreSQL:**
```
postgresql://_____________________________________
```

**Data do Deploy:**
```
____ / ____ / 2026
```

---

## 🆘 SE ALGO DEU ERRADO

### Problema: "Database connection error"
- [ ] Verifiquei se DATABASE_URL está configurada
- [ ] Testei conexão no PSQL Console

### Problema: "Tabelas não existem"
- [ ] Executei database-schema.sql novamente
- [ ] Verifiquei com `\dt`

### Problema: "Build failed"
- [ ] Verifiquei logs
- [ ] Confirme que package.json tem "pg": "^8.11.3"

### Problema: "Cannot find module"
- [ ] Trigger novo deploy (rerun)
- [ ] Verifiquei Build Command

---

## 📞 RECURSOS

- Logs: Dashboard → Web Service → Logs
- PSQL: Dashboard → PostgreSQL → PSQL Console
- Docs: DEPLOY_RENDER.md (guia completo)

---

**Versão**: 2.1.0
**Status**: _______________
**Responsável**: _______________

---

Use este checklist e vá marcando conforme completa!
Boa sorte! 🚀
