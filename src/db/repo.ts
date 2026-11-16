/** Acesso aos dados no Supabase (RLS garante que cada usuário só vê os próprios). */
import { supabase } from '../lib/supabase';
import type { Categoria, Evento, EventoDraft, Filtros, Status, Tag } from '../types';

type Linha = Record<string, any>;

function falha(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function mapEvento(r: Linha): Evento {
  return {
    id: Number(r.id),
    link: r.link ?? '',
    titulo: r.titulo,
    descricao: r.descricao,
    organizador: r.organizador,
    instagram: r.instagram,
    analise_perfil: r.analise_perfil,
    plataforma: r.plataforma,
    formato: r.formato,
    local: r.local,
    categoria_id: r.categoria_id != null ? Number(r.categoria_id) : null,
    status: r.status,
    gratuito: !!r.gratuito,
    valor: r.valor != null ? Number(r.valor) : null,
    data_inicio: r.data_inicio ? new Date(r.data_inicio).toISOString() : null,
    data_fim: r.data_fim ? new Date(r.data_fim).toISOString() : null,
    criado_em: r.criado_em,
    atualizado_em: r.atualizado_em,
    categoria_nome: r.categoria_nome ?? null,
    tags: (r.tags ?? []) as string[],
  };
}

// ---------- Eventos ----------

export async function listarEventos(f: Filtros): Promise<Evento[]> {
  const agora = new Date().toISOString();
  let q = supabase.from('eventos_v').select('*');

  if (f.periodo === 'proximos') {
    q = q.not('data_inicio', 'is', null).or(`data_fim.gte.${agora},and(data_fim.is.null,data_inicio.gte.${agora})`);
  } else if (f.periodo === 'passados') {
    q = q.not('data_inicio', 'is', null).or(`data_fim.lt.${agora},and(data_fim.is.null,data_inicio.lt.${agora})`);
  } else if (f.periodo === 'sem_data') {
    q = q.is('data_inicio', null);
  }
  if (f.status.length) q = q.in('status', f.status);
  if (f.categorias.length) q = q.in('categoria_id', f.categorias);
  if (f.tags.length) q = q.overlaps('tag_ids', f.tags);
  if (f.preco === 'gratuito') q = q.eq('gratuito', true);
  if (f.preco === 'pago') q = q.eq('gratuito', false);

  const busca = f.busca.trim().replace(/[,()*%]/g, ' ').trim();
  if (busca) {
    const like = `*${busca}*`;
    q = q.or(`titulo.ilike.${like},organizador.ilike.${like},instagram.ilike.${like},descricao.ilike.${like}`);
  }

  q =
    f.periodo === 'passados'
      ? q.order('data_inicio', { ascending: false })
      : q.order('data_inicio', { ascending: true, nullsFirst: false }).order('criado_em', { ascending: false });

  const { data, error } = await q;
  falha(error);
  return (data ?? []).map(mapEvento);
}

export async function eventosNoIntervalo(inicioIso: string, fimIso: string): Promise<Evento[]> {
  const { data, error } = await supabase
    .from('eventos_v')
    .select('*')
    .gte('data_inicio', inicioIso)
    .lt('data_inicio', fimIso)
    .order('data_inicio');
  falha(error);
  return (data ?? []).map(mapEvento);
}

export async function obterEvento(id: number): Promise<Evento | null> {
  const { data, error } = await supabase.from('eventos_v').select('*').eq('id', id).maybeSingle();
  falha(error);
  return data ? mapEvento(data) : null;
}

export async function todosEventos(): Promise<Evento[]> {
  const { data, error } = await supabase.from('eventos_v').select('*');
  falha(error);
  return (data ?? []).map(mapEvento);
}

/** Cria ou atualiza (com tags) numa transação. Retorna o id. */
export async function salvarEvento(d: EventoDraft, id?: number): Promise<number> {
  const p = {
    link: d.link.trim(),
    titulo: d.titulo.trim() || 'Sem título',
    descricao: d.descricao.trim() || null,
    organizador: d.organizador.trim() || null,
    instagram: normalizarInstagram(d.instagram),
    analise_perfil: d.analise_perfil.trim() || null,
    plataforma: d.plataforma.trim() || null,
    formato: d.formato,
    local: d.local.trim() || null,
    categoria_id: d.categoria_id,
    status: d.status,
    gratuito: d.gratuito,
    valor: d.gratuito ? null : d.valor,
    data_inicio: d.data_inicio,
    data_fim: d.data_fim,
  };
  const { data, error } = await supabase.rpc('salvar_evento', {
    p_id: id ?? null,
    p,
    p_tags: d.tags,
  });
  falha(error);
  return Number(data);
}

export async function atualizarStatus(id: number, status: Status) {
  const { error } = await supabase
    .from('eventos')
    .update({ status, atualizado_em: new Date().toISOString() })
    .eq('id', id);
  falha(error);
}

export async function excluirEvento(id: number) {
  const { error } = await supabase.from('eventos').delete().eq('id', id);
  falha(error);
}

export function normalizarInstagram(v: string | null | undefined): string | null {
  if (!v) return null;
  let s = v.trim();
  const m = s.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (m) s = m[1];
  s = s.replace(/^@/, '').replace(/\/$/, '');
  return s || null;
}

// ---------- Categorias ----------

export async function garantirCategorias() {
  const { error } = await supabase.rpc('garantir_categorias');
  falha(error);
}

export async function listarCategorias(): Promise<Categoria[]> {
  const { data, error } = await supabase.from('categorias').select('id, nome');
  falha(error);
  return (data ?? [])
    .map((c) => ({ id: Number(c.id), nome: c.nome as string }))
    .sort((a, b) => Number(a.nome === 'Outros') - Number(b.nome === 'Outros') || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function criarCategoria(nome: string): Promise<number> {
  const n = nome.trim();
  const existente = (await listarCategorias()).find((c) => c.nome.toLowerCase() === n.toLowerCase());
  if (existente) return existente.id;
  const { data, error } = await supabase.from('categorias').insert({ nome: n }).select('id').single();
  falha(error);
  return Number(data!.id);
}

export async function renomearCategoria(id: number, nome: string) {
  const { error } = await supabase.from('categorias').update({ nome: nome.trim() }).eq('id', id);
  falha(error);
}

export async function excluirCategoria(id: number) {
  const { error } = await supabase.from('categorias').delete().eq('id', id);
  falha(error);
}

// ---------- Tags ----------

export async function listarTags(): Promise<(Tag & { total: number })[]> {
  const { data, error } = await supabase.from('tags').select('id, nome, evento_tags(count)');
  falha(error);
  return (data ?? [])
    .map((t: Linha) => ({ id: Number(t.id), nome: t.nome as string, total: Number(t.evento_tags?.[0]?.count ?? 0) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function renomearTag(id: number, nome: string) {
  const { error } = await supabase.from('tags').update({ nome: nome.trim().toLowerCase() }).eq('id', id);
  falha(error);
}

export async function excluirTag(id: number) {
  const { error } = await supabase.from('tags').delete().eq('id', id);
  falha(error);
}
