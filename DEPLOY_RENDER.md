# 🚀 DEPLOY NO RENDER - GUIA RÁPIDO

## ✨ SEU SISTEMA JÁ ESTÁ PRONTO!

Este projeto foi **PRÉ-CONFIGURADO** para usar PostgreSQL no Render.
Você só precisa seguir os passos abaixo.

---

## 📋 CHECKLIST RÁPIDO (30 minutos)

### ☑️ PASSO 1: Criar PostgreSQL no Render (10 min)

1. **Acesse**: https://dashboard.render.com
2. Clique em **"New +"** → **"PostgreSQL"**
3. Configure:
   ```
   Name: scentsystem-db
   Database: scentsystem
   User: (gerado automaticamente)
   Region: Oregon (US West) - ou mais próxima de você
   Instance Type: Free
   ```
4. Clique em **"Create Database"**
5. **AGUARDE** 2-5 minutos (provisionamento)
6. **COPIE** a **"Internal Database URL"**
   - Exemplo: `postgresql://user:pass@host.oregon-postgres.render.com/scentsystem`
   - **GUARDE BEM ESSA URL!**

---

### ☑️ PASSO 2: Criar Tabelas no PostgreSQL (5 min)

1. No dashboard do PostgreSQL, clique em **"Connect"** → **"PSQL Command"**
2. Copie o comando que aparece
3. Abra um terminal e execute o comando
4. Quando conectar, copie e cole TODO o conteúdo do arquivo `database-schema.sql`
5. Pressione Enter
6. Verifique se as tabelas foram criadas:
   ```sql
   \dt
   ```
   Deve mostrar: `users, products, transactions, bom, attachments`

**Alternativa (se não tiver psql):**
- Use o **PSQL Web Console** no dashboard do Render
- Cole o conteúdo do `database-schema.sql` lá

---

### ☑️ PASSO 3: Fazer Upload para GitHub (5 min)

1. **Crie um novo repositório** no GitHub (pode ser privado)

2. **Faça upload deste projeto**:

   **Opção A - Via GitHub Web:**
   - Arraste todos os arquivos desta pasta para o repo
   - Commit: "Initial commit - PostgreSQL version"

   **Opção B - Via Git:**
   ```bash
   cd /caminho/para/SA_ScentSystem-POSTGRES
   git init
   git add .
   git commit -m "Initial commit - PostgreSQL version"
   git remote add origin https://github.com/SEU-USUARIO/SEU-REPO.git
   git push -u origin main
   ```

---

### ☑️ PASSO 4: Criar Web Service no Render (5 min)

1. Dashboard Render → **"New +"** → **"Web Service"**
2. Conecte seu repositório GitHub
3. Configure:
   ```
   Name: scentsystem (ou outro nome)
   Region: Same as database (Oregon)
   Branch: main
   Build Command: npm run render-build
   Start Command: npm start
   Instance Type: Free
   ```
4. **NÃO CLIQUE EM CREATE AINDA!**

---

### ☑️ PASSO 5: Configurar Variáveis de Ambiente (3 min)

**ANTES DE CRIAR O SERVICE**, adicione as variáveis:

1. Role até **"Environment Variables"**
2. Adicione:

   ```
   Key: DATABASE_URL
   Value: [Cole aqui a Internal Database URL do PostgreSQL]
   
   Key: NODE_ENV
   Value: production
   ```

3. **AGORA SIM**, clique em **"Create Web Service"**

---

### ☑️ PASSO 6: Aguardar Deploy (5 min)

1. O Render vai:
   - Instalar dependências (npm install)
   - Build do frontend (vite build)
   - Iniciar servidor (npm start)

2. Acompanhe os **Logs**
3. Quando ver: `✅ Server running on port...` → **SUCESSO!**

---

### ☑️ PASSO 7: Migrar Dados (2 min)

**SE você tem dados no database.json antigo:**

1. No dashboard do Web Service, clique em **"Shell"**
2. Execute:
   ```bash
   npm run migrate
   ```
3. Aguarde mensagem: `✨ Migração concluída com sucesso!`

**SE é instalação nova:**
- Pule este passo
- Um usuário admin padrão já foi criado pelo schema SQL

---

### ☑️ PASSO 8: Testar! (5 min)

