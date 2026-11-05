// Regras de negócio do desafio. Referência e versão otimizada usam este mesmo módulo.

export const RAIO_TERRA_METROS = 6371000;
export const LIMITE_METROS = 20;

// Diferença mínima de latitude, em unidades de 0,00001°, que já garante 20 m ou mais:
// 0,00018° equivale a 20,015 m, e a distância nunca é menor que a distância em latitude.
export const CORTE_LATITUDE_E5 = 18;

const paraRadianos = (graus) => (graus * Math.PI) / 180;

export function haversine(lat1, lon1, lat2, lon2) {
  const dLat = paraRadianos(lat2 - lat1);
  const dLon = paraRadianos(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(paraRadianos(lat1)) * Math.cos(paraRadianos(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAIO_TERRA_METROS * Math.asin(Math.sqrt(h));
}

// `faccao` é -1 quando vazia. `restricoes` mapeia o id da vítima para o Set de seus agressores.
export function classificar(idA, faccaoA, idB, faccaoB, restricoes) {
  if (restricoes.get(idA)?.has(idB) || restricoes.get(idB)?.has(idA)) return 'protetiva';
  if (faccaoA !== -1 && faccaoA === faccaoB) return 'faccao';
  return 'generico';
}
