# Login institucional e chaves pessoais

## Padrão compartilhado com o DadosPinda

O Coletor utiliza as mesmas bibliotecas e o mesmo fluxo do Pindamonhangaba.DadosPinda: Better Auth, adapter Drizzle/PostgreSQL e Keycloak com OpenID Connect, Authorization Code, PKCE S256, state, nonce e verificação do ID Token via JWKS. A autenticação aceita apenas identidades do realm configurado com um papel reconhecido no cliente do Coletor. Login por senha local, cadastro público e vinculação automática por e-mail estão desabilitados.

Use o mesmo realm institucional, **um cliente próprio para o Coletor e um banco de dados próprio**. Não reutilize tabelas, segredo de sessão ou chave criptográfica do DadosPinda. O prefixo dos cookies é `pinda-coletor`, para não colidir com outros sistemas no mesmo host. As sessões duram até 8 horas, sem renovação automática. Sair encerra a sessão do Coletor; a sessão SSO do Keycloak continua disponível para os outros sistemas.

## Configurar o Keycloak

1. Crie um cliente OpenID Connect exclusivo, por exemplo `pinda-coletor`, com autenticação do cliente habilitada (confidential), Standard Flow habilitado e PKCE S256. Não habilite Direct Access Grants para o Coletor.
2. Defina a URL pública da aplicação como `APP_URL`, por exemplo `https://coletor.exemplo.sp.gov.br`.
3. Cadastre como Valid Redirect URI a URL exata `https://coletor.exemplo.sp.gov.br/api/auth/callback/keycloak`. Em desenvolvimento, use a URL local/porta configurada. Evite curingas.
4. Preencha `KEYCLOAK_ISSUER` com a URL do realm (`https://identidade.exemplo.sp.gov.br/realms/municipio`), `KEYCLOAK_CLIENT_ID` e `KEYCLOAK_CLIENT_SECRET`.
5. Gere `BETTER_AUTH_SECRET` e `INTEGRATION_KEYS_ENCRYPTION_KEY` separadamente, conforme os comandos no `.env.example`.
6. Habilite `KEYCLOAK_ENABLED=true`, aplique as migrações e atribua os papéis do cliente aos usuários autorizados.

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

## Autorizar usuários pelo Keycloak

No cliente exclusivo do Coletor, crie os papéis `viewer`, `operator` e `admin`. Atribua pelo menos um deles aos usuários ou grupos autorizados e configure o mapper para incluir `resource_access.<KEYCLOAK_CLIENT_ID>.roles` no **ID token**, inclusive na renovação. Papéis do realm ou de outro cliente não autorizam acesso. A precedência é admin, operator, viewer. Nesta versão, os três papéis dão acesso às funções existentes do Coletor; não foram criados módulos administrativos ou permissões de negócio adicionais.

O primeiro login com papel válido cria automaticamente o usuário e a conta local. Nos acessos seguintes, o nome e o papel são sincronizados. A identidade estável é o par issuer/subject; não há vinculação por e-mail. Um e-mail técnico derivado dessa identidade atende ao SDK, dispensando o escopo email e a verificação de e-mail. Usuários existentes preservam seu identificador e suas chaves pessoais.

A autorização é revalidada na primeira requisição autenticada e, depois, a cada 60 segundos por sessão. O SDK renova os tokens e valida o ID token antes de sincronizar o acesso. Retirar os papéis do cliente, bloquear o usuário no Keycloak ou falhar a renovação revoga as sessões locais do usuário. Logout encerra somente a sessão do Coletor. Bloqueios devem ser feitos no Keycloak; o campo local enabled é um espelho e pode ser reativado na sincronização.

O comando `users:keycloak` foi retirado: o provisionamento manual não é mais necessário nem substitui a atribuição de papéis no Keycloak.

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

Testes unitários cobrem configuração, criptografia autenticada e bloqueio sem sessão. Com `TEST_DATABASE_URL` explícita para um banco descartável, testes adicionais verificam isolamento por usuário, substituição/desativação das chaves e login OIDC simulado com PKCE, nonce, state, provisionamento por papéis, renovação, revogação e logout. Nunca aponte TEST_DATABASE_URL para produção. A integração real com o Keycloak institucional depende da configuração do ambiente e deve ser homologada depois de preenchido o `.env`.
