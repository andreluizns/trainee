// Compara duas saídas sem depender da ordem dos encontros. Sai com código 1 se houver diferença.
import fs from 'node:fs';

const [caminhoA, caminhoB] = process.argv.slice(2);
if (!caminhoA || !caminhoB) {
  console.error('Uso: node tools/compare.js <a.json> <b.json>');
  process.exit(2);
}

function indexar(caminho) {
  const mapa = new Map();
  let duplicados = 0;
  for (const e of JSON.parse(fs.readFileSync(caminho, 'utf8'))) {
    const par = [...e.monitoradosEncontro].sort((x, y) => x - y).join('-');
    const chave = `${par}|${e.timestamp}`;
    if (mapa.has(chave)) duplicados++;
    mapa.set(chave, e);
  }
  return { mapa, duplicados };
}

const a = indexar(caminhoA);
const b = indexar(caminhoB);

let soEmA = 0;
let soEmB = 0;
let tipoDiferente = 0;
let distanciaDiferente = 0;
let posicaoDiferente = 0;
const exemplos = [];
const anotar = (texto) => {
  if (exemplos.length < 10) exemplos.push(texto);
};

for (const [chave, ea] of a.mapa) {
  const eb = b.mapa.get(chave);
  if (!eb) {
    soEmA++;
    anotar(`só em A: ${chave}`);
    continue;
  }
  if (ea.tipo !== eb.tipo) {
    tipoDiferente++;
    anotar(`tipo: ${chave} ${ea.tipo} x ${eb.tipo}`);
  }
  if (ea.distanciaMetros !== eb.distanciaMetros) {
    distanciaDiferente++;
    anotar(`distância: ${chave} ${ea.distanciaMetros} x ${eb.distanciaMetros}`);
  }
  for (const id of ea.monitoradosEncontro) {
    if (ea.posicoes[id]?.lat !== eb.posicoes[id]?.lat || ea.posicoes[id]?.lon !== eb.posicoes[id]?.lon) {
      posicaoDiferente++;
      anotar(`posição: ${chave} id ${id}`);
    }
  }
}
for (const chave of b.mapa.keys()) {
  if (!a.mapa.has(chave)) {
    soEmB++;
    anotar(`só em B: ${chave}`);
  }
}

const resumo = {
  encontrosA: a.mapa.size,
  encontrosB: b.mapa.size,
  duplicadosA: a.duplicados,
  duplicadosB: b.duplicados,
  soEmA,
  soEmB,
  tipoDiferente,
  distanciaDiferente,
  posicaoDiferente,
};
const iguais =
  a.duplicados + b.duplicados + soEmA + soEmB + tipoDiferente + distanciaDiferente + posicaoDiferente === 0;

console.log(`${iguais ? 'IGUAIS' : 'DIFERENTES'} ${JSON.stringify(resumo)}`);
for (const exemplo of exemplos) console.log(`  ${exemplo}`);
process.exit(iguais ? 0 : 1);
