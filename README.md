# Coletor Municipal

Interface de coleta XLSX e CSV por instrumento da AUDESP Fase V, com carga na API Embras GCC / PC3S de Pindamonhangaba. Next.js App Router, TypeScript e Bun, com arquitetura MVC modular.

## Desenvolvimento com Docker

Pré-requisito: Docker com Docker Compose. Não precisa instalar Bun no host nem criar `.env`.

```powershell
docker compose up
```

Abra http://localhost:3000. O Compose constrói a imagem no primeiro uso, inicia PostgreSQL, aguarda sua saúde e sobe Next.js em desenvolvimento, com atualização automática dos arquivos de `src/`. O banco fica em volume persistente, sem porta pública. As credenciais locais são exclusivas de desenvolvimento. Para parar, use `docker compose down` (preserva o banco).

Opcionalmente, copie `.env.example` para `.env` para informar `GCC_KEY`, `COLLECTOR_ACCESS_TOKEN` ou `APP_PORT`. Sem chaves, a preparação e a validação CSV funcionam; o envio real continua bloqueado. O Compose de desenvolvimento fixa o banco local e ignora `DATABASE_URL` externa do `.env`, evitando uso acidental do banco de produção. Após alterar dependências, Dockerfile ou configuração, use `docker compose up --build`.

## Produção com banco separado

Configure `.env` (não versionado):

```dotenv
DATABASE_EXTERNAL=true
DATABASE_URL=postgresql://usuario:senha@servidor:5432/coletor?sslmode=require
GCC_KEY=
COLLECTOR_ACCESS_TOKEN=
APP_PORT=3000
```

Use credenciais reais somente no ambiente de destino. Caracteres especiais na senha devem ser codificados para URL. O banco deve existir e ser acessível pela rede do container.

```powershell
docker compose -f compose.production.yml up --build -d
```

Esse arquivo é independente: **não combine com `compose.yml`**, pois o padrão contém o banco local. Produção inicia apenas a aplicação, compilada, com usuário não privilegiado. `DATABASE_EXTERNAL=true` é obrigatório. O Compose recusa `DATABASE_URL` ausente/vazia; a aplicação também valida o formato com Zod e executa `SELECT 1` antes de abrir o servidor. Se a configuração ou conexão falhar, o processo encerra com mensagem sem credenciais. O healthcheck verifica aplicação e banco.

O serviço publica somente em localhost; configure proxy HTTPS para acesso externo. `APP_PORT` permite mudar a porta, inclusive para executar dev e produção simultaneamente com portas diferentes. Credenciais GCC podem ser adicionadas depois, mas continuam obrigatórias para envio real. A primeira versão usa um código compartilhado para restringir o envio; integração com identidade institucional e permissões individuais deve anteceder uma abertura ampla do serviço.

## Executar sem Docker

```powershell
bun install --frozen-lockfile
Copy-Item .env.example .env
# Configure as variáveis no arquivo .env.
bun run dev
```

Abra http://localhost:3000. Sem credenciais é possível preparar, validar e conferir os arquivos. O envio exige `GCC_KEY` no servidor e `COLLECTOR_ACCESS_TOKEN` com pelo menos 32 caracteres. O operador informa apenas o código de acesso ao coletor, mantido em memória no navegador. Nunca forneça a chave GCC ao navegador.

```powershell
bun run lint
bun run typecheck
bun test
bun run build
```

## Uso por instrumento

1. Escolha termo de fomento, termo de colaboração, convênio, contrato de gestão ou termo de parceria.
2. Baixe o modelo XLSX com abas ou os modelos CSV das tabelas.
3. Preencha Ajuste e as tabelas aplicáveis. Detalhes usam chaves: id do contrato para naturezas; CPF para salários e remunerações.
4. Carregue um XLSX ou selecione os CSVs juntos, incluindo Ajuste.csv. Limites: 5 MB somados e 1.000 registros por tabela.
5. Corrija as pendências, confira os registros e confirme cada etapa de envio à Embras na ordem apresentada.

Os formatos geram os mesmos dados. O coletor carrega apenas os blocos suportados pela API Embras; a transmissão e complementação da prestação completa à AUDESP permanecem no GCC. Consulte [a organização das planilhas e a cobertura](docs/planilhas-audesp.md).

## CSV avulso

O fluxo anterior está preservado em `/csv`:

1. Selecione um dos cinco tipos de importação e baixe seu modelo.
2. Preencha as colunas, mantendo os identificadores como texto para preservar zeros.
3. Selecione o CSV UTF-8, separado por ponto e vírgula ou vírgula. Limites: 2 MB e 1.000 registros.
4. Corrija as pendências, confira a prévia e informe o ajuste.
5. Confirme o envio ao ambiente de produção e baixe o relatório.

Consulte [o contrato e os formatos](docs/integracao-gcc.md). Nenhuma importação real é executada nos testes.

PostgreSQL já está preparado e sua conexão é verificada nos containers. Não há tabelas, migrações nem persistência de planilhas ou histórico nesta etapa; Drizzle será introduzido quando houver um modelo de dados a persistir. Nenhuma migração é executada automaticamente no deploy.
