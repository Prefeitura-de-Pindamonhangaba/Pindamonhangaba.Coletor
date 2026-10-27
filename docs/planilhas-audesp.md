# Coleta por instrumento para a Embras / GCC

O coletor organiza **um conjunto de arquivos por tipo de instrumento, código de ajuste e exercício**. O ajuste precisa existir na Embras. A transmissão da prestação completa à AUDESP continua a cargo do GCC; esta implementação não chama os endpoints do TCE.

## Formato de importação

Somente XLSX: um único arquivo com várias abas, por instrumento, ajuste e exercício. Há modelos para termo de fomento, termo de colaboração, convênio, contrato de gestão e termo de parceria. CSV não é aceito.

Orientacoes e Dicionario são abas auxiliares e não são enviadas. As abas de dados usam cabeçalho na primeira linha. Limite: 5 MB por arquivo e 1.000 registros por tabela. Abas ou colunas desconhecidas bloqueiam a carga. Abas sem movimento podem ficar apenas com os cabeçalhos. A antiga página `/csv` redireciona à tela principal, e o endpoint `/api/imports` retorna HTTP 410.

## Organização das tabelas

| Tabela               | Conteúdo e relacionamento                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Ajuste               | Exatamente uma linha: versão do modelo, tipo de instrumento, código do repasse e exercício. Preserve código como texto. |
| Contratos            | Uma linha por contrato, com credor e `id_importacao` único no arquivo.                                                  |
| Naturezas_Contrato   | Uma linha por natureza; `id_contrato` aponta para `Contratos.id_importacao`.                                            |
| Documentos_Fiscais   | Uma linha por documento, com credor e vínculo opcional ao contrato pelos campos documentados pela Embras.               |
| Pagamentos           | Uma linha por pagamento, com identificação do documento fiscal e conta bancária conforme o caso.                        |
| Funcionarios         | Um cadastro por CPF.                                                                                                    |
| Salarios             | Histórico salarial; CPF aponta para Funcionarios. Datas históricas podem preceder o exercício.                          |
| Remuneracoes_Func    | Uma linha por CPF e competência; CPF aponta para Funcionarios. Ano deve coincidir com Ajuste.                           |
| Servidores_Cedidos   | Um cadastro por CPF; somente para os instrumentos cujos schemas incluem esse bloco.                                     |
| Remuneracoes_Cedidos | Uma linha por CPF e competência; CPF aponta para Servidores_Cedidos. Ano deve coincidir com Ajuste.                     |

Fomento e colaboração têm 8 abas de dados, mais 2 auxiliares. Convênio, contrato de gestão e termo de parceria acrescentam as 2 abas de servidores cedidos, totalizando 12 abas. Essa diferença decorre dos schemas AUDESP 1.16, não de uma distinção nos cinco endpoints de carga da Embras.

Cada célula contém um valor simples. Objetos pequenos mantêm colunas como `credor.nome` para corresponder ao contrato Embras; listas de naturezas, salários e remunerações são reconstruídas pelas chaves. Não é necessário escrever JSON nas células dos novos modelos.

Datas: AAAA-MM-DD ou células de data Excel. CPF/CNPJ e códigos: texto para preservar zeros. Booleanos: `true` ou `false`. Valores: sem separadores de milhar. Células com fórmulas, hiperlinks e tipos compostos são rejeitadas; cole os valores. Campos vazios são omitidos. Vínculos filhos precisam existir na tabela principal do mesmo conjunto; já os contratos e documentos referenciados por documentos/pagamentos podem existir previamente no GCC.

## Validação e envio

O preview recebe os arquivos pelo backend, processa em memória e não transmite dados à Embras. Não há persistência desses arquivos no banco. O servidor limita o corpo HTTP e o tamanho expandido do XLSX, recusa macros e vínculos externos e verifica o contrato dos registros antes de autorizar o envio.

O envio exige o código de acesso ao coletor, a chave GCC no servidor e confirmação do operador. Cada etapa é revalidada a partir dos arquivos originais. Ordem: contratos, documentos fiscais, funcionários, servidores cedidos quando aplicáveis, pagamentos. Etapas vazias são omitidas.

Cada etapa chama apenas o endpoint Embras já documentado. Após o retorno, o operador confirma a próxima etapa. Em erro de comunicação, erro HTTP ou sucesso parcial, o fluxo é interrompido para revisão. Não há repetição automática nem transação global entre endpoints. O relatório inclui os resultados de cada etapa concluída; em sucesso parcial, prepare somente os registros pendentes. O controle de etapas desta versão é mantido em memória no navegador; recarregar a página perde esse controle. Confira sempre os registros no GCC antes de um novo envio.

O tipo de instrumento e o exercício organizam e validam a coleta local. A API de carga Embras recebe apenas `codigo_ajuste` e a lista de registros, sem parâmetros de instrumento/exercício. A classificação real depende do ajuste previamente cadastrado no GCC e deve ser conferida pelo operador. Essa carga não cria o termo nem altera sua classificação remota.

## Cobertura dos contratos

O Swagger AUDESP remete aos JSON Schemas oficiais para definir o conteúdo completo da prestação. Foram consultados os cinco schemas 1.16 disponibilizados em 03/09/2026. O índice extraído, com fontes por instrumento e blocos obrigatórios, está em `audesp-instruments.json`; o Swagger consultado está em `audesp-openapi.yaml`.

A abstração Embras disponível expõe somente contratos, documentos fiscais, pagamentos, funcionários e servidores cedidos. Há cobertura parcial de `relacao_empregados`, além dos quatro blocos homônimos. Outros blocos da AUDESP — bens, disponibilidades, receitas, ajustes de saldo, descontos, devoluções, glosas, empenhos, repasses, relatórios, declarações, dados institucionais, pareceres, transparência e demais seções específicas de cada instrumento — não têm endpoint de carga documentado nessa API. Eles não são coletados silenciosamente nem marcados como transmitidos. Permanecem sob preenchimento e validação no GCC até que exista contrato de integração apropriado.

Uma importação concluída na Embras não significa prestação completa ou aceita pela AUDESP. Não foi criado endpoint de transmissão direta, nem geração de documento AUDESP completo. Declaração negativa exige outro fluxo e não é tratada como planilha vazia.

Fontes consultadas em 27/10/2026:

- https://audesp.tce.sp.gov.br/api/
- https://www.tce.sp.gov.br/audesp/documentacao/audesp-repasses-ao-terceiro-setor-jsonschemas
- https://siapegov.pindamonhangaba.sp.gov.br/gcc-web/api-pc3s-swagger

As bibliotecas ExcelJS e unzipper fazem leitura e verificação do XLSX no servidor; JSZip normaliza o namespace OpenXML quando necessário para compatibilidade com ExcelJS. Papa Parse é utilizado apenas internamente na normalização e validação dos registros; não há opção de upload CSV. Os modelos foram produzidos com a ferramenta de planilhas e são arquivos estáticos em `public/templates/`.
