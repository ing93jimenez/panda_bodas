export function Header({ coupleNames, subtitle }: { coupleNames?: string; subtitle?: string }) {
  return (
    <header className="text-center pt-8 pb-4 px-4 fade-up">
      <p className="text-xs uppercase tracking-[0.3em] text-muted">Nuestra boda</p>
      <h1 className="title text-4xl font-semibold text-ink mt-1">{coupleNames || " "}</h1>
      <div className="ornament mx-auto max-w-[220px] mt-2 text-sm">❦</div>
      {subtitle && <p className="text-muted mt-2 text-sm">{subtitle}</p>}
    </header>
  );
}
