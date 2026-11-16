export type Status = 'pesquisando' | 'interessado' | 'inscrito';
export type Formato = 'online' | 'presencial' | 'hibrido';

export const STATUS_LIST: Status[] = ['pesquisando', 'interessado', 'inscrito'];

export const STATUS_INFO: Record<Status, { label: string; emoji: string; cor: string }> = {
  pesquisando: { label: 'Pesquisando', emoji: '🔍', cor: '#8A8F98' },
  interessado: { label: 'Interessado', emoji: '⭐', cor: '#E0A100' },
  inscrito: { label: 'Inscrito', emoji: '✅', cor: '#1E9E5A' },
};

export interface Categoria {
  id: number;
  nome: string;
}

export interface Tag {
  id: number;
  nome: string;
}

export interface Evento {
  id: number;
  link: string;
  titulo: string;
  descricao: string | null;
  organizador: string | null;
  instagram: string | null;
  analise_perfil: string | null;
  plataforma: string | null;
  formato: Formato | null;
  local: string | null;
  categoria_id: number | null;
  status: Status;
  gratuito: boolean;
  valor: number | null;
  data_inicio: string | null;
  data_fim: string | null;
  criado_em: string;
  atualizado_em: string;
  // joins
  categoria_nome?: string | null;
  tags?: string[];
}

/** Dados editáveis no formulário (antes de salvar). */
export interface EventoDraft {
  link: string;
  titulo: string;
  descricao: string;
  organizador: string;
  instagram: string;
  analise_perfil: string;
  plataforma: string;
  formato: Formato | null;
  local: string;
  categoria_id: number | null;
  categoria_sugerida: string | null; // nova categoria sugerida pela IA (ainda não criada)
  status: Status;
  gratuito: boolean;
  valor: number | null;
  data_inicio: string | null;
  data_fim: string | null;
  tags: string[];
}

export const draftVazio = (link = ''): EventoDraft => ({
  link,
  titulo: '',
  descricao: '',
  organizador: '',
  instagram: '',
  analise_perfil: '',
  plataforma: '',
  formato: null,
  local: '',
  categoria_id: null,
  categoria_sugerida: null,
  status: 'interessado',
  gratuito: true,
  valor: null,
  data_inicio: null,
  data_fim: null,
  tags: [],
});

export interface Filtros {
  periodo: 'proximos' | 'passados' | 'sem_data' | 'todos';
  status: Status[];
  categorias: number[];
  tags: number[];
  preco: 'todos' | 'gratuito' | 'pago';
  busca: string;
  instagram: string | null; // cursos do mesmo perfil
}

export const filtrosPadrao: Filtros = {
  periodo: 'todos',
  status: [],
  categorias: [],
  tags: [],
  preco: 'todos',
  busca: '',
  instagram: null,
};
