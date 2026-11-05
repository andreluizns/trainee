// Referência lenta e propositalmente simples: sem parser próprio e sem filtro.
// Serve para conferir a versão otimizada nos datasets que não têm gabarito.
import fs from 'node:fs';
import readline from 'node:readline';
import { LIMITE_METROS, classificar, haversine } from '../src/domain.js';

const [entrada, saida] = process.argv.slice(2);
if (!entrada || !saida) {
  console.error('Uso: node tools/brute-force.js <dataset.txt> <saida.json>');
  process.exit(2);
}

const restricoes = new Map();
const fd = fs.openSync(saida, 'w');
let primeiro = true;
fs.writeSync(fd, '[');

function processarGrupo(grupo) {
  for (let i = 0; i < grupo.length; i++) {
    for (let j = i + 1; j < grupo.length; j++) {
      const a = grupo[i];
      const b = grupo[j];
      const distanciaMetros = haversine(a.lat, a.lon, b.lat, b.lon);
      if (distanciaMetros >= LIMITE_METROS) continue;
      const encontro = {
        tipo: classificar(a.id, a.faccao, b.id, b.faccao, restricoes),
        monitoradosEncontro: [a.id, b.id].sort((x, y) => x - y),
        timestamp: a.timestamp,
        posicoes: { [a.id]: { lat: a.lat, lon: a.lon }, [b.id]: { lat: b.lat, lon: b.lon } },
        distanciaMetros,
      };
      fs.writeSync(fd, (primeiro ? '\n' : ',\n') + JSON.stringify(encontro));
      primeiro = false;
    }
  }
}

let cabecalho = true;
let grupo = [];
for await (const linha of readline.createInterface({ input: fs.createReadStream(entrada) })) {
  if (cabecalho) {
    cabecalho = false;
    continue;
  }
  const [id, faccao, ts, lat, lon, medida, ids] = linha.split(';');
  const timestamp = ts.replaceAll('"', '');
  if (grupo.length > 0 && grupo[0].timestamp !== timestamp) {
    processarGrupo(grupo);
    grupo = [];
  }
  if (medida === 'true') {
    const agressores = ids.replaceAll('"', '').split(',').filter(Boolean).map(Number);
    restricoes.set(Number(id), new Set(agressores));
  }
  grupo.push({
    id: Number(id),
    faccao: faccao === '' ? -1 : Number(faccao),
    timestamp,
    lat: parseFloat(lat),
    lon: parseFloat(lon),
  });
}
if (grupo.length > 0) processarGrupo(grupo);
fs.writeSync(fd, primeiro ? ']\n' : '\n]\n');
fs.closeSync(fd);
