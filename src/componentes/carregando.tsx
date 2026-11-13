/** Esqueleto mostrado na hora do clique, enquanto o servidor monta a página. */
export function Carregando({ titulo }: { titulo?: string }) {
  return (
    <div data-carregando aria-busy="true" aria-live="polite">
      <div className="cabecalho">
        <div>
          {titulo ? <h1>{titulo}</h1> : <div className="esqueleto" style={{ width: 220, height: 34 }} />}
          <div className="esqueleto" style={{ width: "min(520px, 80%)", height: 16, marginTop: 10 }} />
        </div>
      </div>
      <section className="cartao">
        <div className="esqueleto" style={{ width: "40%", height: 20, marginBottom: 18 }} />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="esqueleto" style={{ width: `${92 - i * 9}%`, height: 14, marginBottom: 12 }} />
        ))}
      </section>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
