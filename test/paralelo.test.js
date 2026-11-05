import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { dividirEmTrechos, processarParalelo } from '../src/paralelo.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paralelo-'));
const chave = (e) => `${e.monitoradosEncontro.join('-')}|${e.timestamp}`;
const lerOrdenado = (caminho) =>
  JSON.parse(fs.readFileSync(caminho, 'utf8')).sort((a, b) => chave(a).localeCompare(chave(b)));

function arquivoSintetico(comQuebraFinal) {
  const linhas = ['cabecalho'];
  for (let t = 0; t < 200; t++) {
    const ts = `2024-01-01 00:${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    for (let id = 1; id <= 5; id++) {
      linhas.push(`${id};;"${ts}";${(id + t / 1000).toFixed(5)};1.00000;false;`);
    }
  }
  const caminho = path.join(dir, `sintetico${comQuebraFinal}.txt`);
  fs.writeFileSync(caminho, linhas.join('\n') + (comQuebraFinal ? '\n' : ''));
  return caminho;
}

for (const comQuebraFinal of [true, false]) {
  test(`trechos cobrem o arquivo e nunca separam um timestamp (quebra final: ${comQuebraFinal})`, () => {
    const caminho = arquivoSintetico(comQuebraFinal);
    const conteudo = fs.readFileSync(caminho, 'latin1');
    for (let quantidade = 1; quantidade <= 40; quantidade++) {
      const trechos = dividirEmTrechos(caminho, quantidade);
      assert.equal(trechos[0].inicio, 0);
      assert.equal(trechos.at(-1).fim, conteudo.length);
      for (let k = 1; k < trechos.length; k++) {
        assert.equal(trechos[k].inicio, trechos[k - 1].fim);
        const antes = conteudo.slice(0, trechos[k].inicio - 1).split('\n').at(-1).split(';')[2];
        const depois = conteudo.slice(trechos[k].inicio).split('\n', 1)[0].split(';')[2];
        assert.notEqual(antes, depois);
      }
    }
  });
}

for (const n of [1, 2]) {
  const entrada = `datasets/dataset${n}.txt`;
  test(`dataset${n} em paralelo é igual ao gabarito`, { skip: !fs.existsSync(entrada) }, async () => {
    for (const workers of [2, 3, 5]) {
      const saida = path.join(dir, `saida${n}-${workers}.json`);
      await processarParalelo(entrada, saida, { workers, detector: 'incremental' });
      assert.deepEqual(lerOrdenado(saida), lerOrdenado(`datasets/respostas${n}.json`));
    }
  });
}
