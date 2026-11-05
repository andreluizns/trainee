import { CORTE_LATITUDE_E5, LIMITE_METROS, haversine } from './domain.js';

const E5 = 100000;

// Calcula o Haversine só para quem passou pelo filtro e emite o par se for encontro.
function testarPar(lote, i, j, emitir) {
  const { latE5, lonE5 } = lote;
  const distancia = haversine(latE5[i] / E5, lonE5[i] / E5, latE5[j] / E5, lonE5[j] / E5);
  if (distancia < LIMITE_METROS) emitir(i, j, distancia);
}

// Opção A: todos os pares, com filtro inteiro de latitude antes do Haversine.
export function detectarPares(lote, emitir) {
  const { n, latE5 } = lote;
  for (let i = 0; i < n; i++) {
    const lat = latE5[i];
    for (let j = i + 1; j < n; j++) {
      const d = lat - latE5[j];
      if (d < CORTE_LATITUDE_E5 && d > -CORTE_LATITUDE_E5) testarPar(lote, i, j, emitir);
    }
  }
}

const DESLOCAMENTO_LAT = 9000000; // torna a latitude (-90° a 90°) não negativa
const FATOR_CHAVE = 65536; // abre espaço para o índice nos bits baixos da chave
let chaves = new Float64Array(256);

// Opção B: ordena por latitude e para no primeiro vizinho distante demais.
export function detectarOrdenado(lote, emitir) {
  const { n, latE5 } = lote;
  if (chaves.length < n) chaves = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) chaves[i] = (latE5[i] + DESLOCAMENTO_LAT) * FATOR_CHAVE + i;
  chaves.subarray(0, n).sort();

  for (let a = 0; a < n; a++) {
    const i = chaves[a] % FATOR_CHAVE;
    const lat = latE5[i];
    for (let b = a + 1; b < n; b++) {
      const j = chaves[b] % FATOR_CHAVE;
      if (latE5[j] - lat >= CORTE_LATITUDE_E5) break;
      testarPar(lote, i, j, emitir);
    }
  }
}

let ordem = new Int32Array(0);

// Opção C: igual à B, mas reaproveita a ordem do timestamp anterior. As pessoas se movem pouco
// em 5 s, então a ordem quase não muda e a ordenação por inserção fica perto de O(n).
export function detectarIncremental(lote, emitir) {
  const { n, latE5 } = lote;
  if (ordem.length !== n) ordem = Int32Array.from({ length: n }, (_, i) => i);

  for (let a = 1; a < n; a++) {
    const i = ordem[a];
    const lat = latE5[i];
    let b = a - 1;
    while (b >= 0 && latE5[ordem[b]] > lat) {
      ordem[b + 1] = ordem[b];
      b--;
    }
    ordem[b + 1] = i;
  }

  for (let a = 0; a < n; a++) {
    const i = ordem[a];
    const lat = latE5[i];
    for (let b = a + 1; b < n; b++) {
      const j = ordem[b];
      if (latE5[j] - lat >= CORTE_LATITUDE_E5) break;
      testarPar(lote, i, j, emitir);
    }
  }
}

export const DETECTORES = {
  pares: detectarPares,
  ordenado: detectarOrdenado,
  incremental: detectarIncremental,
};
