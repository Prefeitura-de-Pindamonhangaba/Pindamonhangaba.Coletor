# AGENTS.md — Padrão de Desenvolvimento de Software

## 1. Objetivo

Este documento estabelece os padrões técnicos, arquiteturais, visuais e de qualidade para o desenvolvimento de aplicações web.

Seu objetivo é orientar agentes de inteligência artificial e desenvolvedores, garantindo consistência, segurança, simplicidade e facilidade de manutenção.

Este documento é genérico e reutilizável.

As regras de negócio, funcionalidades, integrações, modelos de dados e requisitos específicos deverão ser definidos separadamente, conforme cada projeto.

### Princípios fundamentais

- Simplicidade e legibilidade.
- Monólito MVC modular.
- Separação clara de responsabilidades.
- Segurança desde o início.
- Desenvolvimento incremental.
- Baixo acoplamento.
- Reutilização de componentes.
- Facilidade de manutenção.
- Preferência por tecnologias abertas.
- Evitar complexidade desnecessária.
- Não antecipar funcionalidades futuras.

**Diretriz principal:** implementar a solução mais simples que atenda aos requisitos atuais, preservando a capacidade de evolução.

---

## 2. Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js — App Router |
| Linguagem | TypeScript strict |
| Runtime | Bun |
| Gerenciador de pacotes | Bun |
| Interface | React |
| Arquitetura | MVC modular |
| Backend | Controllers e Services |
| Banco de dados | PostgreSQL |
| ORM | Drizzle ORM |
| Migrações | Drizzle Kit |
| Validação | Zod |
| Containers | Docker |
| Orquestração | Docker Compose |
| Testes | Bun Test e Playwright |
| Qualidade | ESLint e Prettier |

Utilizar versões estáveis e suportadas.

Não adicionar dependências sem necessidade técnica justificada.

### Regras do Bun

Utilizar Bun para desenvolvimento, gerenciamento de pacotes, build, testes e execução em produção.

Comandos padrão:

```bash
bun install
bun run dev
bun run build
bun run start
bun test
bunx drizzle-kit generate
bunx drizzle-kit migrate
```

Regras:

1. Não utilizar npm, yarn ou pnpm.
2. Versionar `bun.lock`.
3. Utilizar `bun install --frozen-lockfile` nos builds reproduzíveis.
4. Utilizar imagens oficiais `oven/bun` nos containers.
5. Não instalar Node.js no container por padrão.
6. Verificar compatibilidade das dependências com Bun.
7. Validar a aplicação no container final.

---

## 3. Arquitetura MVC modular

A aplicação deverá utilizar uma arquitetura **monolítica MVC modular**, com responsabilidades claramente separadas.

O Next.js será responsável pelo roteamento e renderização, sem concentrar a lógica de negócio.

### Model

Responsável pela representação e persistência dos dados.

Inclui:

- Schemas do Drizzle ORM.
- Entidades e tipos.
- Repositories.
- Consultas e operações de persistência.

### View

Responsável pela apresentação.

Inclui:

- Páginas React.
- Componentes.
- Formulários.
- Tabelas.
- Estados visuais.

Views não devem implementar regras de negócio nem acessar diretamente o banco.

### Controller

Responsável por receber e coordenar requisições.

Inclui:

- Recebimento de parâmetros.
- Validação de entradas.
- Verificação de autenticação e autorização.
- Chamada dos services.
- Tratamento e formatação das respostas.

Controllers não devem implementar regras complexas de negócio nem acessar repositories diretamente.

### Service

Responsável pela lógica de negócio.

Inclui:

- Regras de domínio.
- Coordenação de repositories.
- Integrações externas.
- Transações.
- Processamento de dados.
- Comunicação entre módulos.

Services não devem depender de componentes React ou objetos HTTP do Next.js.

### Fluxo arquitetural

```text
Next.js Route / Server Action
             |
             v
         Controller
             |
             v
          Service
             |
             v
     Model / Repository
             |
             v
         PostgreSQL
```

Para integrações externas, utilizar adapters quando necessário.

### Regras arquiteturais

