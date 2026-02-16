# 🚀 Guia de Deploy Completo - ScentSystem v5.0

Este guia detalha, passo a passo, como fazer o deploy do sistema **ScentSystem (versão corrigida)** na plataforma **Render**, utilizando um banco de dados **Neon**.

**Tempo estimado:** 25-35 minutos.

---

## 📋 Pré-requisitos

Antes de começar, você precisará de:

1.  **Conta no GitHub:** Para hospedar o código do projeto. [Crie uma conta aqui](https://github.com/)
2.  **Conta no Neon:** Para o banco de dados PostgreSQL. O plano gratuito é suficiente. [Crie uma conta aqui](https://neon.tech/)
3.  **Conta no Render:** Para hospedar a aplicação (servidor e frontend). O plano gratuito é suficiente. [Crie uma conta aqui](https://render.com/)

---

## Parte 1: Configuração do Banco de Dados (Neon)

Nesta etapa, vamos criar o banco de dados PostgreSQL que armazenará todos os dados do seu sistema.

1.  **Acesse o Neon:** Faça login no seu painel do Neon.

2.  **Crie um Novo Projeto:**
    *   Clique em **"New Project"**.
    *   Dê um nome ao projeto, por exemplo, `scentsystem-db`.
    *   Selecione a versão mais recente do PostgreSQL.
    *   Escolha a região mais próxima de você (ex: `US East (Ohio)`).
    *   Clique em **"Create Project"**.

3.  **Obtenha a URL de Conexão:**
    *   Após a criação do projeto, você será redirecionado para o painel do banco de dados.
    *   Na seção **Connection Details**, localize o card **"Connection String"**.
    *   Selecione a opção **"psql"**.
    *   Copie a URL de conexão. Ela se parecerá com isto:
        ```
        postgresql://neondb_owner:xxxxxxxxxxxx@ep-xxxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
        ```
    *   **Guarde esta URL em um local seguro.** Você precisará dela mais tarde.

---

## Parte 2: Executando o Schema SQL

Agora, vamos criar todas as tabelas e estruturas necessárias no banco de dados que acabamos de criar.

1.  **Abra o Editor SQL do Neon:**
    *   No painel do seu projeto no Neon, clique na aba **"SQL Editor"** no menu lateral.

2.  **Copie o Conteúdo do Schema:**
    *   Abra o arquivo `database-schema-COMPLETO.sql` que está neste projeto.
    *   Selecione e copie **TODO** o conteúdo do arquivo (Ctrl+A, Ctrl+C).

3.  **Cole e Execute o Script:**
    *   Cole o conteúdo copiado no Editor SQL do Neon.
    *   Clique no botão **"Run"**.

4.  **Verifique a Execução:**
    *   Aguarde a execução terminar. Você deverá ver uma mensagem de sucesso no final do painel de resultados, algo como:
        ```
        NOTICE: ✅ SCHEMA CRIADO COM SUCESSO!
        ```
    *   Isso confirma que todas as tabelas, índices e dados iniciais (como o usuário 'admin') foram criados corretamente.

---

## Parte 3: Preparando o Projeto no GitHub

Vamos enviar o código corrigido do sistema para um repositório no GitHub, de onde o Render fará o deploy.

1.  **Crie um Novo Repositório no GitHub:**
    *   Acesse o GitHub e clique em **"New"** para criar um novo repositório.
    *   Dê um nome ao repositório, por exemplo, `scentsystem-app`.
    *   Marque-o como **"Private"** (Recomendado, para proteger seu código).
    *   Clique em **"Create repository"**.

2.  **Faça o Upload dos Arquivos do Projeto:**
    *   No seu novo repositório, clique em **"Add file"** e depois em **"Upload files"**.
    *   Arraste **TODOS os arquivos e pastas** da pasta `ScentSystem-CORRIGIDO` para a área de upload do GitHub.
    *   Aguarde o upload de todos os arquivos.
    *   Escreva uma mensagem de commit, como `Versão inicial do sistema corrigido`.
    *   Clique em **"Commit changes"**.

---

## Parte 4: Deploy da Aplicação (Render)

Finalmente, vamos conectar tudo e colocar o sistema no ar usando o Render.

1.  **Acesse o Render:** Faça login no seu painel do Render.

2.  **Crie um Novo Web Service:**
    *   Clique em **"New +"** e selecione **"Web Service"**.

3.  **Conecte seu Repositório GitHub:**
    *   Se for sua primeira vez, você precisará conectar sua conta do GitHub ao Render.
    *   Na lista de repositórios, encontre e clique em **"Connect"** ao lado do repositório `scentsystem-app` que você criou.

4.  **Configure o Serviço Web:**
    *   **Name:** Dê um nome único para sua aplicação (ex: `scentsystem`). Este será parte da sua URL.
    *   **Region:** Escolha a mesma região que você usou para o banco de dados Neon para melhor performance.
    *   **Branch:** `main` (ou o nome da sua branch principal).
    *   **Root Directory:** Deixe em branco.
    *   **Runtime:** `Node`.
    *   **Build Command:** `npm install && npm run build`
    *   **Start Command:** `npm start`
    *   **Instance Type:** `Free`.

5.  **Adicione as Variáveis de Ambiente:**
    *   Clique em **"Advanced"** para expandir a seção de variáveis de ambiente.
    *   Clique em **"Add Environment Variable"**.
    *   **Key:** `DATABASE_URL`
    *   **Value:** Cole a **URL de conexão do Neon** que você guardou na Parte 1.
    *   Clique em **"Add Environment Variable"** novamente.
    *   **Key:** `NODE_ENV`
    *   **Value:** `production`

6.  **Inicie o Deploy:**
    *   Role para baixo e clique em **"Create Web Service"**.

7.  **Acompanhe o Processo:**
    *   O Render agora irá buscar seu código do GitHub, instalar as dependências, buildar o projeto e iniciar o servidor.
    *   Você pode acompanhar o progresso na aba **"Events"** e os logs na aba **"Logs"**.
    *   O primeiro deploy pode levar de 5 a 10 minutos.

---

## Parte 5: Acesso e Teste Final

1.  **Aguarde o Status "Live":** Quando o deploy estiver completo, você verá um status **"Live"** no topo da página do seu serviço no Render.

2.  **Acesse sua Aplicação:**
    *   A URL da sua aplicação estará no topo da página (ex: `https://scentsystem.onrender.com`).
    *   Clique nela para abrir o sistema.

3.  **Faça o Login:**
    *   Você será direcionado para a tela de login.
    *   Use as credenciais padrão:
        *   **Usuário:** `admin`
        *   **Senha:** `admin123`

4.  **Parabéns!** 🎉 Seu sistema está funcionando e online!

---

## 🚨 Troubleshooting (Solução de Problemas)

*   **Erro no Deploy (Build Failed):**
    *   Verifique os logs na aba **"Logs"** do Render. O erro mais comum é uma variável de ambiente incorreta.
    *   Certifique-se de que `DATABASE_URL` e `NODE_ENV` foram adicionadas corretamente.

*   **Aplicação não conecta ao banco (Application Error):**
    *   Verifique se a `DATABASE_URL` está **exatamente** como você a copiou do Neon.
    *   Verifique se o banco de dados no Neon está ativo e não pausado.

*   **Login inválido:**
    *   Certifique-se de que você executou o script `database-schema-COMPLETO.sql` **sem erros** na Parte 2.
    *   Se o problema persistir, verifique os logs do servidor no Render para ver a mensagem de erro específica ao tentar fazer login.
