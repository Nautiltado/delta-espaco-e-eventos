import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { LOGO_PNG } from "./logo";

const ESMERALDA = "#075638";
const DOURADO = "#B99A4B";
const GRAFITE = "#282923";
const SUAVE = "#5f6057";

const s = StyleSheet.create({
  pagina: { paddingTop: 40, paddingBottom: 60, paddingHorizontal: 54, fontFamily: "Times-Roman", fontSize: 10.5, color: GRAFITE },
  // Sem lineHeight: na página ele some com o número de página do rodapé, e no texto o renderizador exagera o espaço.
  topo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1.5, borderBottomColor: DOURADO, paddingBottom: 10, marginBottom: 18 },
  logo: { width: 140 },
  topoTexto: { fontFamily: "Helvetica", fontSize: 8, color: SUAVE, textAlign: "right" },
  titulo: { fontFamily: "Times-Bold", fontSize: 13, color: ESMERALDA, textAlign: "center", marginBottom: 8, marginTop: 4 },
  secao: { fontFamily: "Times-Bold", fontSize: 11, color: ESMERALDA, marginTop: 10, marginBottom: 3 },
  paragrafo: { marginBottom: 6, textAlign: "justify" },
  item: { marginBottom: 2, paddingLeft: 12 },
  assinatura: { marginTop: 4 },
  rodapeLinha: { position: "absolute", bottom: 38, left: 54, right: 54, borderTopWidth: 0.5, borderTopColor: DOURADO },
  rodapeEsq: { position: "absolute", bottom: 26, left: 54, fontFamily: "Helvetica", fontSize: 7, color: SUAVE },
  rodapeDir: { position: "absolute", bottom: 26, right: 54, fontFamily: "Helvetica", fontSize: 7, color: SUAVE },
  marca: { position: "absolute", top: 330, left: 70, fontSize: 60, color: "#E8E2D2", transform: "rotate(-30deg)", fontFamily: "Helvetica-Bold" },
});

type Tipo = "titulo" | "secao" | "item" | "paragrafo" | "branco";

/** Classifica cada linha do texto para dar forma ao PDF sem mudar uma vírgula do texto gravado. */
export function classificarLinha(linha: string, indice: number): Tipo {
  const t = linha.trim();
  if (!t) return "branco";
  if (indice === 0 || /^ANEXO I$/.test(t)) return "titulo";
  if (/^CLÁUSULA\b/.test(t)) return "secao";
  if (t.length < 140 && t === t.toLocaleUpperCase("pt-BR") && /[A-ZÀ-Ú]{3}/.test(t)) return "secao";
  if (/^(- |[a-z]\) |[IVX]+ – )/.test(t)) return "item";
  return "paragrafo";
}

export function DocumentoContrato({
  texto,
  numero,
  hash,
  situacao,
}: {
  texto: string;
  numero: string;
  hash: string | null;
  situacao: "enviado" | "assinado" | "cancelado" | "substituido" | string;
}) {
  const linhas = texto.split("\n");
  const marca = situacao === "cancelado" ? "CANCELADO" : situacao === "substituido" ? "SUBSTITUÍDO" : null;
  return (
    <Document title={`Contrato ${numero}`} author="Delta Espaço e Eventos" language="pt-BR">
      <Page size="A4" style={s.pagina}>
        {marca && <Text style={s.marca} fixed>{marca}</Text>}
        <View style={s.topo} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={LOGO_PNG} style={s.logo} />
          <Text style={s.topoTexto}>Contrato nº {numero}</Text>
        </View>
        {linhas.map((l, i) => {
          const tipo = classificarLinha(l, i);
          if (tipo === "branco") return null;
          const estilo = tipo === "titulo" ? s.titulo : tipo === "secao" ? s.secao : tipo === "item" ? s.item : s.paragrafo;
          return (
            <Text key={i} style={estilo} minPresenceAhead={tipo === "secao" || tipo === "titulo" ? 40 : 0} break={tipo === "titulo" && i > 0}>
              {l.trim()}
            </Text>
          );
        })}
        {/* Rodapé em peças soltas: o renderizador perde um <View fixed> com filhos dinâmicos. */}
        <View style={s.rodapeLinha} fixed />
        {hash && <Text style={s.rodapeEsq} fixed>{`Impressão digital (SHA-256): ${hash.slice(0, 32)}…`}</Text>}
        <Text style={s.rodapeDir} fixed render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
      </Page>
    </Document>
  );
}
