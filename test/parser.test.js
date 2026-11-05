import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { lerLotes } from '../src/parser.js';

const CABECALHO = 'idMonitorado;faccaoMonitorado;timestamp;latitude;longitude;medidaProtetiva;idsRestricaoMedida';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-test-'));

function ler(conteudo, opcoes) {
  const caminho = path.join(dir, `${Math.random()}.txt`);
  fs.writeFileSync(caminho, conteudo);
  const restricoes = new Map();
  const lotes = [];
  lerLotes(
    caminho,
    restricoes,
    (lote, timestamp) => {
      lotes.push({
        timestamp: timestamp(),
        ids: [...lote.ids.subarray(0, lote.n)],
        faccoes: [...lote.faccoes.subarray(0, lote.n)],
        lat: [...lote.latE5.subarray(0, lote.n)],
        lon: [...lote.lonE5.subarray(0, lote.n)],
      });
    },
    opcoes,
  );
  return { lotes, restricoes };
}

const LINHAS = [
  '1;;"2024-01-01 00:00:00";-25.59386;-73.96319;false;',
  '7;12;"2024-01-01 00:00:00";1.64046;69.53947;false;',
  '9;;"2024-01-01 00:00:00";0.00001;-0.00002;true;"10,7,123"',
  '1;;"2024-01-01 00:00:05";-25.59387;-73.96320;false;',
];
const CONTEUDO = `${CABECALHO}\n${LINHAS.join('\n')}`;

test('agrupa por timestamp e lê todos os campos', () => {
  const { lotes } = ler(CONTEUDO);
  assert.deepEqual(lotes, [
    {
      timestamp: '2024-01-01 00:00:00',
      ids: [1, 7, 9],
      faccoes: [-1, 12, -1],
      lat: [-2559386, 164046, 1],
      lon: [-7396319, 6953947, -2],
    },
    { timestamp: '2024-01-01 00:00:05', ids: [1], faccoes: [-1], lat: [-2559387], lon: [-7396320] },
  ]);
});

test('lê várias restrições', () => {
  const { restricoes } = ler(CONTEUDO);
  assert.deepEqual([...restricoes.get(9)], [10, 7, 123]);
  assert.equal(restricoes.size, 1);
});

test('entrega o último lote com e sem quebra de linha final', () => {
  const esperado = ler(CONTEUDO).lotes;
  assert.deepEqual(ler(`${CONTEUDO}\n`).lotes, esperado);
});

test('última linha sem quebra pode ser de vítima', () => {
  const { lotes, restricoes } = ler(`${CABECALHO}\n${LINHAS[2]}`);
  assert.deepEqual(lotes[0].ids, [9]);
  assert.deepEqual([...restricoes.get(9)], [10, 7, 123]);
});

test('o resultado não depende do tamanho do bloco', () => {
  const esperado = ler(CONTEUDO);
  for (let tamanhoBloco = 1; tamanhoBloco <= 80; tamanhoBloco++) {
    const obtido = ler(CONTEUDO, { tamanhoBloco });
    assert.deepEqual(obtido.lotes, esperado.lotes, `bloco de ${tamanhoBloco} bytes`);
    assert.deepEqual(obtido.restricoes, esperado.restricoes);
  }
});

test('arquivo só com cabeçalho não gera lotes', () => {
  assert.deepEqual(ler(CABECALHO).lotes, []);
  assert.deepEqual(ler(`${CABECALHO}\n`).lotes, []);
});

test('lote maior que a capacidade inicial é ampliado', () => {
  const linhas = Array.from({ length: 1000 }, (_, i) => `${i + 1};;"2024-01-01 00:00:00";1.00000;2.00000;false;`);
  const { lotes } = ler(`${CABECALHO}\n${linhas.join('\n')}`);
  assert.equal(lotes[0].ids.length, 1000);
  assert.equal(lotes[0].ids[999], 1000);
});
