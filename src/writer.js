import fs from 'node:fs';

const TAMANHO_DESCARGA = 1 << 20;

// Grava um array JSON aos poucos, sem acumular todos os encontros na memória.
export class EscritorJson {
  constructor(caminho) {
    this.fd = fs.openSync(caminho, 'w');
    this.pendente = '[';
    this.vazio = true;
  }

  escrever(item) {
    this.pendente += (this.vazio ? '\n' : ',\n') + JSON.stringify(item);
    this.vazio = false;
    if (this.pendente.length >= TAMANHO_DESCARGA) this.descarregar();
  }

  descarregar() {
    fs.writeSync(this.fd, this.pendente);
    this.pendente = '';
  }

  fechar() {
    this.pendente += this.vazio ? ']\n' : '\n]\n';
    this.descarregar();
    fs.closeSync(this.fd);
  }
}
