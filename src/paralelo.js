import fs from 'node:fs';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { contagemVazia, detectarEncontros } from './pipeline.js';
import { EscritorJson } from './writer.js';

const JANELA_BUSCA = 1 << 20; // um grupo de timestamp cabe com folga nessa janela
const timestampDaLinha = (linha) => linha.split(';')[2];

// Encontra o início do primeiro timestamp novo a partir de `alvo`. Cortar entre timestamps garante
// que todos os monitorados de um mesmo instante sejam comparados pelo mesmo worker.
function proximoCorte(fd, alvo, tamanho) {
  const janela = Buffer.allocUnsafe(JANELA_BUSCA);
  const lidos = fs.readSync(fd, janela, 0, JANELA_BUSCA, alvo);
  const texto = janela.latin1Slice(0, lidos);

  let inicioLinha = texto.indexOf('\n') + 1;
  if (inicioLinha === 0) return tamanho;
  let fimLinha = texto.indexOf('\n', inicioLinha);
  if (fimLinha === -1) return tamanho;
  const referencia = timestampDaLinha(texto.slice(inicioLinha, fimLinha));

  while (fimLinha !== -1) {
    inicioLinha = fimLinha + 1;
    fimLinha = texto.indexOf('\n', inicioLinha);
    if (fimLinha === -1) break;
    if (timestampDaLinha(texto.slice(inicioLinha, fimLinha)) !== referencia) return alvo + inicioLinha;
  }
  if (alvo + lidos >= tamanho) return tamanho; // o último grupo vai até o fim do arquivo
  throw new Error(`Grupo de timestamp maior que a janela de busca em ${alvo}`);
}

export function dividirEmTrechos(entrada, quantidade) {
  const tamanho = fs.statSync(entrada).size;
  const fd = fs.openSync(entrada, 'r');
  try {
    const cortes = [0];
    for (let k = 1; k < quantidade; k++) {
      const corte = proximoCorte(fd, Math.floor((tamanho * k) / quantidade), tamanho);
      if (corte > cortes.at(-1) && corte < tamanho) cortes.push(corte);
    }
    cortes.push(tamanho);
    return cortes.slice(0, -1).map((inicio, k) => ({ inicio, fim: cortes[k + 1] }));
  } finally {
    fs.closeSync(fd);
  }
}

function executarTrecho(dados) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: dados });
    worker.once('message', resolve);
    worker.once('error', reject);
  });
}

export async function processarParalelo(entrada, saida, { workers, detector } = {}) {
  const trechos = dividirEmTrechos(entrada, workers);
  const resultados = await Promise.all(trechos.map((t) => executarTrecho({ entrada, detector, ...t })));

  // Os trechos estão em ordem no arquivo, então a saída continua cronológica.
  const escritor = new EscritorJson(saida);
  const contagem = contagemVazia();
  try {
    for (const encontros of resultados) {
      for (const encontro of encontros) {
        contagem[encontro.tipo]++;
        escritor.escrever(encontro);
      }
    }
  } finally {
    escritor.fechar();
  }
  return contagem;
}

if (!isMainThread) {
  const { entrada, ...opcoes } = workerData;
  const encontros = [];
  detectarEncontros(entrada, opcoes, (encontro) => encontros.push(encontro));
  parentPort.postMessage(encontros);
}
