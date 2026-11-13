import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatarCentavos } from "@/lib/dinheiro";
import {
  apresentacaoPadrao,
  condicoesGerais,
  dadosDoCabecalho,
  descricaoDoServico,
  montarCardapio,
  valorPorPessoa,
} from "@/lib/proposta";
import type { ConteudoOrcamento } from "./orcamento";
import { BRASAO_PNG } from "./brasao";

// Paleta da marca (a mesma do sistema)
const ESMERALDA = "#075638";
const DOURADO = "#B99A4B";
const GRAFITE = "#282923";
const SUAVE = "#5f6057";
const MARFIM = "#F4F0E6";
const LISTRA = "#F7F5EE";

const s = StyleSheet.create({
  pagina: { paddingTop: 30, paddingBottom: 56, paddingHorizontal: 46, fontFamily: "Times-Roman", fontSize: 9.5, color: GRAFITE },
  // Sem lineHeight: na página ele some com o número de página do rodapé, e no texto o renderizador exagera o espaço.
  topo: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1.2, borderBottomColor: DOURADO, paddingBottom: 8, marginBottom: 10 },
  brasao: { width: 48, height: 48 },
  marca: { flex: 1, alignItems: "center" },
  marcaNome: { fontFamily: "Times-Bold", fontSize: 24, color: DOURADO, letterSpacing: 2, lineHeight: 1 },
  marcaSub: { fontFamily: "Times-Bold", fontSize: 8.5, color: ESMERALDA, letterSpacing: 1.5, marginTop: 4, lineHeight: 1 },
  numero: { width: 48, fontSize: 7, color: SUAVE, textAlign: "right" },
  titulo: { fontFamily: "Times-Bold", fontSize: 17, color: ESMERALDA, textAlign: "center", lineHeight: 1.1 },
  subtitulo: { fontFamily: "Times-Bold", fontSize: 10.5, color: DOURADO, textAlign: "center", marginTop: 3, textTransform: "uppercase", lineHeight: 1.1 },
  para: { fontSize: 8.5, color: SUAVE, textAlign: "center", marginTop: 3 },
  grade: { flexDirection: "row", flexWrap: "wrap", backgroundColor: MARFIM, marginTop: 9, marginBottom: 6, paddingVertical: 2 },
  celula: { width: "50%", paddingHorizontal: 10, paddingVertical: 3 },
  rotulo: { fontFamily: "Times-Bold", fontSize: 7, color: DOURADO, textTransform: "uppercase", letterSpacing: 0.5 },
  valor: { fontFamily: "Times-Bold", fontSize: 10, marginTop: 1 },
  secao: { fontFamily: "Times-Bold", fontSize: 11, color: ESMERALDA, marginTop: 8, marginBottom: 4 },
  texto: { textAlign: "justify" },
  tabela: { borderWidth: 0.5, borderColor: "#d9d4c4" },
  cabecalhoTabela: { flexDirection: "row", backgroundColor: ESMERALDA },
  th: { fontFamily: "Times-Bold", fontSize: 7.5, color: "#fff", textTransform: "uppercase", paddingVertical: 4, paddingHorizontal: 6, letterSpacing: 0.4 },
  linha: { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: "#e2ddd0" },
  colCat: { width: "25%", paddingVertical: 4, paddingHorizontal: 6, fontFamily: "Times-Bold", color: ESMERALDA, borderRightWidth: 0.5, borderRightColor: "#e2ddd0" },
  colComp: { width: "75%", paddingVertical: 4, paddingHorizontal: 6 },
  colDesc: { flex: 1, paddingVertical: 5, paddingHorizontal: 6, borderRightWidth: 0.5, borderRightColor: "#e2ddd0" },
  colValor: { width: 120, paddingVertical: 5, paddingHorizontal: 6, textAlign: "right", fontFamily: "Times-Bold" },
  total: { fontFamily: "Times-Bold", fontSize: 12, color: ESMERALDA },
  porPessoa: { fontSize: 8.5, color: SUAVE, textAlign: "right", marginTop: 3 },
  bullet: { flexDirection: "row", marginBottom: 2.5 },
  bulletMarca: { width: 10, color: DOURADO },
  rodapeLinha: { position: "absolute", bottom: 40, left: 46, right: 46, borderTopWidth: 0.8, borderTopColor: DOURADO },
  rodapeTexto: { position: "absolute", bottom: 26, left: 46, right: 46, textAlign: "center", fontFamily: "Times-Bold", fontSize: 7.5, color: ESMERALDA, letterSpacing: 0.4 },
  rodapePagina: { position: "absolute", bottom: 26, right: 46, fontSize: 7, color: SUAVE },
  previa: { position: "absolute", top: 360, left: 60, fontSize: 58, color: "#ECE6D6", transform: "rotate(-28deg)", fontFamily: "Times-Bold" },
});

function Bullet({ children }: { children: string }) {
  return (
    <View style={s.bullet} wrap={false}>
      <Text style={s.bulletMarca}>•</Text>
      <Text style={{ flex: 1 }}>{children}</Text>
    </View>
  );
}

