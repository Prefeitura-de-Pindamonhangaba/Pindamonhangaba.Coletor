# Login institucional e chaves pessoais

## Padrão compartilhado com o DadosPinda

O Coletor utiliza as mesmas bibliotecas e o mesmo fluxo do Pindamonhangaba.DadosPinda: Better Auth, adapter Drizzle/PostgreSQL e Keycloak com OpenID Connect, Authorization Code, PKCE S256, state, nonce e verificação do ID Token via JWKS. A autenticação aceita apenas o realm configurado e e-mail verificado. Login por senha local, cadastro público e vinculação automática por e-mail estão desabilitados.

Use o mesmo realm institucional, **um cliente próprio para o Coletor e um banco de dados próprio**. Não reutilize tabelas, segredo de sessão ou chave criptográfica do DadosPinda. O prefixo dos cookies é `pinda-coletor`, para não colidir com outros sistemas no mesmo host. As sessões duram até 8 horas, sem renovação automática. Sair encerra a sessão do Coletor; a sessão SSO do Keycloak continua disponível para os outros sistemas.

## Configurar o Keycloak

1. Crie um cliente OpenID Connect exclusivo, por exemplo `pinda-coletor`, com autenticação do cliente habilitada (confidential), Standard Flow habilitado e PKCE S256. Não habilite Direct Access Grants para o Coletor.
2. Defina a URL pública da aplicação como `APP_URL`, por exemplo `https://coletor.exemplo.sp.gov.br`.
3. Cadastre como Valid Redirect URI a URL exata `https://coletor.exemplo.sp.gov.br/api/auth/callback/keycloak`. Em desenvolvimento, use a URL local/porta configurada. Evite curingas.
4. Preencha `KEYCLOAK_ISSUER` com a URL do realm (`https://identidade.exemplo.sp.gov.br/realms/municipio`), `KEYCLOAK_CLIENT_ID` e `KEYCLOAK_CLIENT_SECRET`.
5. Gere `BETTER_AUTH_SECRET` e `INTEGRATION_KEYS_ENCRYPTION_KEY` separadamente, conforme os comandos no `.env.example`.
6. Habilite `KEYCLOAK_ENABLED=true`, aplique as migrações e vincule os usuários autorizados antes do primeiro login.

O login fica desabilitado e as páginas/APIs internas permanecem bloqueadas enquanto `KEYCLOAK_ENABLED=false`. Sem essa configuração, `docker compose up` ainda disponibiliza a tela de apresentação do login. Nenhum modo de acesso anônimo é habilitado automaticamente.

Em produção, APP_URL e issuer exigem HTTPS. A exceção `KEYCLOAK_ALLOW_INSECURE_HTTP=true` só é aceita em desenvolvimento com APP_URL HTTP em loopback, para testar um IdP local. Não desabilite validação de certificados. O navegador e o container precisam alcançar a URL do issuer; em Docker, `localhost` no container não é o host. Prefira um hostname de teste acessível aos dois.

O proxy deve preservar host e protocolo da URL pública e definir `X-Real-IP`, removendo valores enviados pelo cliente. Não exponha o servidor Bun diretamente em produção. O Compose publica a aplicação apenas em loopback.

## Migrações e preparação do banco

Foram adicionadas tabelas de usuários, identidades OIDC, sessões, verificações, limitação de requisições, chaves de integração e eventos de uso/alteração das chaves. As migrações são versionadas em `drizzle/` e não removem tabelas preexistentes.

No desenvolvimento, o startup do Compose aplica as migrações automaticamente no banco local. Em produção, execute explicitamente, com backup e credenciais corretas:

```powershell
docker compose -f compose.production.yml build
docker compose -f compose.production.yml run --rm collector bun run db:migrate
docker compose -f compose.production.yml up -d
```

Quando o login está habilitado, o startup e o healthcheck também verificam a existência das tabelas necessárias. A inicialização de produção não executa migrações automaticamente. Para gerar migrações futuras, use `bun run db:generate`, revise o SQL e depois aplique `bun run db:migrate` no ambiente apropriado.

## Autorizar usuários

