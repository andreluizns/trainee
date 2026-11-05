import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { DETECTORES } from '../src/detector.js';
import { processar } from '../src/pipeline.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'integracao-'));
const chave = (e) => `${[...e.monitoradosEncontro].sort((a, b) => a - b).join('-')}|${e.timestamp}`;
const lerJson = (caminho) => JSON.parse(fs.readFileSync(caminho, 'utf8'));

for (const n of [1, 2]) {
  for (const detector of Object.keys(DETECTORES)) {
    const entrada = `datasets/dataset${n}.txt`;
    test(`dataset${n} com ${detector} é igual ao gabarito`, { skip: !fs.existsSync(entrada) }, () => {
      const saida = path.join(dir, `${detector}${n}.json`);
      processar(entrada, saida, { detector });
      const obtido = lerJson(saida).sort((a, b) => chave(a).localeCompare(chave(b)));
      const esperado = lerJson(`datasets/respostas${n}.json`).sort((a, b) => chave(a).localeCompare(chave(b)));
      assert.deepEqual(obtido, esperado);
    });
  }
}

test('dataset sem encontros gera um array vazio', () => {
  const entrada = path.join(dir, 'vazio.txt');
  const saida = path.join(dir, 'vazio.json');
  fs.writeFileSync(entrada, 'cabecalho\n1;;"2024-01-01 00:00:00";1.00000;1.00000;false;\n');
  processar(entrada, saida);
  assert.deepEqual(lerJson(saida), []);
});
