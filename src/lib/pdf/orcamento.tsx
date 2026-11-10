import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatarCentavos } from "@/lib/dinheiro";
import { formatarData } from "@/lib/datas";
import { formatarDocumento, formatarTelefone } from "@/lib/documentos";
import { formatarQuantidade, rotuloUnidade, TIPOS_ORCAMENTO } from "@/lib/orcamentos";
import { LOGO_PNG } from "./logo";

/** Conteúdo congelado no envio (orcamento_versoes.snapshot) ou montado na hora para a prévia. */
export type ConteudoOrcamento = {
  orcamento: {
    numero: string;
    titulo: string;
    tipo: string;
    data_evento: string | null;
    horario: string | null;
    convidados: number | null;
    local_externo: string | null;
    espaco: string | null;
  };
  versao: number;
  cliente: {
    tipo: "PF" | "PJ";
    nome: string;
    nome_fantasia: string | null;
    documento: string | null;
    responsavel: string | null;
    telefone: string | null;
    email: string | null;
    endereco: string | null;
    cidade: string | null;
    uf: string | null;
  };
  empresa: Record<string, string>;
  itens: { descricao: string; unidade: string; quantidade: number; preco_unitario_centavos: number; total_centavos: number }[];
  subtotal_centavos: number;
  desconto_centavos: number;
  total_centavos: number;
  condicoes: string | null;
  observacoes: string | null;
  validade: string | null;
  enviada_em: string | null;
};

const ESMERALDA = "#075638";
const DOURADO = "#B99A4B";
const GRAFITE = "#282923";
const SUAVE = "#5f6057";

const s = StyleSheet.create({
  pagina: { paddingTop: 36, paddingBottom: 56, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 10, color: GRAFITE },
  topo: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 2, borderBottomColor: DOURADO, paddingBottom: 12, marginBottom: 18 },
  logo: { width: 170 },
  numero: { textAlign: "right" },
  titulo: { fontFamily: "Times-Bold", fontSize: 18, color: ESMERALDA },
  sub: { color: SUAVE, fontSize: 9, marginTop: 2 },
  blocos: { flexDirection: "row", gap: 16, marginBottom: 16 },
  bloco: { flex: 1, backgroundColor: "#F4F0E6", borderRadius: 4, padding: 10 },
  rotulo: { fontSize: 7.5, color: SUAVE, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 },
  forte: { fontFamily: "Helvetica-Bold" },
  tabela: { marginTop: 4 },
  cab: { flexDirection: "row", backgroundColor: ESMERALDA, color: "#FFFFFF", paddingVertical: 5, paddingHorizontal: 6, fontFamily: "Helvetica-Bold", fontSize: 8.5 },
  linha: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: "#D8D2C2" },
  cDesc: { flex: 5 },
  cQtd: { flex: 1.4, textAlign: "right" },
  cUnit: { flex: 1.8, textAlign: "right" },
  cTotal: { flex: 1.8, textAlign: "right" },
  totais: { marginTop: 10, marginLeft: "auto", width: 230 },
  totalLinha: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalFinal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, marginTop: 4, borderTopWidth: 1.5, borderTopColor: ESMERALDA, fontFamily: "Helvetica-Bold", fontSize: 12, color: ESMERALDA },
  secao: { marginTop: 18 },
  secaoTitulo: { fontFamily: "Times-Bold", fontSize: 12, color: ESMERALDA, marginBottom: 4 },
  rodape: { position: "absolute", bottom: 24, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: DOURADO, paddingTop: 6, fontSize: 7.5, color: SUAVE, flexDirection: "row", justifyContent: "space-between" },
  marca: { position: "absolute", top: 330, left: 60, fontSize: 64, color: "#E8E2D2", transform: "rotate(-30deg)", fontFamily: "Helvetica-Bold" },
});

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  if (!valor) return null;
  return (
    <Text>
      <Text style={{ color: SUAVE }}>{rotulo}: </Text>
      {valor}
    </Text>
  );
}

