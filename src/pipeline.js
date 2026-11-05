import { DETECTORES } from './detector.js';
import { classificar } from './domain.js';
import { lerLotes } from './parser.js';
import { EscritorJson } from './writer.js';

const E5 = 100000;
const DETECTOR_PADRAO = 'incremental';

export function contagemVazia() {
  return { generico: 0, faccao: 0, protetiva: 0 };
}

// Detecta os encontros de um arquivo ou trecho, chamando `aoEncontro` para cada um.
export function detectarEncontros(entrada, { detector = DETECTOR_PADRAO, tamanhoBloco, inicio, fim } = {}, aoEncontro) {
  const detectar = DETECTORES[detector];
  if (!detectar) throw new Error(`Detector desconhecido: ${detector}`);

  const restricoes = new Map();
  lerLotes(
    entrada,
    restricoes,
    (lote, timestamp) => {
      detectar(lote, (i, j, distanciaMetros) => {
        const { ids, faccoes, latE5, lonE5 } = lote;
        aoEncontro({
          tipo: classificar(ids[i], faccoes[i], ids[j], faccoes[j], restricoes),
          monitoradosEncontro: ids[i] < ids[j] ? [ids[i], ids[j]] : [ids[j], ids[i]],
          timestamp: timestamp(),
          posicoes: {
            [ids[i]]: { lat: latE5[i] / E5, lon: lonE5[i] / E5 },
            [ids[j]]: { lat: latE5[j] / E5, lon: lonE5[j] / E5 },
          },
          distanciaMetros,
        });
      });
    },
    { tamanhoBloco, inicio, fim },
  );
}

export function processar(entrada, saida, opcoes = {}) {
  const escritor = new EscritorJson(saida);
  const contagem = contagemVazia();
  try {
    detectarEncontros(entrada, opcoes, (encontro) => {
      contagem[encontro.tipo]++;
      escritor.escrever(encontro);
    });
  } finally {
    escritor.fechar();
  }
  return contagem;
}

