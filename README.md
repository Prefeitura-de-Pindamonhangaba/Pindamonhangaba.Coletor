# Coletor Municipal

Interface de importação CSV para a API GCC / PC3S de Pindamonhangaba. Next.js App Router, TypeScript e Bun, com arquitetura MVC modular.

## Executar

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
docker compose up --build -d
```

O Compose publica somente em localhost. Para acesso externo, configure um proxy HTTPS. A primeira versão usa um código compartilhado para restringir o envio; integração com identidade institucional e permissões individuais deve anteceder uma abertura ampla do serviço.

## Uso

1. Selecione um dos cinco tipos de importação e baixe seu modelo.
2. Preencha as colunas, mantendo os identificadores como texto para preservar zeros.
3. Selecione o CSV UTF-8, separado por ponto e vírgula ou vírgula. Limites: 2 MB e 1.000 registros.
4. Corrija as pendências, confira a prévia e informe o ajuste.
5. Confirme o envio ao ambiente de produção e baixe o relatório.

Consulte [o contrato e os formatos](docs/integracao-gcc.md). Nenhuma importação real é executada nos testes.

Não há persistência local de planilhas ou histórico. PostgreSQL e Drizzle serão introduzidos quando houver requisito de persistência, conforme as diretrizes de desenvolvimento incremental.
