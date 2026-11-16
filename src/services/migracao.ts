/**
 * Migração única: leva os cursos salvos no banco local (versão 1 do app) para o
 * Supabase, mantendo os vínculos com a agenda para não duplicar eventos.
 */
import * as SQLite from 'expo-sqlite';
import { criarCategoria, listarCategorias, salvarEvento } from '../db/repo';
import { getFlag, setCalendarId, setFlag, setSyncAgenda } from '../lib/local';
import type { EventoDraft, Formato, Status } from '../types';
import { vincular } from './calendar';

const FLAG = 'migrado_sqlite_v1';
const DB_NAME = 'meus-cursos.db';

interface LinhaAntiga {
  id: number;
  link: string;
  titulo: string;
  descricao: string | null;
  organizador: string | null;
  instagram: string | null;
  analise_perfil: string | null;
  plataforma: string | null;
  formato: string | null;
  local: string | null;
  status: string;
  gratuito: number;
  valor: number | null;
  data_inicio: string | null;
  data_fim: string | null;
  calendar_event_id: string | null;
  categoria_nome: string | null;
  tags_csv: string | null;
}

export async function migrarDadosLocais(): Promise<number> {
  if (await getFlag(FLAG)) return 0;
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  try {
    const existe = await db.getFirstAsync<{ n: number }>(
      "SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name='eventos'",
    );
    if (!existe?.n) {
      await setFlag(FLAG);
      return 0;
    }

    // Preferências da agenda
    const cfg = await db.getAllAsync<{ chave: string; valor: string | null }>('SELECT chave, valor FROM config');
    for (const c of cfg) {
      if (c.chave === 'calendar_id' && c.valor) await setCalendarId(c.valor);
      if (c.chave === 'sync_agenda') await setSyncAgenda(c.valor !== '0');
    }

    // Categorias criadas pelo usuário
    const nomesCat = await db.getAllAsync<{ nome: string }>('SELECT nome FROM categorias');
    const existentes = new Set((await listarCategorias()).map((c) => c.nome.toLowerCase()));
    for (const { nome } of nomesCat) {
      if (!existentes.has(nome.toLowerCase())) await criarCategoria(nome);
    }
    const categorias = await listarCategorias();

    const linhas = await db.getAllAsync<LinhaAntiga>(`
      SELECT e.*, c.nome AS categoria_nome,
        (SELECT group_concat(t.nome, '||') FROM evento_tags et JOIN tags t ON t.id = et.tag_id
          WHERE et.evento_id = e.id) AS tags_csv
      FROM eventos e LEFT JOIN categorias c ON c.id = e.categoria_id`);

    let n = 0;
    for (const l of linhas) {
      const cat = l.categoria_nome
        ? categorias.find((c) => c.nome.toLowerCase() === l.categoria_nome!.toLowerCase())
        : undefined;
      const d: EventoDraft = {
        link: l.link ?? '',
        titulo: l.titulo,
        descricao: l.descricao ?? '',
        organizador: l.organizador ?? '',
        instagram: l.instagram ?? '',
        analise_perfil: l.analise_perfil ?? '',
        plataforma: l.plataforma ?? '',
        formato: (l.formato as Formato) ?? null,
        local: l.local ?? '',
        categoria_id: cat?.id ?? null,
        categoria_sugerida: null,
        status: l.status as Status,
        gratuito: !!l.gratuito,
        valor: l.valor,
        data_inicio: l.data_inicio,
        data_fim: l.data_fim,
        tags: l.tags_csv ? l.tags_csv.split('||') : [],
      };
      const novoId = await salvarEvento(d);
      if (l.calendar_event_id) await vincular(novoId, l.calendar_event_id);
      n++;
    }

    await db.execAsync('DROP TABLE IF EXISTS evento_tags; DROP TABLE IF EXISTS eventos;');
    await setFlag(FLAG);
    return n;
  } finally {
    await db.closeAsync();
  }
}
