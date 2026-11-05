// Roda cada dataset várias vezes, em processos novos, e mostra a mediana do tempo.
// Uso: node tools/bench.js [repeticoes] [detector] [datasets separados por vírgula]
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const repeticoes = Number(process.argv[2] ?? 5);
const detector = process.argv[3] ?? 'incremental';
const datasets = (process.argv[4] ?? '1,2,3,4,5,6,7').split(',');
const saida = path.join(os.tmpdir(), `bench-${process.pid}.json`);

let somaMedianas = 0;
for (const n of datasets) {
  const tempos = [];
  let memoria = 0;
  for (let r = 0; r < repeticoes; r++) {
    const { status, stderr } = spawnSync(
      process.execPath,
      ['src/cli.js', `datasets/dataset${n}.txt`, '-o', saida, '--detector', detector],
      { encoding: 'utf8' },
    );
    if (status !== 0) throw new Error(stderr);
    const resultado = JSON.parse(stderr);
    tempos.push(resultado.tempoMs);
    memoria = Math.max(memoria, resultado.picoMemoriaMB);
  }
  tempos.sort((a, b) => a - b);
  const mediana = tempos[Math.floor(tempos.length / 2)];
  somaMedianas += mediana;
  console.log(`dataset${n} ${detector}: mediana=${mediana}ms min=${tempos[0]}ms max=${tempos.at(-1)}ms memoria=${memoria}MB`);
}
console.log(`soma das medianas (${detector}): ${somaMedianas}ms`);
