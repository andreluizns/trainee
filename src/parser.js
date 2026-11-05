import fs from 'node:fs';

const NOVA_LINHA = 10;
const PONTO_E_VIRGULA = 59;
const VIRGULA = 44;
const ASPAS = 34;
const MENOS = 45;
const PONTO = 46;
const ZERO = 48;
const T_MINUSCULO = 116;
const TAMANHO_TIMESTAMP = 19;

function criarLote(capacidade) {
  return {
    n: 0,
    ids: new Int32Array(capacidade),
    faccoes: new Int32Array(capacidade),
    latE5: new Int32Array(capacidade),
    lonE5: new Int32Array(capacidade),
  };
}

function ampliar(lote) {
  const maior = criarLote(lote.ids.length * 2);
  maior.n = lote.n;
  maior.ids.set(lote.ids);
  maior.faccoes.set(lote.faccoes);
  maior.latE5.set(lote.latE5);
  maior.lonE5.set(lote.lonE5);
  return maior;
}

// Lê o arquivo em blocos e chama `aoLote(lote, timestamp)` uma vez por timestamp. Os arrays do
// lote são reaproveitados, e `timestamp()` só cria a string quando alguém precisa dela.
// Pressupõe arquivo ordenado por timestamp e coordenadas com exatamente 5 casas decimais.
// `inicio` e `fim` limitam a leitura a um trecho em bytes, que deve começar no início de uma linha.
export function lerLotes(
  caminho,
  restricoes,
  aoLote,
  { tamanhoBloco = 1 << 22, inicio: inicioTrecho = 0, fim: fimTrecho = Infinity } = {},
) {
  const fd = fs.openSync(caminho, 'r');
  let buf = Buffer.allocUnsafe(tamanhoBloco);
  let lote = criarLote(256);
  const tsAtual = Buffer.alloc(TAMANHO_TIMESTAMP);
  const timestamp = () => tsAtual.latin1Slice(0, TAMANHO_TIMESTAMP);
  let cabecalhoPendente = inicioTrecho === 0;
  let posicao = inicioTrecho;
  let resto = 0;

  const processar = (inicio, fim) => {
    let i = inicio;
    while (i < fim) {
      if (buf[i] === NOVA_LINHA) {
        i++;
        continue;
      }

      let id = 0;
      let c;
      while ((c = buf[i++]) !== PONTO_E_VIRGULA) id = id * 10 + c - ZERO;

      let faccao = -1;
      if (buf[i] === PONTO_E_VIRGULA) {
        i++;
      } else {
        faccao = 0;
        while ((c = buf[i++]) !== PONTO_E_VIRGULA) faccao = faccao * 10 + c - ZERO;
      }

      // Pula a aspa de abertura. O timestamp muda primeiro nos últimos bytes.
      i++;
      let mudou = false;
      for (let k = TAMANHO_TIMESTAMP - 1; k >= 0; k--) {
        if (buf[i + k] !== tsAtual[k]) {
          mudou = true;
          break;
        }
      }
      if (mudou) {
        if (lote.n > 0) {
          aoLote(lote, timestamp);
          lote.n = 0;
        }
        buf.copy(tsAtual, 0, i, i + TAMANHO_TIMESTAMP);
      }
      i += TAMANHO_TIMESTAMP + 2; // timestamp, aspa de fechamento e ponto e vírgula

      let negativo = buf[i] === MENOS;
      if (negativo) i++;
      let lat = 0;
      while ((c = buf[i++]) !== PONTO_E_VIRGULA) if (c !== PONTO) lat = lat * 10 + c - ZERO;
      if (negativo) lat = -lat;

      negativo = buf[i] === MENOS;
      if (negativo) i++;
      let lon = 0;
      while ((c = buf[i++]) !== PONTO_E_VIRGULA) if (c !== PONTO) lon = lon * 10 + c - ZERO;
      if (negativo) lon = -lon;

      if (lote.n === lote.ids.length) lote = ampliar(lote);
      const n = lote.n++;
      lote.ids[n] = id;
      lote.faccoes[n] = faccao;
      lote.latE5[n] = lat;
      lote.lonE5[n] = lon;

      if (buf[i] === T_MINUSCULO) {
        i += 5; // true;
        if (!restricoes.has(id)) {
          const agressores = new Set();
          if (i < fim && buf[i] === ASPAS) {
            i++;
            let agressor = 0;
            while (i < fim && (c = buf[i]) !== ASPAS) {
              if (c === VIRGULA) {
                agressores.add(agressor);
                agressor = 0;
              } else {
                agressor = agressor * 10 + c - ZERO;
              }
              i++;
            }
            agressores.add(agressor);
          }
          restricoes.set(id, agressores);
        }
      } else {
        i += 6; // false;
      }

      while (i < fim && buf[i] !== NOVA_LINHA) i++;
      i++;
    }
  };

  try {
    for (;;) {
      // Uma linha maior que o bloco nunca ocorre nos dados reais, mas o buffer cresce se ocorrer.
      if (resto === buf.length) {
        const maior = Buffer.allocUnsafe(buf.length * 2);
        buf.copy(maior, 0, 0, resto);
        buf = maior;
      }
      const aLer = Math.min(buf.length - resto, fimTrecho - posicao);
      const lidos = aLer > 0 ? fs.readSync(fd, buf, resto, aLer, posicao) : 0;
      posicao += lidos;
      const total = resto + lidos;

      if (lidos === 0) {
        // Última linha, que pode não ter quebra de linha.
        let inicio = 0;
        if (cabecalhoPendente) inicio = total; // arquivo só com cabeçalho
        processar(inicio, total);
        break;
      }

      const ultimaQuebra = buf.lastIndexOf(NOVA_LINHA, total - 1);
      if (ultimaQuebra === -1) {
        resto = total;
        continue;
      }

      let inicio = 0;
      if (cabecalhoPendente) {
        inicio = buf.indexOf(NOVA_LINHA) + 1;
        cabecalhoPendente = false;
      }
      processar(inicio, ultimaQuebra + 1);

      resto = total - ultimaQuebra - 1;
      buf.copyWithin(0, ultimaQuebra + 1, total);
    }
    if (lote.n > 0) aoLote(lote, timestamp);
  } finally {
    fs.closeSync(fd);
  }
}
