# Coletor Municipal

Interface de coleta XLSX por instrumento da AUDESP Fase V, com carga na API Embras GCC / PC3S de Pindamonhangaba. Next.js App Router, TypeScript e Bun, com arquitetura MVC modular.

## Desenvolvimento com Docker

Pré-requisito: Docker com Docker Compose. Não precisa instalar Bun no host nem criar `.env`.

```powershell
docker compose up
```

Abra http://localhost:3000. O Compose constrói a imagem no primeiro uso, inicia PostgreSQL, aguarda sua saúde e sobe Next.js em desenvolvimento, com atualização automática dos arquivos de `src/`. As migrações são aplicadas automaticamente no banco de desenvolvimento. O banco fica em volume persistente, sem porta pública. As credenciais locais são exclusivas de desenvolvimento. Para parar, use `docker compose down` (preserva o banco).

Copie `.env.example` para `.env` quando for configurar o Keycloak. Sem essa configuração, a tela de login fica disponível, mas as páginas e APIs internas permanecem bloqueadas. Consulte [login institucional e chaves pessoais](docs/autenticacao-e-chaves.md). Após alterar dependências ou Dockerfile, use `docker compose up --build`.

## Produção com banco separado

Configure `.env` (não versionado):

```dotenv
DATABASE_EXTERNAL=true
DATABASE_URL=postgresql://usuario:senha@servidor:5432/coletor?sslmode=require
APP_URL=https://coletor.exemplo.sp.gov.br
KEYCLOAK_ENABLED=true
KEYCLOAK_ISSUER=https://identidade.exemplo.sp.gov.br/realms/municipio
KEYCLOAK_CLIENT_ID=pinda-coletor
KEYCLOAK_CLIENT_SECRET=
BETTER_AUTH_SECRET=
INTEGRATION_KEYS_ENCRYPTION_KEY=
APP_PORT=3000
```

Use credenciais reais somente no ambiente de destino. Caracteres especiais na senha devem ser codificados para URL. O banco deve existir e ser acessível pela rede do container.

```powershell
docker compose -f compose.production.yml build
docker compose -f compose.production.yml run --rm collector bun run db:migrate
docker compose -f compose.production.yml up -d
```

Esse arquivo é independente: **não combine com `compose.yml`**, pois o padrão contém o banco local. Produção inicia apenas a aplicação, compilada, com usuário não privilegiado. `DATABASE_EXTERNAL=true` é obrigatório. O Compose recusa `DATABASE_URL` ausente/vazia; a aplicação também valida o formato com Zod e executa `SELECT 1` antes de abrir o servidor. Se a configuração ou conexão falhar, o processo encerra com mensagem sem credenciais. O healthcheck verifica aplicação e banco.

O serviço publica somente em localhost; configure proxy HTTPS para acesso externo. Use cliente Keycloak e banco próprios do Coletor, no mesmo realm institucional do DadosPinda. Gere os dois segredos conforme `.env.example`, aplique as migrações e atribua os papéis do cliente aos usuários autorizados seguindo [o guia de configuração](docs/autenticacao-e-chaves.md). Produção não executa migrações automaticamente.

## Executar sem Docker

```powershell
bun install --frozen-lockfile
Copy-Item .env.example .env
# Configure as variáveis no arquivo .env.
bun run db:migrate
bun run dev
```

O login usa Keycloak via Better Auth, sem senha local ou cadastro público. Depois de entrar, cadastre suas chaves em **Minhas chaves**. Cada usuário pode ter várias chaves GCC e de outros sistemas. Os segredos ficam criptografados no banco e nunca são retornados na listagem. Na importação, escolha a chave GCC ativa que será utilizada em todas as etapas.

```powershell
bun run lint
bun run typecheck
bun test
bun run build
```

## Uso por instrumento

1. Entre com sua conta institucional e cadastre ao menos uma chave GCC em Minhas chaves.
2. Escolha termo de fomento, termo de colaboração, convênio, contrato de gestão ou termo de parceria.
3. Baixe o modelo XLSX com várias abas.
4. Preencha Ajuste e as tabelas aplicáveis. Detalhes usam chaves: id do contrato para naturezas; CPF para salários e remunerações.
5. Carregue um único XLSX de até 5 MB, com até 1.000 registros por aba.
6. Corrija as pendências, confira os registros, selecione a chave GCC e confirme cada etapa de envio.

O coletor carrega apenas os blocos suportados pela API Embras; a transmissão e complementação da prestação completa à AUDESP permanecem no GCC. Consulte [a organização das planilhas e a cobertura](docs/planilhas-audesp.md).

A importação CSV foi descontinuada. A rota antiga `/csv` redireciona à importação XLSX. Nenhuma importação real é executada nos testes.

PostgreSQL/Drizzle persistem usuários, sessões, identidades OIDC e chaves pessoais criptografadas. Planilhas e relatórios de importação continuam processados em memória. Não há armazenamento de arquivos pessoais no banco.
