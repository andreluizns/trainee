# Detecção de Encontros

Detecta encontros físicos entre monitorados a partir de dados de geolocalização, em JavaScript puro (Node.js), sem dependências externas. Processa 12 milhões de linhas (609 MB) em cerca de 1,4 s com o arquivo em cache de disco, usando cerca de 100 MB de memória.

## Como executar

Requer Node.js 18.3 ou superior (executado apenas na versão 24.22.1). Não há `npm install`. Todos os comandos abaixo devem ser executados na **raiz do projeto**, a pasta onde estão `package.json` e `README.md`.

Os JSONs gerados já acompanham a entrega em `output/`. Os datasets não acompanham, por causa do tamanho (1,1 GB no total), e só são necessários para executar o programa novamente.

### 1. Baixar os datasets

Crie a pasta `datasets/` na raiz do projeto e coloque nela os arquivos, sem alterar os nomes. No Linux ou macOS, este comando faz as duas coisas:

```bash
mkdir -p datasets
for f in dataset{1..7}.txt respostas{1,2}.json; do
  curl -f -o "datasets/$f" "https://bucket-projeto-trainee.s3.sa-east-1.amazonaws.com/$f"
done
```

Se preferir, baixe cada arquivo pelos links:

| Arquivo                                                                                      | Tamanho | Uso                   |
| -------------------------------------------------------------------------------------------- | ------: | --------------------- |
| [dataset1.txt](https://bucket-projeto-trainee.s3.sa-east-1.amazonaws.com/dataset1.txt)       |  0,2 MB | Validação             |
| [dataset2.txt](https://bucket-projeto-trainee.s3.sa-east-1.amazonaws.com/dataset2.txt)       |  1,2 MB | Validação             |
| [dataset3.txt](https://bucket-projeto-trainee.s3.sa-east-1.amazonaws.com/dataset3.txt)       |    5 MB | Avaliação             |
| [dataset4.txt](https://bucket-projeto-trainee.s3.sa-east-1.amazonaws.com/dataset4.txt)       |   20 MB | Avaliação             |
| [dataset5.txt](https://bucket-projeto-trainee.s3.sa-east-1.amazonaws.com/dataset5.txt)       |   50 MB | Avaliação             |
| [dataset6.txt](https://bucket-projeto-trainee.s3.sa-east-1.amazonaws.com/dataset6.txt)       |  404 MB | Avaliação             |
| [dataset7.txt](https://bucket-projeto-trainee.s3.sa-east-1.amazonaws.com/dataset7.txt)       |  609 MB | Avaliação             |
| [respostas1.json](https://bucket-projeto-trainee.s3.sa-east-1.amazonaws.com/respostas1.json) |  1,3 KB | Gabarito do dataset 1 |
| [respostas2.json](https://bucket-projeto-trainee.s3.sa-east-1.amazonaws.com/respostas2.json) |    2 KB | Gabarito do dataset 2 |

Os gabaritos só são usados por `npm run verify` e pelos testes.

A estrutura deve ficar assim:

```
(raiz do projeto)
├── package.json
├── src/
├── output/
└── datasets/
    ├── dataset1.txt
    ├── ...
    ├── dataset7.txt
    ├── respostas1.json
    └── respostas2.json
```

### 2. Executar

Para processar os 7 datasets de uma vez:

```bash
npm run all      # lê datasets/dataset1.txt a dataset7.txt e sobrescreve output/respostas1.json a respostas7.json
npm run verify   # compara output/respostas1.json e respostas2.json com os gabaritos
```

Para processar um único dataset:

```bash
node src/cli.js datasets/dataset1.txt -o output/respostas1.json
```

- `datasets/dataset1.txt` é o dataset de entrada.
- `output/respostas1.json` é o arquivo que será gerado. Se ele já existir, será sobrescrito.

Para outro dataset, troque o número nos dois caminhos. A pasta de destino precisa existir. O caminho do dataset pode ser qualquer um, mas `npm run all`, `npm run verify` e `npm run bench` procuram os arquivos em `datasets/`.

A CLI mostra no `stderr` a contagem por tipo, o tempo e o pico de memória.

### 3. Testes e medição

```bash
npm test         # sem datasets/, os testes que dependem deles são ignorados
npm run bench    # mede os tempos dos 7 datasets
```

## Como funciona

```
bytes do arquivo → parser → lote de um timestamp → detecção → classificação → JSON
```

1. **Leitura (`src/parser.js`):** lê blocos de 4 MB e percorre os bytes diretamente, sem criar strings nem objetos por linha. As coordenadas viram inteiros (`-10.07996` vira `-1007996`).
2. **Agrupamento:** como os arquivos são ordenados por timestamp, a memória guarda só o grupo atual. Só são comparados monitorados com o exato mesmo timestamp.
3. **Detecção (`src/detector.js`):** parte da ordem por latitude do timestamp anterior e a ajusta com ordenação por inserção. Depois, compara cada monitorado apenas com os vizinhos seguintes, parando ao atingir 0,00018° de diferença. A ordem anterior só reduz o trabalho: a lista é sempre totalmente ordenada, então o resultado continua correto mesmo que alguém se mova muito entre dois timestamps.
4. **Decisão:** o Haversine, com raio de 6.371.000 m, decide cada par restante com distância estritamente menor que 20 m.
5. **Classificação (`src/domain.js`):** define o tipo do encontro.
6. **Paralelismo (`src/paralelo.js`):** arquivos a partir de 100 MB são divididos em 2 trechos, cada um em uma thread.

### Regras de classificação

```
vítima com seu agressor (em qualquer ordem) → protetiva
mesma facção preenchida                     → faccao
qualquer outro caso                         → generico
```

Cada par gera um único registro por timestamp, e os tipos são mutuamente exclusivos.

**Decisão de interpretação:** o enunciado define genérico como encontro entre "quaisquer dois monitorados", e também chama vítimas de monitoradas. Por isso, um genérico é todo encontro que não seja de facção nem de medida protetiva, inclusive vítima com quem não é seu agressor. Nos 7 datasets, esse caso não ocorre, então a decisão não altera nenhum resultado desta entrega.

### Por que o corte de latitude é seguro

A distância entre dois pontos nunca é menor que a distância medida só em latitude. Como 0,00018° de latitude equivale a 20,015 m, qualquer par com essa diferença ou mais já está a pelo menos 20 m e pode ser descartado sem risco de perder um encontro. O corte só elimina pares: quem decide é sempre o Haversine.

### Por que os inteiros não alteram o resultado

Os inteiros servem só para ler e filtrar. Antes do Haversine e da saída, cada valor é convertido com `inteiro / 100000`. Conferi nas 21,5 milhões de linhas que isso gera exatamente o mesmo `double` que `parseFloat`.

## Por que esta abordagem

A pontuação depende de acertos, e o tempo só desempata. Por isso, a abordagem prioriza uma regra simples e verificável, e otimiza apenas onde as medições mostraram ganho:

- **Os grupos são pequenos:** há no máximo 120 monitorados por timestamp. Por isso, descartei índices espaciais, como grade ou K-D tree, por análise dos dados. Essas estruturas compensam com muitos pontos, e aqui teriam de ser reconstruídas ou atualizadas até 100 mil vezes. Essa alternativa não foi implementada nem medida.
- **A leitura era o gargalo:** com `readline` + `split`, só ler o `dataset7.txt` levava 12 s. Com o parser próprio, leva cerca de 1,75 s.
- **A ordem se aproveita de um timestamp para o outro:** as pessoas se movem pouco em 5 s, então a ordenação por inserção parte de uma lista quase ordenada.

Comparação das três estratégias, em uma thread (mediana de 5 execuções):

| Estratégia                                                | `dataset6.txt` | `dataset7.txt` |
| --------------------------------------------------------- | -------------- | -------------- |
| A: todos os pares com filtro de latitude                  | 2.923 ms       | 4.922 ms       |
| B: ordenar a cada timestamp e varrer                      | 1.729 ms       | 2.614 ms       |
| **C: reaproveitar a ordem anterior e varrer (escolhida)** | **1.361 ms**   | **2.072 ms**   |

As três produzem exatamente a mesma saída. A e B continuam no código para permitir repetir a comparação (`--detector pares|ordenado`).

Medição dos workers com a estratégia C (mediana de 5 execuções):

| Workers | `dataset4.txt` | `dataset5.txt` | `dataset6.txt` | `dataset7.txt` |
| ------- | -------------- | -------------- | -------------- | -------------- |
| 1       | **116 ms**     | **175 ms**     | 1.345 ms       | 1.899 ms       |
| 2       | 233 ms         | 284 ms         | **854 ms**     | **1.377 ms**   |
| 3       | 272 ms         | 323 ms         | 1.006 ms       | 1.403 ms       |
| 4       | 354 ms         | 435 ms         | 1.078 ms       | 1.483 ms       |

Por isso, o programa usa 2 workers a partir de 100 MB, e 1 abaixo disso. Esses valores foram calibrados nesta máquina e podem não ser os melhores em outra; a opção `--workers N` permite alterá-los. Os cortes caem sempre entre dois timestamps, para que os monitorados de um mesmo instante nunca sejam separados.

### Complexidade

Para `n` monitorados por timestamp e `k` pares candidatos que passam pelo filtro de latitude:

| Etapa, por timestamp  | Caso típico                | Pior caso |
| --------------------- | -------------------------- | --------- |
| Ajustar a ordem       | `O(n + d)`, com `d` trocas | `O(n²)`   |
| Varredura e Haversine | `O(n + k)`                 | `O(n²)`   |

Com `n` no máximo 120, o pior caso continua pequeno. Como a teoria sozinha não decidia entre as opções, os custos reais foram medidos.

### Trade-offs aceitos

| Decisão                          | O que ganha                                               | O que custa                                                                            |
| -------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Parser próprio sobre bytes       | Leitura cerca de 7 vezes mais rápida                      | Mais código e nenhuma validação de formato                                             |
| Um timestamp por vez             | Memória estável                                           | Exige arquivo ordenado por timestamp                                                   |
| Reaproveitar a ordem anterior    | A opção mais rápida das três                              | Guarda estado entre timestamps                                                         |
| Lista por latitude               | Pouco código e segurança fácil de provar                  | Perde eficiência com muitos monitorados na mesma faixa de latitude                     |
| 2 workers em arquivos grandes    | 36% menos tempo no `dataset6.txt` e 27% no `dataset7.txt` | Mais código e cerca de 40 MB a mais de memória, para um ganho que só afeta o desempate |
| JavaScript, sem dependências     | Execução direta, sem compilação nem instalação            | Sem checagem de tipos, compensada em parte pelos testes                                |
| Manter as opções A e B no código | Permite repetir a comparação                              | Código não usado por padrão                                                            |

### Por que considero esta a melhor abordagem para este problema

- **Acerta o que pontua:** a saída é idêntica aos dois gabaritos e à força bruta nos 7 datasets. O corte de latitude só descarta pares que comprovadamente estão a 20 m ou mais.
- **Foi a mais rápida entre as medidas:** a estratégia C levou 2.072 ms no `dataset7.txt` em uma thread, contra 4.922 ms da A e 2.614 ms da B.
- **Ataca o maior custo:** nessa execução, cerca de 1,75 s dos 2,07 s são de leitura, e sobram cerca de 0,3 s para a detecção. Mesmo uma estrutura espacial sem custo nenhum economizaria no máximo esses 0,3 s, e por isso o parser recebeu o maior esforço. É uma estimativa feita com a diferença entre medições separadas.
- **Usa pouca memória:** o pico fica em cerca de 100 MB no maior arquivo, porque só um timestamp é mantido por vez.
- **É simples de executar e verificar:** não tem dependências nem compilação, e a segurança do filtro se prova com uma conta.

Essa conclusão vale para as condições deste desafio: arquivos ordenados, formato conferido e no máximo 120 monitorados por timestamp. Ela se limita às alternativas avaliadas, e a grade espacial não foi medida.

Em um sistema de produção, eu reavaliaria três pontos. As soluções abaixo são propostas de evolução: nem elas nem as tecnologias citadas foram implementadas ou medidas neste projeto. A escolha final dependeria do volume real, da infraestrutura e da equipe.

**Milhares de monitorados por instante**

Hoje há até 120 pessoas por timestamp, o que dá 7.140 pares possíveis. Com 5.000 pessoas, seriam quase 12,5 milhões de pares. O filtro continuaria correto, mas muito mais gente cairia na mesma faixa de latitude. Como pessoas com a mesma latitude podem estar longe em longitude, o programa calcularia muitas distâncias à toa, e a detecção poderia passar a pesar mais que a leitura.

Proposta, em ordem de adoção:

1. **Grade em memória:** dividir o mapa em células de pelo menos 20 m, guardadas em um `Map` do JavaScript, e comparar cada pessoa só com quem está na mesma célula ou nas 8 vizinhas. A largura da célula em longitude precisaria considerar a latitude, e o Haversine continuaria decidindo cada par. Essa etapa não exige banco nem biblioteca, e seria o primeiro passo.
2. **Biblioteca de células:** se o sistema precisasse cobrir regiões muito diferentes ou agregar dados por área, trocar a grade própria pelo H3 (`h3-js`), que já resolve as células e suas vizinhas.
3. **Divisão por região:** se um único processo não bastasse, cada região do mapa teria seu próprio processo de detecção. Quem estivesse perto de uma fronteira seria enviado também à região vizinha, para que um encontro na divisa não se perdesse.

O custo é ter mais código e montar a estrutura a cada timestamp. Por isso, eu mediria antes e adotaria cada etapa só quando a anterior não bastasse.

**Dados em tempo real**

Hoje o arquivo está completo e ordenado: quando aparece um timestamp novo, o anterior está encerrado. Em tempo real, isso deixa de valer, porque uma posição pode chegar atrasada por falha de rede, por exemplo. Encerrar o timestamp cedo demais faria o programa perder encontros.

Proposta:

```
rastreadores → API de entrada → Kafka (posições) → detectores → Kafka (encontros) → alertas e PostgreSQL
```

1. **Fila:** usaria o Apache Kafka, com um tópico de posições. Ele absorve picos, permite ter vários detectores em paralelo e guarda as mensagens, o que permite reprocessar um período depois de uma falha. A chave de cada mensagem seria a região do mapa, para que pessoas próximas cheguem ao mesmo detector. Em uma infraestrutura na AWS, o Amazon MSK reduziria o trabalho de operar o Kafka.
2. **Detectores:** seriam serviços em Node.js, usando o cliente `@confluentinc/kafka-javascript`, que reaproveitariam a lógica de `src/domain.js`. Cada detector guardaria o timestamp por alguns segundos antes de processá-lo, para esperar as posições atrasadas. Se o volume crescesse ou as regras de tempo ficassem complexas, eu avaliaria o Apache Flink, feito para esse tipo de janela.
3. **Posição atrasada:** uma posição que chegasse depois do fechamento ainda seria comparada com as demais daquele timestamp, em vez de ser descartada. Para isso, os detectores manteriam os últimos minutos em memória ou no Redis.
4. **Sem registros duplicados:** os encontros seriam gravados no PostgreSQL com uma restrição de unicidade em par e timestamp, pois uma fila pode entregar a mesma mensagem mais de uma vez.
5. **Alerta de medida protetiva:** não esperaria a janela. O Redis guardaria a última posição de cada vítima e de seu agressor, e cada nova posição seria comparada na hora com a da outra pessoa, gerando um alerta preventivo.

O custo é operar mais componentes. Além disso, esperar mais perde menos encontros, mas atrasa os registros. Eu definiria essa espera a partir dos atrasos reais medidos, e por isso o alerta de medida protetiva teria um caminho separado.

**Fontes de dados não confiáveis**

Hoje o parser confia no formato, porque ele foi conferido nos 7 datasets. Se uma coordenada viesse como `-10.0799`, com 4 casas decimais, ela seria lida como `-1.00799`, a cerca de 1.000 km do lugar certo. O programa não mostraria erro, e um encontro real poderia ser perdido.

Proposta:

1. **Validar na entrada:** a API de entrada validaria cada mensagem com um esquema JSON, usando a biblioteca Ajv: campos obrigatórios, latitude entre -90 e 90, longitude entre -180 e 180 e formato do timestamp.
2. **Validar o que faz sentido:** rejeitar ou marcar posições impossíveis, como um timestamp no futuro ou um deslocamento que exigiria uma velocidade irreal desde a última posição.
3. **Guardar as rejeitadas:** enviar cada mensagem inválida, com o motivo, para um tópico separado no Kafka (`posicoes-invalidas`). Assim, nada se perde, e os dados podem ser analisados e reprocessados depois.
4. **Monitorar:** acompanhar a taxa de rejeição com Prometheus e Grafana, com um alerta para aumentos bruscos. Muitas rejeições de uma só vez costumam indicar uma mudança no formato ou um equipamento com defeito.
5. **Manter o processamento de arquivos:** acrescentar ao parser verificações baratas, como a quantidade de casas decimais e a ordem dos timestamps, e interromper a execução com uma mensagem clara se alguma falhar.

O custo é uma leitura mais lenta e mais infraestrutura, o que vale a pena quando um erro silencioso é mais grave do que alguns segundos a mais.

## Validação

- **Gabaritos:** as saídas dos datasets 1 e 2 são idênticas às respostas fornecidas, incluindo tipos, posições e distâncias.
- **Força bruta:** `tools/brute-force.js` usa `readline`, testa todos os pares sem filtro e serve de referência para os datasets sem gabarito. A saída final é idêntica à dele nos 7 datasets, conferida com `tools/compare.js`.
- **Testes automatizados:** cobrem distâncias logo abaixo e acima de 20 m, linhas cortadas entre blocos, arquivo sem quebra de linha final, cortes paralelos entre timestamps e comparação aleatória com a força bruta.

**Limite da validação:** a força bruta confere a otimização, mas usa as mesmas regras de negócio. Nos datasets 3 a 7, as regras são sustentadas pelos gabaritos 1 e 2, e não por uma resposta oficial.

## Resultados

Medidos em uma máquina Linux com 4 threads e 7,7 GB de RAM, com Node 24.22.1 (mediana de 7 execuções):

| Dataset |     Linhas | Tamanho | Encontros | generico | faccao | protetiva |    Tempo |
| ------- | ---------: | ------: | --------: | -------: | -----: | --------: | -------: |
| 1       |      5.000 |  0,2 MB |         4 |        2 |      1 |         1 |    10 ms |
| 2       |     25.000 |  1,2 MB |         6 |        3 |      2 |         1 |    22 ms |
| 3       |    100.000 |    5 MB |        10 |        5 |      3 |         2 |    63 ms |
| 4       |    400.020 |   20 MB |        15 |        7 |      5 |         3 |   118 ms |
| 5       |  1.000.000 |   50 MB |        21 |       10 |      7 |         4 |   213 ms |
| 6       |  8.000.000 |  404 MB |        27 |       12 |      9 |         6 |   981 ms |
| 7       | 12.000.000 |  609 MB |        35 |       15 |     12 |         8 | 1.428 ms |

A soma das medianas é de cerca de 2,8 s. O tempo mede o processamento dentro do programa, sem a inicialização do Node, e os arquivos já estavam no cache de disco. Quando não estão, a primeira leitura depende do disco e pode ser bem mais lenta: uma execução do `dataset7.txt` nessa condição provável levou 6,7 s.

## Premissas verificadas

O parser não valida a entrada, para ganhar velocidade. Ele depende destas características, todas conferidas nos 7 datasets:

| Premissa                                                               | Se não valer                                                                    |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Timestamps em ordem crescente                                          | Um mesmo instante é dividido em grupos, e encontros são perdidos sem aviso      |
| Coordenadas com exatamente 5 casas decimais                            | As coordenadas são lidas com a escala errada, sem aviso                         |
| Restrições de cada vítima constantes no arquivo                        | Só a primeira linha de cada vítima é lida, e mudanças posteriores são ignoradas |
| Linhas bem formadas, terminadas em `\n` (a última pode não ter quebra) | Uma linha malformada pode gerar dados errados, sem aviso                        |

## Limitações conhecidas

- **Encontros em memória no modo paralelo:** cada worker guarda seus encontros até o fim. Isso é irrelevante com até 35 encontros, mas pesaria com milhões.
- **Blocos de leitura:** o tamanho de 4 MB não foi calibrado por medição.
- **Versões do Node:** o projeto só foi executado na versão 24.22.1. O mínimo de 18.3 vem do `parseArgs`, usado na CLI, e não foi testado.
- **Medições:** os tempos vêm de uma única máquina e mudam em outro ambiente.

## Uso de IA

Desenvolvi o projeto em conjunto com o Claude Code, em um processo de etapas e revisões. A ferramenta analisou os dados e propôs o plano, que discutimos antes de eu autorizar o início. Defini a regra de encontro genérico, e a ferramenta conduziu as otimizações e escreveu o código e os testes. Depois, revisei a entrega, avaliei o README com olhar crítico e pedi correções e melhorias até aprová-lo.

A confiança no resultado vem das verificações descritas em [Validação](#validação): comparação com os gabaritos, força bruta sem otimizações e medição das alternativas. Esse processo também corrigiu o plano: a grade espacial, uma das propostas iniciais, foi abandonada depois que os dados mostraram no máximo 120 monitorados por timestamp.

## Estrutura

```
src/cli.js        linha de comando e escolha de workers
src/pipeline.js   liga leitura, detecção, classificação e escrita
src/parser.js     leitura por bytes e agrupamento por timestamp
src/detector.js   estratégias de detecção
src/domain.js     Haversine, classificação e constantes
src/writer.js     escrita do JSON em stream
src/paralelo.js   divisão em trechos e worker_threads
tools/            força bruta, comparação, execução e medição
test/             testes automatizados (node:test)
output/           JSONs gerados
```