export function DocumentoProposta({
  c, previa, confirmacaoDias, categoriaPorNome,
}: {
  c: ConteudoOrcamento;
  previa: boolean;
  confirmacaoDias?: number;
  /** Para versões antigas sem categoria no conteúdo congelado: procura pelo nome do item no catálogo. */
  categoriaPorNome?: Map<string, string>;
}) {
  const cardapio = montarCardapio(c.itens, categoriaPorNome);
  const cab = dadosDoCabecalho(c);
  const porPessoa = valorPorPessoa(c);
  // descontos dados item a item já estão abatidos do subtotal; para o cliente aparecem somados ao desconto geral
  const descontoTotal = c.desconto_centavos + (c.descontos_itens_centavos ?? 0);
  const empresa = c.empresa ?? {};
  const cidade = [empresa.cidade, "MA"].filter(Boolean).join("/").toUpperCase() || "BACABAL/MA";
  const rodape = ["DELTA ESPAÇO E EVENTOS", cidade, empresa.telefones].filter(Boolean).join("   |   ");
  const condicoes = condicoesGerais(c, confirmacaoDias);
  const cliente = c.cliente.tipo === "PJ" ? c.cliente.nome_fantasia || c.cliente.nome : c.cliente.nome;

  return (
    <Document title={`Proposta ${c.orcamento.numero}`} author="Delta Espaço e Eventos" language="pt-BR">
      <Page size="A4" style={s.pagina}>
        {previa && <Text style={s.previa} fixed>PRÉVIA</Text>}

        <View style={s.topo}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={BRASAO_PNG} style={s.brasao} />
          <View style={s.marca}>
            <Text style={s.marcaNome}>DELTA</Text>
            <Text style={s.marcaSub}>ESPAÇO E EVENTOS</Text>
          </View>
          <Text style={s.numero}>{c.orcamento.numero}{c.versao > 1 ? `\nversão ${c.versao}` : ""}</Text>
        </View>

        <Text style={s.titulo}>PROPOSTA COMERCIAL</Text>
        <Text style={s.subtitulo}>{c.orcamento.titulo.trim()}</Text>
        <Text style={s.para}>Preparada para {cliente}</Text>

        <View style={s.grade}>
          <View style={s.celula}><Text style={s.rotulo}>Data do serviço</Text><Text style={s.valor}>{cab.data}</Text></View>
          <View style={s.celula}><Text style={s.rotulo}>Horário</Text><Text style={s.valor}>{cab.horario}</Text></View>
          <View style={s.celula}><Text style={s.rotulo}>Público estimado</Text><Text style={s.valor}>{cab.publico}</Text></View>
          <View style={s.celula}><Text style={s.rotulo}>Local</Text><Text style={s.valor}>{cab.local}</Text></View>
        </View>

        <Text style={s.secao}>1. APRESENTAÇÃO</Text>
        <Text style={s.texto}>{c.apresentacao?.trim() || apresentacaoPadrao(c, cardapio)}</Text>

        <Text style={s.secao}>2. CARDÁPIO PROPOSTO</Text>
        <View style={s.tabela}>
          <View style={s.cabecalhoTabela}>
            <Text style={[s.th, { width: "25%", textAlign: "center" }]}>Categoria</Text>
            <Text style={[s.th, { width: "75%", textAlign: "center" }]}>Composição</Text>
          </View>
          {cardapio.map((l, n) => (
            <View key={l.categoria} style={[s.linha, n % 2 ? { backgroundColor: LISTRA } : {}]} wrap={false}>
              <Text style={s.colCat}>{l.categoria}</Text>
              <Text style={s.colComp}>{l.composicao}</Text>
            </View>
          ))}
        </View>

        <View wrap={false}>
          <Text style={s.secao}>3. CONDIÇÕES COMERCIAIS</Text>
          <View style={s.tabela}>
            <View style={s.cabecalhoTabela}>
              <Text style={[s.th, { flex: 1 }]}>Descrição do serviço</Text>
              <Text style={[s.th, { width: 120, textAlign: "right" }]}>Valor total</Text>
            </View>
            {descontoTotal > 0 && (
              <>
                <View style={s.linha}>
                  <Text style={s.colDesc}>{descricaoDoServico(c, cardapio)}</Text>
                  <Text style={[s.colValor, { fontFamily: "Times-Roman" }]}>{formatarCentavos(c.total_centavos + descontoTotal)}</Text>
                </View>
                <View style={s.linha}>
                  <Text style={s.colDesc}>Desconto</Text>
                  <Text style={[s.colValor, { fontFamily: "Times-Roman" }]}>- {formatarCentavos(descontoTotal)}</Text>
                </View>
              </>
            )}
            <View style={[s.linha, { backgroundColor: LISTRA }]}>
              <Text style={[s.colDesc, descontoTotal > 0 ? { fontFamily: "Times-Bold" } : {}]}>
                {descontoTotal > 0 ? "Total" : descricaoDoServico(c, cardapio)}
              </Text>
              <Text style={[s.colValor, s.total]}>{formatarCentavos(c.total_centavos)}</Text>
            </View>
          </View>
          {porPessoa && <Text style={s.porPessoa}>Equivale a {porPessoa} por convidado.</Text>}
        </View>

        <Text style={s.secao} minPresenceAhead={40}>4. CONDIÇÕES GERAIS</Text>
        {condicoes.map((t, n) => <Bullet key={n}>{t}</Bullet>)}

        {/* Rodapé em peças soltas: o renderizador perde um <View fixed> com filhos dinâmicos depois de quebra de página. */}
        <View style={s.rodapeLinha} fixed />
        <Text style={s.rodapeTexto} fixed>{rodape}</Text>
        <Text style={s.rodapePagina} fixed render={({ pageNumber, totalPages }) => (totalPages > 1 ? `${pageNumber}/${totalPages}` : " ")} />
      </Page>
    </Document>
  );
}