1. Manter as camadas separadas.
2. Organizar funcionalidades por módulos.
3. Evitar dependências circulares.
4. Não compartilhar regras de negócio por meio de componentes visuais.
5. Utilizar interfaces quando contribuírem para o desacoplamento.
6. Não criar abstrações prematuras.
7. Não introduzir microsserviços sem decisão arquitetural explícita.
8. Manter os arquivos de `app/` mínimos.

---

## 4. Estrutura de diretórios

Estrutura inicial recomendada:

```text
project/
├── AGENTS.md
├── src/
│   ├── app/
│   │   ├── api/
│   │   ├── layout.tsx
│   │   └── globals.css
│   │
│   ├── modules/
│   │   └── ...
│   │
│   └── shared/
│       ├── components/
│       ├── lib/
│       │   ├── db/
│       │   ├── security/
│       │   └── env.ts
│       ├── styles/
│       └── types/
│
├── drizzle/
├── tests/
├── docs/
├── Dockerfile
├── compose.yml
├── drizzle.config.ts
├── next.config.ts
├── .env.example
├── bun.lock
├── tsconfig.json
└── package.json
```

Cada módulo poderá utilizar:

```text
module/
├── controllers/
├── services/
├── models/
├── views/
├── schemas/
└── ...
```

Regras:

- Criar apenas os diretórios necessários.
- Organizar código por domínio funcional.
- Evitar módulos excessivamente grandes.
- Centralizar componentes realmente compartilhados.
- Não criar estruturas vazias apenas para seguir o exemplo.
- Não concentrar toda a lógica da aplicação em `shared/`.

---

## 5. Banco de dados

Utilizar PostgreSQL com Drizzle ORM.

### Convenções

- Tabelas e colunas em `snake_case`.
- Propriedades TypeScript em `camelCase`.
- Identificadores preferencialmente UUID.
- Chaves estrangeiras explícitas.
- Constraints no banco.
- Índices conforme necessidade.
- Datas preferencialmente em `timestamptz`.
- Armazenamento temporal consistente, preferencialmente UTC.

### Migrações

1. Utilizar Drizzle Kit.
2. Versionar todas as migrações.
3. Revisar o SQL gerado.
4. Não utilizar `drizzle-kit push` em produção.
5. Não alterar migrações já aplicadas.
6. Não executar operações destrutivas sem autorização.
7. Realizar backup antes de alterações relevantes.
8. Não executar migrações automaticamente em toda inicialização de produção.

A modelagem deverá seguir os requisitos efetivos de cada projeto.

Não criar tabelas ou relacionamentos antecipadamente.

---

## 6. Autenticação e autorização

Quando a aplicação exigir autenticação, utilizar uma solução consolidada e extensível.

A arquitetura deverá permitir integração com provedores de identidade baseados em padrões abertos, especialmente OpenID Connect.

Poderão ser utilizados, conforme os requisitos do projeto:

- Keycloak.
- Active Directory por meio de provedor apropriado.
- Microsoft Entra ID.
- Outros provedores compatíveis.

Não implementar mecanismos próprios de autenticação sem justificativa técnica.

### Autorização

Quando necessário, utilizar RBAC ou outro modelo apropriado aos requisitos.

Regras:

1. Negar acesso por padrão.
2. Aplicar o princípio do menor privilégio.
3. Verificar autorização no servidor.
4. Não confiar exclusivamente na interface.
5. Utilizar identificadores internos estáveis.
6. Não utilizar e-mails como chaves primárias.
7. Proteger sessões e cookies.
8. Não compartilhar credenciais.
9. Registrar alterações administrativas relevantes.

Não implementar módulos de autenticação ou autorização quando não forem necessários ao projeto.

---

## 7. Segurança e privacidade

Aplicar segurança desde o início do desenvolvimento.

### Requisitos gerais

- HTTPS em produção.
- Validação de entradas com Zod.
- Consultas parametrizadas.
- Proteção contra XSS, CSRF e SSRF.
- Proteção de sessões e cookies.
- Segredos fora do código-fonte.
- Tratamento seguro de erros.
- Controle de acesso.
- Limitação de requisições quando necessária.
- Validação de arquivos enviados, quando aplicável.
- Aplicação dos princípios da LGPD.

