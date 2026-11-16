import type { SQLiteDatabase } from 'expo-sqlite';

export const DB_NAME = 'meus-cursos.db';

const CATEGORIAS_INICIAIS = [
  'Tecnologia/Programação',
  'IA',
  'Design',
  'Negócios/Empreendedorismo',
  'Marketing/Vendas',
  'Finanças',
  'Produtividade',
  'Desenvolvimento Pessoal',
  'Saúde/Bem-estar',
  'Idiomas',
  'Outros',
];

const VERSAO_ATUAL = 1;

export async function migrar(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let versao = row?.user_version ?? 0;
  if (versao >= VERSAO_ATUAL) return;

  if (versao === 0) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL UNIQUE COLLATE NOCASE,
        criado_em TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL UNIQUE COLLATE NOCASE
      );
      CREATE TABLE IF NOT EXISTS eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        link TEXT NOT NULL,
        titulo TEXT NOT NULL,
        descricao TEXT,
        organizador TEXT,
        instagram TEXT,
        analise_perfil TEXT,
        plataforma TEXT,
        formato TEXT,
        local TEXT,
        categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'interessado',
        gratuito INTEGER NOT NULL DEFAULT 1,
        valor REAL,
        data_inicio TEXT,
        data_fim TEXT,
        calendar_event_id TEXT,
        criado_em TEXT NOT NULL,
        atualizado_em TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS evento_tags (
        evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (evento_id, tag_id)
      );
      CREATE TABLE IF NOT EXISTS config (
        chave TEXT PRIMARY KEY,
        valor TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_eventos_data ON eventos(data_inicio);
      CREATE INDEX IF NOT EXISTS idx_eventos_status ON eventos(status);
    `);
    for (const nome of CATEGORIAS_INICIAIS) {
      await db.runAsync('INSERT OR IGNORE INTO categorias (nome) VALUES (?)', [nome]);
    }
    versao = 1;
  }

  // Próximas migrações: if (versao === 1) { ...; versao = 2; }

  await db.execAsync(`PRAGMA user_version = ${versao}`);
}
