import type { SQLiteDatabase } from 'expo-sqlite';
import type { Categoria, Evento, EventoDraft, Filtros, Status, Tag } from '../types';

type EventoRow = Omit<Evento, 'gratuito' | 'tags'> & { gratuito: number; tags_csv: string | null };

const SELECT_EVENTO = `
  SELECT e.*, c.nome AS categoria_nome,
    (SELECT group_concat(t.nome, '||') FROM evento_tags et JOIN tags t ON t.id = et.tag_id
      WHERE et.evento_id = e.id) AS tags_csv
  FROM eventos e
  LEFT JOIN categorias c ON c.id = e.categoria_id
`;

function mapEvento(r: EventoRow): Evento {
  const { tags_csv, ...rest } = r;
  return {
    ...rest,
    gratuito: !!r.gratuito,
    tags: tags_csv ? tags_csv.split('||').sort((a, b) => a.localeCompare(b)) : [],
  };
}

// ---------- Eventos ----------

export async function listarEventos(db: SQLiteDatabase, f: Filtros): Promise<Evento[]> {
  const where: string[] = [];
  const params: (string | number)[] = [];
  const agora = new Date().toISOString();

  if (f.periodo === 'proximos') {
    where.push('e.data_inicio IS NOT NULL AND COALESCE(e.data_fim, e.data_inicio) >= ?');
    params.push(agora);
  } else if (f.periodo === 'passados') {
    where.push('e.data_inicio IS NOT NULL AND COALESCE(e.data_fim, e.data_inicio) < ?');
    params.push(agora);
  } else if (f.periodo === 'sem_data') {
    where.push('e.data_inicio IS NULL');
  }

  if (f.status.length) {
    where.push(`e.status IN (${f.status.map(() => '?').join(',')})`);
    params.push(...f.status);
  }
  if (f.categorias.length) {
    where.push(`e.categoria_id IN (${f.categorias.map(() => '?').join(',')})`);
    params.push(...f.categorias);
  }
  if (f.tags.length) {
    where.push(
      `EXISTS (SELECT 1 FROM evento_tags et WHERE et.evento_id = e.id AND et.tag_id IN (${f.tags
        .map(() => '?')
        .join(',')}))`,
    );
    params.push(...f.tags);
  }
  if (f.preco === 'gratuito') where.push('e.gratuito = 1');
  if (f.preco === 'pago') where.push('e.gratuito = 0');

  const busca = f.busca.trim();
  if (busca) {
    where.push(
      '(e.titulo LIKE ? OR e.organizador LIKE ? OR e.instagram LIKE ? OR e.descricao LIKE ?)',
    );
    const like = `%${busca}%`;
    params.push(like, like, like, like);
  }

  const ordem =
    f.periodo === 'passados'
      ? 'e.data_inicio DESC'
      : '(e.data_inicio IS NULL), e.data_inicio ASC, e.criado_em DESC';

  const sql = `${SELECT_EVENTO} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${ordem}`;
  const rows = await db.getAllAsync<EventoRow>(sql, params);
  return rows.map(mapEvento);
}

export async function eventosNoIntervalo(
  db: SQLiteDatabase,
  inicioIso: string,
  fimIso: string,
): Promise<Evento[]> {
  const rows = await db.getAllAsync<EventoRow>(
    `${SELECT_EVENTO} WHERE e.data_inicio >= ? AND e.data_inicio < ? ORDER BY e.data_inicio`,
    [inicioIso, fimIso],
  );
  return rows.map(mapEvento);
}

export async function obterEvento(db: SQLiteDatabase, id: number): Promise<Evento | null> {
  const r = await db.getFirstAsync<EventoRow>(`${SELECT_EVENTO} WHERE e.id = ?`, [id]);
  return r ? mapEvento(r) : null;
}

export async function todosEventosComData(db: SQLiteDatabase): Promise<Evento[]> {
  const rows = await db.getAllAsync<EventoRow>(`${SELECT_EVENTO} WHERE e.data_inicio IS NOT NULL`);
  return rows.map(mapEvento);
}

