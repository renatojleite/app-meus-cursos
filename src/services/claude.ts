/**
 * Cliente da Edge Function "enriquecer" (Supabase). A chamada ao Claude e a
 * leitura da página acontecem no servidor; aqui só normalizamos o resultado.
 */
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Formato } from '../types';

export interface ResultadoIA {
  titulo: string | null;
  descricao: string | null;
  organizador: string | null;
  instagram: string | null;
  analise_perfil: string | null;
  plataforma: string | null;
  formato: Formato | null;
  local: string | null;
  categoria: string | null;
  categoria_nova: boolean;
  tags: string[];
  gratuito: boolean | null;
  valor: number | null;
  data_inicio: string | null; // ISO UTC
  data_fim: string | null;
  hora_incerta: boolean;
}

export interface EntradaIA {
  link: string;
  legenda?: string;
  imagemBase64?: string | null;
  imagemMime?: string;
  categorias: string[];
  tagsExistentes: string[];
}

/** "YYYY-MM-DDTHH:mm" ou "YYYY-MM-DD" (hora local do aparelho) → ISO UTC. */
export function localParaIso(s: string | null | undefined): { iso: string | null; semHora: boolean } {
  if (!s || typeof s !== 'string') return { iso: null, semHora: false };
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) {
    const d = new Date(s);
    return { iso: isNaN(d.getTime()) ? null : d.toISOString(), semHora: false };
  }
  const [, y, mo, d, h, mi] = m;
  const semHora = h === undefined;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d), semHora ? 9 : Number(h), semHora ? 0 : Number(mi));
  return { iso: isNaN(dt.getTime()) ? null : dt.toISOString(), semHora };
}

function hojeTexto() {
  return new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export async function enriquecer(e: EntradaIA): Promise<{ resultado: ResultadoIA; plataforma: string }> {
  const { data, error } = await supabase.functions.invoke('enriquecer', {
    body: { ...e, hoje: hojeTexto() },
  });
  if (error) {
    let msg = error.message;
    if (error instanceof FunctionsHttpError) {
      const corpo = await error.context.json().catch(() => null);
      if (corpo?.error) msg = corpo.error;
    }
    throw new Error(msg);
  }

  const j = (data?.resultado ?? {}) as Record<string, any>;
  const ini = localParaIso(j.data_inicio);
  const fim = localParaIso(j.data_fim);
  const formato = ['online', 'presencial', 'hibrido'].includes(j.formato) ? (j.formato as Formato) : null;

  return {
    plataforma: (data?.plataforma as string) ?? '',
    resultado: {
      titulo: str(j.titulo),
      descricao: str(j.descricao),
      organizador: str(j.organizador),
      instagram: str(j.instagram)?.replace(/^@/, '') ?? null,
      analise_perfil: str(j.analise_perfil),
      plataforma: str(j.plataforma),
      formato,
      local: str(j.local),
      categoria: str(j.categoria),
      categoria_nova: !!j.categoria_nova,
      tags: Array.isArray(j.tags)
        ? j.tags.filter((t: unknown) => typeof t === 'string').map((t: string) => t.toLowerCase().trim()).slice(0, 8)
        : [],
      gratuito: typeof j.gratuito === 'boolean' ? j.gratuito : null,
      valor: typeof j.valor === 'number' ? j.valor : null,
      data_inicio: ini.iso,
      data_fim: fim.iso,
      hora_incerta: !!j.hora_incerta || ini.semHora,
    },
  };
}
