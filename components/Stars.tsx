export function Stars({ value, className = "" }: { value: number | null; className?: string }) {
  const v = Math.round(value ?? 0);
  return (
    <span className={`text-gold tracking-tight ${className}`} aria-label={`${value ?? 0} de 5 estrellas`}>
      {"★".repeat(v)}
      <span className="text-gold-light">{"★".repeat(5 - v)}</span>
    </span>
  );
}
