import { listarTags } from '../db/repo';
import type { Categoria, EventoDraft } from '../types';
import { enriquecer, type ResultadoIA } from './claude';
import { extrairUrl } from './link';

export interface ImagemEntrada {
  base64: string | null;
  mime: string;
}

/** Chama a Edge Function (lê a página + Claude). Usado em Novo e no "Enriquecer novamente". */
export async function rodarEnriquecimento(opts: {
  link: string;
  legenda?: string;
  imagem?: ImagemEntrada | null;
  categorias: Categoria[];
  onEtapa?: (texto: string) => void;
}): Promise<{ resultado: ResultadoIA; link: string; plataforma: string }> {
  const link = extrairUrl(opts.link) ?? opts.link.trim();
  opts.onEtapa?.('Lendo a página e buscando o perfil no Instagram…');
  const tags = (await listarTags()).map((t) => t.nome);
  const { resultado, plataforma } = await enriquecer({
    link,
    legenda: opts.legenda,
    imagemBase64: opts.imagem?.base64 ?? null,
    imagemMime: opts.imagem?.mime,
    categorias: opts.categorias.map((c) => c.nome),
    tagsExistentes: tags,
  });
  return { resultado, link, plataforma };
}

/**
 * Aplica o resultado da IA sobre um rascunho.
 * - modo "novo": a IA preenche tudo.
 * - modo "mesclar": a IA atualiza, mas mantém o que ela não encontrou e
 *   preserva status e tags existentes (tags novas são somadas).
 */
export function aplicarResultado(
  base: EventoDraft,
  r: ResultadoIA,
  categorias: Categoria[],
  plataforma: string,
  modo: 'novo' | 'mesclar',
): EventoDraft {
  const cat = r.categoria
    ? categorias.find((c) => c.nome.toLowerCase() === r.categoria!.toLowerCase())
    : undefined;
  const m = modo === 'mesclar';
  const pick = (novo: string | null, atual: string) => (novo ?? (m ? atual : ''));

  const gratuito = r.gratuito ?? (r.valor != null ? false : m ? base.gratuito : true);

  return {
    ...base,
    titulo: pick(r.titulo, base.titulo),
    descricao: pick(r.descricao, base.descricao),
    organizador: pick(r.organizador, base.organizador),
    instagram: pick(r.instagram, base.instagram),
    analise_perfil: pick(r.analise_perfil, base.analise_perfil),
    plataforma: r.plataforma ?? (m && base.plataforma ? base.plataforma : plataforma),
    formato: r.formato ?? (m ? base.formato : null),
    local: pick(r.local, base.local),
    categoria_id: cat?.id ?? (m ? base.categoria_id : null),
    categoria_sugerida: !cat && r.categoria ? r.categoria : null,
    gratuito,
    valor: gratuito ? null : r.valor ?? (m ? base.valor : null),
    data_inicio: r.data_inicio ?? (m ? base.data_inicio : null),
    data_fim: r.data_fim ?? (m ? base.data_fim : null),
    tags: m ? Array.from(new Set([...base.tags, ...r.tags])) : r.tags,
  };
}
