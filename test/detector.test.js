import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DETECTORES } from '../src/detector.js';
import { LIMITE_METROS, haversine } from '../src/domain.js';

function criarLote(pontos) {
  return {
    n: pontos.length,
    ids: Int32Array.from(pontos, (_, i) => i + 1),
    faccoes: new Int32Array(pontos.length).fill(-1),
    latE5: Int32Array.from(pontos, (p) => p[0]),
    lonE5: Int32Array.from(pontos, (p) => p[1]),
  };
}

function detectar(nome, pontos) {
  const pares = [];
  DETECTORES[nome](criarLote(pontos), (i, j) => pares.push([Math.min(i, j), Math.max(i, j)].join('-')));
  return pares.sort();
}

function referencia(pontos) {
  const pares = [];
  for (let i = 0; i < pontos.length; i++) {
    for (let j = i + 1; j < pontos.length; j++) {
      const [a, b] = [pontos[i], pontos[j]];
      if (haversine(a[0] / 1e5, a[1] / 1e5, b[0] / 1e5, b[1] / 1e5) < LIMITE_METROS) pares.push(`${i}-${j}`);
    }
  }
  return pares.sort();
}

for (const nome of Object.keys(DETECTORES)) {
  test(`${nome}: 17 unidades de latitude (18,9 m) é encontro`, () => {
    assert.deepEqual(detectar(nome, [[0, 0], [17, 0]]), ['0-1']);
  });

  test(`${nome}: 18 unidades de latitude (20,015 m) não é encontro`, () => {
    assert.deepEqual(detectar(nome, [[0, 0], [18, 0]]), []);
  });

  test(`${nome}: latitude próxima não basta se a longitude está longe`, () => {
    assert.deepEqual(detectar(nome, [[0, 0], [5, 100]]), []);
  });

  test(`${nome}: distância combinada decide, não cada eixo`, () => {
    // 13 unidades em cada eixo dão 20,4 m, mesmo com cada eixo abaixo de 20 m.
    assert.deepEqual(detectar(nome, [[0, 0], [13, 13]]), []);
  });

  test(`${nome}: pontos idênticos são encontro`, () => {
    assert.deepEqual(detectar(nome, [[-1000, 500], [-1000, 500]]), ['0-1']);
  });

  test(`${nome}: lote vazio ou com um ponto não gera encontros`, () => {
    assert.deepEqual(detectar(nome, []), []);
    assert.deepEqual(detectar(nome, [[0, 0]]), []);
  });

  test(`${nome}: vários pares no mesmo timestamp`, () => {
    assert.deepEqual(detectar(nome, [[0, 0], [1, 0], [2, 0], [1000, 0]]), ['0-1', '0-2', '1-2']);
  });

  test(`${nome}: concorda com a força bruta em lotes aleatórios`, () => {
    let semente = 12345;
    const aleatorio = (limite) => {
      semente = (semente * 1103515245 + 12345) % 2147483648;
      return semente % limite;
    };
    for (let rodada = 0; rodada < 300; rodada++) {
      const base = aleatorio(6000000) - 3000000;
      const pontos = Array.from({ length: aleatorio(60) }, () => [base + aleatorio(80), aleatorio(80) - 40]);
      assert.deepEqual(detectar(nome, pontos), referencia(pontos));
    }
  });
}