/** Cria ou atualiza. Retorna o id. */
export async function salvarEvento(
  db: SQLiteDatabase,
  d: EventoDraft,
  id?: number,
): Promise<number> {
  const agora = new Date().toISOString();
  const valores = [
    d.link.trim(),
    d.titulo.trim() || 'Sem título',
    d.descricao.trim() || null,
    d.organizador.trim() || null,
    normalizarInstagram(d.instagram),
    d.analise_perfil.trim() || null,
    d.plataforma.trim() || null,
    d.formato,
    d.local.trim() || null,
    d.categoria_id,
    d.status,
    d.gratuito ? 1 : 0,
    d.gratuito ? null : d.valor,
    d.data_inicio,
    d.data_fim,
  ];

  let eventoId = id;
  await db.withTransactionAsync(async () => {
    if (eventoId) {
      await db.runAsync(
        `UPDATE eventos SET link=?, titulo=?, descricao=?, organizador=?, instagram=?, analise_perfil=?,
          plataforma=?, formato=?, local=?, categoria_id=?, status=?, gratuito=?, valor=?, data_inicio=?,
          data_fim=?, atualizado_em=? WHERE id=?`,
        [...valores, agora, eventoId],
      );
    } else {
      const res = await db.runAsync(
        `INSERT INTO eventos (link, titulo, descricao, organizador, instagram, analise_perfil, plataforma,
          formato, local, categoria_id, status, gratuito, valor, data_inicio, data_fim, criado_em, atualizado_em)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [...valores, agora, agora],
      );
      eventoId = res.lastInsertRowId;
    }
    await definirTags(db, eventoId!, d.tags);
  });
  return eventoId!;
}

async function definirTags(db: SQLiteDatabase, eventoId: number, nomes: string[]) {
  await db.runAsync('DELETE FROM evento_tags WHERE evento_id = ?', [eventoId]);
  const unicos = Array.from(new Set(nomes.map((n) => n.trim().toLowerCase()).filter(Boolean)));
  for (const nome of unicos) {
    await db.runAsync('INSERT OR IGNORE INTO tags (nome) VALUES (?)', [nome]);
    const tag = await db.getFirstAsync<{ id: number }>('SELECT id FROM tags WHERE nome = ?', [nome]);
    if (tag) {
      await db.runAsync('INSERT OR IGNORE INTO evento_tags (evento_id, tag_id) VALUES (?, ?)', [
        eventoId,
        tag.id,
      ]);
    }
  }
}

export async function atualizarStatus(db: SQLiteDatabase, id: number, status: Status) {
  await db.runAsync('UPDATE eventos SET status = ?, atualizado_em = ? WHERE id = ?', [
    status,
    new Date().toISOString(),
    id,
  ]);
}

export async function definirCalendarId(db: SQLiteDatabase, id: number, calId: string | null) {
  await db.runAsync('UPDATE eventos SET calendar_event_id = ? WHERE id = ?', [calId, id]);
}

export async function excluirEvento(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM eventos WHERE id = ?', [id]);
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

export async function listarCategorias(db: SQLiteDatabase): Promise<Categoria[]> {
  return db.getAllAsync<Categoria>(
    `SELECT id, nome FROM categorias ORDER BY (nome = 'Outros'), nome COLLATE NOCASE`,
  );
}

export async function criarCategoria(db: SQLiteDatabase, nome: string): Promise<number> {
  const n = nome.trim();
  await db.runAsync('INSERT OR IGNORE INTO categorias (nome) VALUES (?)', [n]);
  const r = await db.getFirstAsync<{ id: number }>('SELECT id FROM categorias WHERE nome = ?', [n]);
  return r!.id;
}

export async function renomearCategoria(db: SQLiteDatabase, id: number, nome: string) {
  await db.runAsync('UPDATE categorias SET nome = ? WHERE id = ?', [nome.trim(), id]);
}

export async function excluirCategoria(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM categorias WHERE id = ?', [id]);
}

// ---------- Tags ----------

export async function listarTags(db: SQLiteDatabase): Promise<(Tag & { total: number })[]> {
  return db.getAllAsync<Tag & { total: number }>(
    `SELECT t.id, t.nome, COUNT(et.evento_id) AS total FROM tags t
     LEFT JOIN evento_tags et ON et.tag_id = t.id
     GROUP BY t.id ORDER BY t.nome COLLATE NOCASE`,
  );
}

export async function renomearTag(db: SQLiteDatabase, id: number, nome: string) {
  await db.runAsync('UPDATE tags SET nome = ? WHERE id = ?', [nome.trim().toLowerCase(), id]);
}

export async function excluirTag(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM tags WHERE id = ?', [id]);
}

// ---------- Config ----------

export async function getConfig(db: SQLiteDatabase, chave: string): Promise<string | null> {
  const r = await db.getFirstAsync<{ valor: string | null }>(
    'SELECT valor FROM config WHERE chave = ?',
    [chave],
  );
  return r?.valor ?? null;
}

export async function setConfig(db: SQLiteDatabase, chave: string, valor: string | null) {
  await db.runAsync(
    'INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor',
    [chave, valor],
  );
}
