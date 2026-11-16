export function formatarData(iso: string | null, comHora = true): string {
  if (!iso) return 'Sem data';
  const d = new Date(iso);
  const data = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  if (!comHora) return data;
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${data} · ${hora}`;
}

export function formatarValor(gratuito: boolean, valor: number | null): string {
  if (gratuito) return 'Gratuito';
  if (valor == null) return 'Pago';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function chaveDia(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