### Dados sensíveis

- Não expor credenciais.
- Não registrar tokens em logs.
- Não retornar informações internas em mensagens de erro.
- Não persistir dados desnecessários.
- Restringir o acesso conforme finalidade.
- Definir retenção e descarte conforme necessidade.

### Integrações externas

Quando houver integrações:

1. Isolar a comunicação em services ou adapters.
2. Manter credenciais exclusivamente no backend.
3. Validar entradas e respostas.
4. Utilizar timeouts.
5. Tratar indisponibilidade.
6. Não inventar contratos de APIs.
7. Não expor detalhes internos aos usuários.
8. Documentar os contratos separadamente.

---

## 8. Auditoria e logs

Implementar auditoria conforme a criticidade e os requisitos de cada projeto.

Distinguir:

- Logs técnicos.
- Eventos de segurança.
- Registros de auditoria.
- Eventos de negócio.

Regras:

- Utilizar identificadores de correlação quando necessário.
- Registrar erros relevantes.
- Evitar dados pessoais excessivos.
- Não registrar senhas ou tokens.
- Restringir acesso aos registros.
- Definir políticas de retenção.
- Não ocultar falhas silenciosamente.

Não implementar infraestrutura complexa de auditoria antes de existir necessidade.

---

## 9. Identidade visual institucional

As aplicações deverão seguir a identidade visual oficial da Prefeitura Municipal de Pindamonhangaba.

### Referência obrigatória

https://dsiapp.pindamonhangaba.sp.gov.br/paleta-prefeitura/

A referência disponibilizada nesse endereço deverá orientar a definição das cores e demais elementos institucionais.

### Regras

1. Consultar a referência antes de definir cores.
2. Não inventar valores hexadecimais institucionais.
3. Centralizar cores em design tokens ou variáveis CSS.
4. Evitar cores definidas diretamente nos componentes.
5. Utilizar cores institucionais consistentemente.
6. Garantir contraste e acessibilidade.
7. Não criar paletas alternativas sem autorização.
8. Preservar tokens existentes quando a referência estiver indisponível.

---

## 10. Estilo visual

O estilo visual deverá combinar:

**Swiss Design + Minimalismo + Design System Institucional.**

### Swiss Design

Priorizar:

- Grids consistentes.
- Alinhamentos rigorosos.
- Hierarquia tipográfica clara.
- Espaçamento intencional.
- Organização objetiva.
- Composições equilibradas.

### Minimalismo

Priorizar:

- Interfaces limpas.
- Navegação simples.
- Baixa poluição visual.
- Redução de elementos decorativos.
- Uso moderado de cores.
- Eficiência dos fluxos.

Evitar:

- Sombras excessivas.
- Gradientes decorativos.
- Animações desnecessárias.
- Cards sem função.
- Bordas excessivas.
- Elementos visuais redundantes.

### Design System Institucional

Utilizar:

- Tokens de cores.
- Escala tipográfica consistente.
- Espaçamentos padronizados.
- Componentes reutilizáveis.
- Estados de interação padronizados.
- Ícones consistentes.
- Formulários acessíveis.
- Layouts responsivos.

### Diretriz estética

A interface deverá transmitir uma identidade:

**Institucional, moderna, sóbria, organizada e confiável.**

Priorizar clareza, produtividade e acessibilidade em vez de elementos decorativos.

---

## 11. Componentes e experiência do usuário

Priorizar componentes reutilizáveis quando houver utilização recorrente.

Exemplos:

- Botões.
- Campos de entrada.
- Formulários.
- Tabelas.
- Menus.
- Alertas.
- Modais.
- Indicadores de carregamento.
- Estados vazios.
- Mensagens de erro.

### Usabilidade

- Utilizar linguagem clara.
- Apresentar feedback das ações.
- Manter navegação consistente.
- Evitar etapas desnecessárias.
- Garantir responsividade.
- Priorizar acessibilidade.
- Não sobrecarregar a interface.

### Acessibilidade

Considerar as diretrizes WCAG aplicáveis.

Priorizar:

