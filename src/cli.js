#!/usr/bin/env node
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { processarParalelo } from './paralelo.js';
import { processar } from './pipeline.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    output: { type: 'string', short: 'o' },
    detector: { type: 'string', default: 'incremental' },
    workers: { type: 'string' },
  },
});

// Medido nos datasets: abaixo disso, iniciar threads custa mais do que economiza,
// e mais de 2 workers não reduziu o tempo.
const TAMANHO_MINIMO_PARALELO = 100 * 1024 * 1024;
const WORKERS_PADRAO = 2;

if (positionals.length !== 1 || !values.output) {
  console.error(
    'Uso: node src/cli.js <dataset.txt> -o <saida.json> [--detector pares|ordenado|incremental] [--workers N]',
  );
  process.exit(2);
}

const inicio = performance.now();
const workers = values.workers
  ? Number(values.workers)
  : fs.statSync(positionals[0]).size >= TAMANHO_MINIMO_PARALELO
    ? WORKERS_PADRAO
    : 1;
const contagem =
  workers > 1
    ? await processarParalelo(positionals[0], values.output, { workers, detector: values.detector })
    : processar(positionals[0], values.output, { detector: values.detector });
const tempoMs = performance.now() - inicio;

console.error(
  JSON.stringify({
    ...contagem,
    total: contagem.generico + contagem.faccao + contagem.protetiva,
    tempoMs: Math.round(tempoMs),
    picoMemoriaMB: Math.round(process.resourceUsage().maxRSS / 1024),
  }),
);