1. **Acesse sua aplicação** (URL fornecida pelo Render)
   - Exemplo: `https://scentsystem.onrender.com`

2. **Faça login**:
   - Usuário: `admin`
   - Senha: `admin123`
   - **⚠️ ALTERE A SENHA IMEDIATAMENTE!**

3. **Teste básico**:
   - [ ] Ver produtos (se migrou dados)
   - [ ] Adicionar um produto novo
   - [ ] Ver histórico de transações
   - [ ] Fazer logout e login novamente

4. **Teste de persistência**:
   - Adicione um produto
   - Aguarde 20 minutos (Render fica inativo)
   - Acesse novamente
   - O produto deve estar lá! ✅

---

## 🎯 CONFIGURAR WEBHOOK SHOPIFY

1. **Shopify Admin** → Settings → Notifications → Webhooks
2. Clique em **"Create webhook"**
3. Configure:
   ```
   Event: Order creation
   Format: JSON
   URL: https://SEU-APP.onrender.com/api/webhooks/shopify/orders/create
   API version: Latest (2024-10)
   ```
4. Clique em **"Save"**
5. **Teste**: Clique em "Send test notification"
6. Verifique nos **Logs do Render** se apareceu:
   ```
   📦 Shopify webhook received
   ```

---

## ✅ PRONTO!

Seu sistema agora:
- ✅ Usa PostgreSQL (dados persistentes)
- ✅ Funciona após reinicializações
- ✅ Recebe webhooks do Shopify
- ✅ Está 100% funcional
- ✅ Sem custos (free tier)

---

## 📊 MONITORAMENTO

### Ver Logs em Tempo Real
Dashboard → Seu Web Service → **Logs**

### Consultar Banco de Dados
Dashboard → PostgreSQL → **PSQL Console**

Queries úteis:
```sql
-- Ver produtos
SELECT id, name, current_stock FROM products LIMIT 10;

-- Ver transações recentes
SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10;

-- Produtos com estoque baixo
SELECT name, current_stock, min_stock_level 
FROM products 
WHERE current_stock < min_stock_level;
```

---

## 🆘 PROBLEMAS COMUNS

### "Database connection error"
- Verificar se DATABASE_URL está configurada
- Testar conexão no PSQL Console

### "Tabelas não existem"
- Executar database-schema.sql novamente

### "Cannot find module 'pg'"
- Verificar se package.json tem `"pg": "^8.11.3"`
- Trigger novo deploy

### "Webhook não funciona"
- Verificar URL no Shopify
- Ver logs do Render
- Testar manualmente com curl

---

## 📁 ARQUIVOS IMPORTANTES

- `server/index.js` - Servidor com PostgreSQL ✅
- `database-schema.sql` - Schema do banco ✅
- `migrate-to-postgres.js` - Script de migração ✅
- `package.json` - Dependências (já inclui "pg") ✅
- `.env.example` - Exemplo de variáveis

---

## 🔄 PRÓXIMOS PASSOS (OPCIONAL)

### Implementar Cloudinary (uploads persistentes)
- Arquivos em `/uploads` ainda são efêmeros
- Solução: Ver arquivo `CLOUDINARY_SETUP.md` (se fornecido)

### Backups Automáticos
- Render Pro tem backup automático
- Free tier: export manual via pg_dump

### Monitoramento
- Configurar alertas de erros
- Monitorar uso do banco (deve ficar em <1GB)

---

## 💡 DICAS PRO

1. **Teste localmente primeiro** (se possível)
   - Instale PostgreSQL local
   - Configure DATABASE_URL local
   - Execute: `npm run dev`

2. **Mantenha database.json como backup**
   - Útil para disaster recovery

3. **Documente suas customizações**
   - Se modificar código, anote

4. **Monitore o free tier**
   - Render Free: Fica inativo após 15 min
   - PostgreSQL Free: 1GB limite

---

## 📞 SUPORTE

- **Logs**: Sempre seu melhor amigo
- **Render Docs**: https://render.com/docs
- **PostgreSQL Docs**: https://www.postgresql.org/docs/

---

**Versão**: 2.1.0 (PostgreSQL)
**Data**: Fevereiro 2026
**Status**: Pronto para produção ✅

Boa sorte! 🚀