- Navegação por teclado.
- Compatibilidade com leitores de tela.
- Rótulos claros.
- Contraste adequado.
- Estados de foco visíveis.
- Mensagens compreensíveis.
- Estrutura semântica apropriada.

---

## 12. Configuração por ambiente

Suportar ambientes separados para:

- Desenvolvimento.
- Testes.
- Produção.

Utilizar variáveis de ambiente e manter `.env.example`.

### Regras

1. Nunca versionar credenciais reais.
2. Separar bancos por ambiente.
3. Não utilizar credenciais de produção em desenvolvimento.
4. Validar configurações obrigatórias com Zod.
5. Falhar explicitamente quando configurações essenciais estiverem ausentes.
6. Não expor segredos por variáveis `NEXT_PUBLIC_`.
7. Documentar novas variáveis.

Configurações específicas deverão ser definidas conforme o projeto.

---

## 13. Docker e deploy

Utilizar Docker e Docker Compose.

### Dockerfile

- Utilizar imagem oficial do Bun.
- Fixar versão da imagem.
- Utilizar multi-stage build.
- Instalar dependências com lockfile.
- Executar build no container.
- Reduzir dependências da imagem final.
- Executar com usuário não privilegiado.
- Utilizar Bun como runtime de produção.

### Docker Compose

Configurar apenas os serviços necessários.

Requisitos:

- Persistência de dados quando necessária.
- Health checks.
- Rede interna.
- Configuração por ambiente.
- Política de reinicialização.
- Não expor bancos publicamente por padrão.

### Produção

Garantir:

- HTTPS.
- Proxy reverso quando necessário.
- Backups.
- Logs.
- Deploy reproduzível.
- Procedimento documentado de atualização.
- Recuperação em caso de falhas.

---

## 14. Convenções de código

Utilizar TypeScript strict.

Evitar `any` e preferir tipos explícitos.

### Nomenclatura

| Elemento | Convenção |
|---|---|
| Variáveis | camelCase |
| Funções | camelCase |
| Componentes | PascalCase |
| Tipos e interfaces | PascalCase |
| Constantes globais | UPPER_SNAKE_CASE |
| Arquivos | kebab-case |
| Diretórios | kebab-case |
| Tabelas | snake_case |
| Colunas | snake_case |

### Idioma

- Código e identificadores em inglês.
- Interface em português brasileiro.
- Documentação em português brasileiro.
- Mensagens aos usuários em português brasileiro.

### Boas práticas

- Funções pequenas.
- Responsabilidades claras.
- Baixa duplicação.
- Evitar abstrações prematuras.
- Não criar arquivos excessivamente grandes.
- Preferir legibilidade.
- Comentar decisões relevantes, não comportamentos óbvios.
- Evitar dependências desnecessárias.

---

## 15. Tratamento de erros

Distinguir:

- Erros de validação.
- Erros de autenticação.
- Erros de autorização.
- Erros de negócio.
- Erros de integração.
- Erros inesperados.

Controllers deverão converter erros em respostas apropriadas.

Services deverão utilizar erros de domínio sem depender de códigos HTTP.

Não retornar stack traces ou informações sensíveis ao usuário.

Não ocultar falhas silenciosamente.

Apresentar mensagens claras e compreensíveis.

---

## 16. Testes e qualidade

Utilizar Bun Test para testes unitários e de integração.

Utilizar Playwright para testes de ponta a ponta quando necessário.

### Prioridades

- Services.
- Controllers.
- Validação.
- Autorização.
- Repositories.
- Integrações externas.
- Operações críticas.

### Regras

- Utilizar mocks para serviços externos.
- Isolar ambientes de teste.
- Não executar testes contra produção.
- Cobrir fluxos críticos.
- Evitar testes redundantes.
- Não afirmar que testes passaram sem executá-los.

### Validação

Antes de concluir alterações relevantes:

```bash
bun run lint
bun run typecheck
bun test
bun run build
```

Os scripts deverão existir no `package.json`.

Informar quando alguma verificação não puder ser executada.

---

## 17. Documentação

Manter documentação objetiva em `docs/`.

Documentar conforme necessário:

