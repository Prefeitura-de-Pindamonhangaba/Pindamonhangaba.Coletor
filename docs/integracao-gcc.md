# Integração GCC / PC3S

Contrato consultado em 26/10/2026: https://siapegov.pindamonhangaba.sp.gov.br/gcc-web/api-pc3s-swagger. A página carrega `swagger.yml`, preservado neste diretório. `siape-openapi.json` é gerado com `bun run contract:prepare` e versionado. Revise alterações do contrato antes de atualizar. Não há download dinâmico do Swagger durante a execução.

Base fixa: `https://siapegov.pindamonhangaba.sp.gov.br/gcc-web/api/integracoes`. O backend obtém um token por `POST /login` com `gcc_key`, então envia `codigo_ajuste` e a lista correspondente para `/pc3s/{tipo}`. Não há tentativa automática de reenvio. Timeout de 30 segundos por requisição. Uma falha de transporte pode ocorrer após a gravação remota; confira no GCC antes de repetir.

## Convenção CSV

Cada linha representa um registro da lista. Objetos usam colunas com ponto (`credor.nr_documento`, `credor.nome`). Arrays permanecem como JSON em uma célula. Não há agrupamento automático de linhas por CPF: preencha os históricos na mesma célula/linha do funcionário.

Exemplo de célula `natureza_contratacao`:

```json
[{ "tp_natureza_contratacao": 1 }]
```

Exemplo de célula `salario_contratual`:

```json
[{ "dt_salario": "2025-01-01", "vl_salario": 4500 }]
```

Exemplo de célula `remuneracoes`:

```json
[
  {
    "ano": 2025,
    "mes": 1,
    "carga_horaria": 40,
    "vl_remuneracao": 4500,
    "id_importacao": 1
  }
]
```

Use o editor de planilhas para exportar e escapar aspas corretamente. Datas são ISO, booleanos são `true`/`false` e valores numéricos não usam separador de milhar. Células vazias são omitidas; campos opcionais não são enviados como strings vazias. Colunas desconhecidas são bloqueadas para impedir perda silenciosa de dados.

Validação estrutural no navegador e novamente no servidor, com Ajv baseado no OpenAPI; Zod valida o envelope HTTP, configuração e respostas externas. As condições de vigência, rateio, vínculo de pagamento, conta bancária, valores positivos e IDs duplicados no arquivo também são verificadas localmente. Regras cadastrais, CPF válido, CBO de saúde, códigos das tabelas de referência, descrições condicionais e duplicidades existentes dependem da validação final do GCC. A validação local não garante aceitação remota.

O relatório mostra contagens e erros individuais recebidos da API, além dos identificadores de origem retornados. Sucesso HTTP não significa sucesso de todos os registros. Não reenvie o lote inteiro após sucesso parcial. Contratos e documentos duplicados geram erro individual; pagamentos repetidos podem gerar erro global; funcionários e servidores podem atualizar registros existentes.

## Arquitetura e segurança

`app/` delega ao controller, que valida a entrada e coordena os services. O catálogo representa o contrato. O service CSV interpreta e valida os dados; o service GCC isola autenticação e comunicação externa. PostgreSQL está preparado no ambiente, com verificação de conexão no startup dos containers, mas ainda não há persistência dos dados de importação. Consulte o README para as configurações de desenvolvimento e produção.

O segredo GCC nunca é exposto ao cliente. O código de acesso restringe a rota de envio, há verificação de origem, limite do corpo, destino remoto fixo, bloqueio de redirecionamentos e timeout. Não são gravados logs de tokens, CSVs ou dados pessoais. O relatório baixado contém dados da operação e deve receber o tratamento de acesso e retenção definido pela Prefeitura. Configure HTTPS e restrição de acesso da rede no deploy.

Tokens visuais vieram de https://dsiapp.pindamonhangaba.sp.gov.br/paleta-prefeitura/: verde `#008b3c`, azul `#123d67`, vermelho `#ce1619`, azul claro `#9fced3`, fundo `#f5f7f9` e demais neutros publicados na referência.

## Identidade compartilhada

A interface segue o Pindamonhangaba.DadosPinda: tokens semânticos copiados de src/shared/styles/tokens.css, brasão de public/brand/prefeitura-pindamonhangaba.svg, cabeçalho institucional, marca verde, navegação horizontal azul e padrões de painéis, controles e rodapé. Os arquivos do DadosPinda foram apenas consultados; a adaptação está no Coletor.