export function DocumentoOrcamento({ c, previa, hash }: { c: ConteudoOrcamento; previa: boolean; hash?: string | null }) {
  const o = c.orcamento;
  const cli = c.cliente;
  const local = o.espaco ? `Delta Espaço e Eventos, ${o.espaco.toLowerCase()}` : o.local_externo;
  return (
    <Document title={`Orçamento ${o.numero}`} author={c.empresa.nome_fantasia ?? "Delta Espaço e Eventos"} language="pt-BR">
      <Page size="A4" style={s.pagina}>
        {previa && <Text style={s.marca} fixed>PRÉVIA</Text>}
        <View style={s.topo}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={LOGO_PNG} style={s.logo} />
          <View style={s.numero}>
            <Text style={s.titulo}>Orçamento</Text>
            <Text style={s.forte}>{o.numero}{c.versao > 1 ? ` · versão ${c.versao}` : ""}</Text>
            <Text style={s.sub}>
              {previa ? "Prévia, ainda não enviada ao cliente" : `Emitido em ${formatarData(c.enviada_em)}`}
            </Text>
            {c.validade && !previa && <Text style={s.sub}>Válido até {formatarData(c.validade)}</Text>}
          </View>
        </View>

        <View style={s.blocos}>
          <View style={s.bloco}>
            <Text style={s.rotulo}>Cliente</Text>
            <Text style={s.forte}>{cli.nome}</Text>
            {cli.nome_fantasia && <Text>{cli.nome_fantasia}</Text>}
            <Campo rotulo={cli.tipo === "PJ" ? "CNPJ" : "CPF"} valor={formatarDocumento(cli.documento)} />
            <Campo rotulo="Responsável" valor={cli.responsavel} />
            <Campo rotulo="Telefone" valor={formatarTelefone(cli.telefone)} />
            <Campo rotulo="E-mail" valor={cli.email} />
          </View>
          <View style={s.bloco}>
            <Text style={s.rotulo}>Evento</Text>
            <Text style={s.forte}>{o.titulo}</Text>
            <Text>{TIPOS_ORCAMENTO[o.tipo] ?? o.tipo}</Text>
            <Campo rotulo="Data" valor={o.data_evento ? formatarData(o.data_evento) : "a definir"} />
            <Campo rotulo="Horário" valor={o.horario} />
            <Campo rotulo="Convidados" valor={o.convidados ? String(o.convidados) : null} />
            <Campo rotulo="Local" valor={local} />
          </View>
        </View>

        <View style={s.tabela}>
          <View style={s.cab} fixed>
            <Text style={s.cDesc}>Item</Text>
            <Text style={s.cQtd}>Qtd.</Text>
            <Text style={s.cUnit}>Valor unit.</Text>
            <Text style={s.cTotal}>Total</Text>
          </View>
          {c.itens.map((i, n) => (
            <View style={s.linha} key={n} wrap={false}>
              <Text style={s.cDesc}>{i.descricao}</Text>
              <Text style={s.cQtd}>{formatarQuantidade(Number(i.quantidade))} {rotuloUnidade(i.unidade, Number(i.quantidade))}</Text>
              <Text style={s.cUnit}>{formatarCentavos(i.preco_unitario_centavos)}</Text>
              <Text style={s.cTotal}>{formatarCentavos(i.total_centavos)}</Text>
            </View>
          ))}
        </View>

        <View style={s.totais} wrap={false}>
          {c.desconto_centavos > 0 && (
            <>
              <View style={s.totalLinha}><Text>Subtotal</Text><Text>{formatarCentavos(c.subtotal_centavos)}</Text></View>
              <View style={s.totalLinha}><Text>Desconto</Text><Text>- {formatarCentavos(c.desconto_centavos)}</Text></View>
            </>
          )}
          <View style={s.totalFinal}><Text>Total</Text><Text>{formatarCentavos(c.total_centavos)}</Text></View>
        </View>

        {c.condicoes && (
          <View style={s.secao} wrap={false}>
            <Text style={s.secaoTitulo}>Condições de pagamento</Text>
            <Text>{c.condicoes}</Text>
          </View>
        )}
        {c.observacoes && (
          <View style={s.secao}>
            <Text style={s.secaoTitulo}>Observações</Text>
            <Text>{c.observacoes}</Text>
          </View>
        )}
        <View style={s.secao} wrap={false}>
          <Text style={{ color: SUAVE, fontSize: 8.5 }}>
            Este orçamento não reserva a data. A reserva é confirmada após a aprovação da proposta, a assinatura do
            contrato e o pagamento da entrada, conforme a política de contratação da Delta.
          </Text>
        </View>

        <View style={s.rodape} fixed>
          <Text>
            {[c.empresa.nome_fantasia, c.empresa.cnpj && `CNPJ ${c.empresa.cnpj}`, c.empresa.endereco].filter(Boolean).join(" · ")}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
        </View>
        {hash && (
          <Text style={{ position: "absolute", bottom: 12, left: 40, fontSize: 6, color: "#A8A493" }} fixed>
            Impressão digital do conteúdo: {hash.slice(0, 32)}
          </Text>
        )}
      </Page>
    </Document>
  );
}