- Instalação.
- Configuração.
- Desenvolvimento.
- Arquitetura.
- Integrações.
- Permissões.
- Migrações.
- Deploy.
- Recuperação.
- Decisões arquiteturais relevantes.

### Separação de responsabilidades

Este `AGENTS.md` estabelece padrões gerais de desenvolvimento.

Não deverá ser utilizado para registrar:

- Requisitos específicos.
- Funcionalidades particulares.
- APIs e endpoints.
- Modelos de dados específicos.
- Regras de negócio.
- Credenciais.
- Cronogramas.
- Demandas temporárias.

Essas informações deverão permanecer em documentação própria de cada projeto.

### Decisões arquiteturais

Quando necessário, registrar:

- Contexto.
- Decisão.
- Justificativa.
- Consequências.

Evitar documentação extensa sem necessidade.

---

## 18. Desenvolvimento incremental

Todo projeto deverá ser desenvolvido incrementalmente.

### Diretrizes

1. Entender os requisitos antes de implementar.
2. Identificar a solução mais simples.
3. Reutilizar estruturas existentes.
4. Implementar apenas o necessário.
5. Validar cada etapa.
6. Evitar refatorações sem justificativa.
7. Não antecipar funcionalidades.
8. Preservar compatibilidade.
9. Documentar decisões relevantes.

### Evolução arquitetural

Não introduzir antecipadamente:

- Microsserviços.
- Filas externas.
- Sistemas distribuídos.
- Camadas excessivas de abstração.
- Infraestrutura de observabilidade complexa.
- Mecanismos genéricos sem utilização concreta.

Esses recursos poderão ser incorporados quando houver necessidade técnica demonstrada.

---

## 19. Instruções obrigatórias para agentes de IA

Todo agente deverá:

1. Ler este documento antes de modificar o projeto.
2. Inspecionar a estrutura existente.
3. Respeitar a arquitetura MVC modular.
4. Utilizar Bun.
5. Respeitar a stack tecnológica.
6. Não introduzir microsserviços sem autorização.
7. Não adicionar dependências sem justificativa.
8. Não implementar funcionalidades fora do escopo.
9. Manter controllers, services, models e views separados.
10. Não colocar lógica de negócio nas views.
11. Não acessar o banco diretamente nos controllers.
12. Isolar integrações externas.
13. Não inventar contratos de APIs.
14. Validar entradas e respostas externas.
15. Proteger credenciais e dados pessoais.
16. Respeitar a LGPD.
17. Utilizar a paleta oficial da Prefeitura.
18. Seguir Swiss Design + Minimalismo + Design System Institucional.
19. Reutilizar componentes e tokens existentes.
20. Não executar operações destrutivas sem autorização.
21. Preservar compatibilidade.
22. Atualizar documentação relevante.
23. Executar os testes disponíveis.
24. Informar testes não executados.
25. Comunicar decisões técnicas relevantes.
26. Solicitar esclarecimentos para decisões arquiteturais de alto impacto.

### Antes de implementar

- Entender o requisito.
- Inspecionar o código existente.
- Identificar o módulo responsável.
- Verificar os padrões estabelecidos.
- Avaliar impactos de segurança.
- Escolher a solução mais simples.

### Durante a implementação

- Realizar alterações pequenas e coesas.
- Respeitar as camadas.
- Evitar dependências desnecessárias.
- Preservar a identidade visual.
- Manter código legível.
- Não antecipar funcionalidades.

### Após implementar

- Verificar tipagem.
- Executar testes.
- Verificar build.
- Revisar segurança.
- Documentar alterações relevantes.
- Informar limitações e pendências.

---

## 20. Diretriz final

Todo projeto deverá priorizar uma arquitetura:

**Simples, modular, segura, extensível e sustentável.**

O Next.js será responsável pelo roteamento e renderização, enquanto controllers, services, models e views manterão responsabilidades separadas.

A interface deverá seguir a identidade institucional da Prefeitura Municipal de Pindamonhangaba, combinando Swiss Design, Minimalismo e Design System Institucional.

A segurança, a legibilidade e a facilidade de manutenção deverão ser consideradas requisitos fundamentais.

**Construir o necessário agora, preservando a capacidade de evoluir depois.**

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