O administrador do ambiente deve vincular o **subject (sub/User ID) exato do Keycloak**, não apenas o e-mail. Um usuário não vinculado não é cadastrado implicitamente no primeiro acesso. O vínculo inclui issuer e subject, evitando que identidades de realms diferentes sejam confundidas.

Com o container configurado e iniciado:

```powershell
'{"name":"Nome do usuário","email":"usuario@exemplo.sp.gov.br","subject":"ID-DO-USUARIO-NO-KEYCLOAK","enabled":true}' | docker compose exec -T collector bun run users:keycloak
```

Para produção, inclua `-f compose.production.yml` após `docker compose`. Fora do Docker, envie o mesmo JSON pela entrada padrão para `bun run users:keycloak`, com DATABASE_URL e as variáveis de autenticação configuradas.

O comando cria um novo usuário/vínculo ou atualiza o vínculo existente do mesmo issuer/subject. Para bloquear uma conta, execute novamente com `enabled:false`. Suas sessões locais são revogadas. Um e-mail já pertencente a outra identidade causa erro; ele não é associado automaticamente. Mudanças de subject/realm exigem intervenção administrativa planejada no banco e revogação das sessões, não uma troca silenciosa de identidade.

## Minhas chaves

Cada usuário autenticado pode cadastrar várias chaves, inclusive várias chaves `gcc`. Os campos são sistema, nome identificável e segredo. Para um sistema ainda sem adapter de envio, escolha “Outro sistema” e informe um identificador estável, por exemplo `outro-sistema`.

A listagem retorna somente id, sistema, nome, situação e datas. O segredo nunca é retornado pelo endpoint de consulta, nem mesmo para seu proprietário. É possível renomear, substituir o segredo, desativar e reativar. O sistema de uma chave não é alterado na edição; cadastre uma nova chave se precisar de outro sistema.

Não há compartilhamento entre usuários. Toda consulta/alteração de chave é filtrada pelo id do usuário da sessão no servidor. Proprietário e sistema não podem ser fornecidos para sobrescrita no PATCH. As operações de cadastro, alteração e tentativa de uso ficam registradas em `credential_events`, sem segredo, token ou conteúdo da planilha.

Os segredos são criptografados com AES-256-GCM e nonce aleatório. A autenticação criptográfica vincula o conteúdo ao id da chave, proprietário e sistema. Trocar o ciphertext entre registros impede sua decifragem. A chave mestra fica somente em `INTEGRATION_KEYS_ENCRYPTION_KEY`, no servidor.

**Mantenha backup protegido da chave mestra junto do plano de recuperação.** Trocar ou perder esse valor torna os segredos anteriores inacessíveis. A rotação da chave mestra exige recriptografia planejada; esta versão não faz rotação automática. Alterar BETTER_AUTH_SECRET encerra a validade das sessões/tokens OAuth existentes; trate sua rotação separadamente.

## Seleção da chave para envio

Após conferir o XLSX, o operador escolhe uma de suas chaves GCC ativas. A interface fixa essa seleção após o início das etapas. Cada etapa consulta novamente a sessão e a chave no servidor; uma chave de outro usuário, desativada ou pertencente a outro sistema é recusada.

Somente o id da chave é enviado pelo navegador. O backend obtém e decifra o segredo, autentica no GCC e executa a carga. `GCC_KEY` e `COLLECTOR_ACCESS_TOKEN` deixaram de ser utilizados. O código do ajuste continua precisando corresponder à entidade permitida pela chave na Embras.

Cadastrar credenciais genéricas não cria integrações de envio automaticamente. Nesta etapa, apenas GCC possui adapter e endpoint de destino. Não há cadastro de URLs arbitrárias nem alteração dinâmica do destino da API.

## Verificação

Testes unitários cobrem configuração, criptografia autenticada e bloqueio sem sessão. Com `TEST_DATABASE_URL` explícita para um banco descartável, testes adicionais verificam isolamento por usuário, substituição/desativação das chaves e login OIDC simulado com PKCE, nonce, state, usuário não vinculado e logout. Nunca aponte TEST_DATABASE_URL para produção. A integração real com o Keycloak institucional depende da configuração do ambiente e deve ser homologada depois de preenchido o `.env`.
