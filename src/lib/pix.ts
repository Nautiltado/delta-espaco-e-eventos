// Pix "copia e cola" estático (BR Code, padrão EMV do Banco Central) com valor e identificador.
// O banco que recebe só confirma pelo extrato: a baixa no sistema continua manual pelo financeiro.

function campo(id: string, valor: string): string {
  if (valor.length > 99) throw new Error(`Campo Pix ${id} longo demais`);
  return id + String(valor.length).padStart(2, "0") + valor;
}

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), como exige o BR Code. */
export function crc16(texto: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(texto)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Sem acento, maiúsculo, só caracteres aceitos pelos bancos. */
function limpar(texto: string, max: number): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, max);
}

export type DadosPix = {
  chave: string;
  nome: string;
  cidade: string;
  valorCentavos: number;
  /** Identificador que aparece no extrato (até 25 letras/números). */
  identificador: string;
  descricao?: string;
};

export function payloadPix(d: DadosPix): string {
  const chave = d.chave.trim();
  if (!chave) throw new Error("Chave Pix não cadastrada");
  if (!Number.isSafeInteger(d.valorCentavos) || d.valorCentavos <= 0) throw new Error("Valor Pix inválido");
  const txid = d.identificador.replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const descricao = d.descricao ? limpar(d.descricao, 40) : "";
  const conta =
    campo("00", "br.gov.bcb.pix") + campo("01", chave) + (descricao ? campo("02", descricao) : "");
  const semCrc =
    campo("00", "01") +
    campo("26", conta) +
    campo("52", "0000") +
    campo("53", "986") +
    campo("54", (d.valorCentavos / 100).toFixed(2)) +
    campo("58", "BR") +
    campo("59", limpar(d.nome, 25) || "DELTA") +
    campo("60", limpar(d.cidade, 15) || "BACABAL") +
    campo("62", campo("05", txid)) +
    "6304";
  return semCrc + crc16(semCrc);
}
