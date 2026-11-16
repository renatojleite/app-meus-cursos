import type { Extracao } from './extract';
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
  data_inicio: string | null; // ISO (convertido para UTC)
  data_fim: string | null;
  hora_incerta: boolean;
}

export interface EntradaIA {
  apiKey: string;
  modelo: string;
  link: string;
  extracao: Extracao | null;
  legenda?: string;
  imagemBase64?: string | null;
  imagemMime?: string;
  categorias: string[];
  tagsExistentes: string[];
}

const API = 'https://api.anthropic.com/v1/messages';

const SISTEMA = `Você é o assistente de um app pessoal que cataloga cursos, lives, workshops e eventos em que o usuário se inscreveu ou tem interesse. O usuário é brasileiro.

Sua tarefa: a partir do link, dos metadados extraídos da página, da legenda e/ou do print (quando houver), descobrir e estruturar as informações do evento.

Passos:
1. Entenda o evento: título, organizador/instrutor, do que se trata, data e hora, preço, plataforma, formato.
2. ENCONTRE A CONTA DO INSTAGRAM do organizador/instrutor principal — mesmo que o link seja de um site ou YouTube. Use a busca na web (ex.: "<nome> instagram", site oficial, bio do canal). Se a página já citar um @, confirme se é do organizador.
3. Faça uma ANÁLISE BREVE DO PERFIL (3 a 5 frases, em português): quem é, nicho, porte/alcance aproximado se encontrável, sinais de credibilidade (empresa, formação, cases, imprensa) e qualquer alerta (pouca presença, sinais de marketing agressivo). Seja factual; diga quando não encontrou dados.
4. Use busca para completar data/hora/preço se não estiverem na página.

Regras:
- Responda com APENAS um objeto JSON válido, sem markdown, sem texto antes ou depois.
- Datas no horário local do evento convertido para o fuso de Brasília, formato "YYYY-MM-DDTHH:mm". Se só souber o dia, use "YYYY-MM-DD" e marque "hora_incerta": true. Datas relativas ("amanhã", "sábado") devem ser resolvidas a partir da data de hoje informada e da data da postagem quando houver.
- "categoria": escolha EXATAMENTE um nome da lista fornecida. Só sugira uma categoria nova (e marque "categoria_nova": true) se nenhuma servir de verdade.
- "tags": 3 a 6 tags curtas em minúsculas, em português; reutilize tags existentes quando fizer sentido.
- "instagram": apenas o handle, sem @ e sem URL. null se não encontrar com razoável confiança.
- "valor": número em reais (ex.: 197.0). Se for gratuito, "gratuito": true e "valor": null. Se não souber, ambos null.
- "descricao": 1 a 3 frases objetivas sobre o conteúdo.
- "formato": "online", "presencial", "hibrido" ou null.

Formato da resposta:
{"titulo":string|null,"descricao":string|null,"organizador":string|null,"instagram":string|null,"analise_perfil":string|null,"plataforma":string|null,"formato":string|null,"local":string|null,"categoria":string|null,"categoria_nova":boolean,"tags":string[],"gratuito":boolean|null,"valor":number|null,"data_inicio":string|null,"data_fim":string|null,"hora_incerta":boolean}`;

type Bloco = { type: string; text?: string; [k: string]: unknown };

async function chamar(apiKey: string, body: object, ms = 120000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const json = await r.json().catch(() => null);
    if (!r.ok) {
      const msg = json?.error?.message || `HTTP ${r.status}`;
      if (r.status === 401) throw new Error('Chave da API inválida. Confira em Configurações.');
      if (r.status === 429) throw new Error('Limite da API atingido. Tente de novo em instantes.');
      throw new Error(`Erro da API: ${msg}`);
    }
    return json as { content: Bloco[]; stop_reason: string };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('A IA demorou demais para responder. Tente novamente.');
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

function hojeTexto() {
  const d = new Date();
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function montarContexto(e: EntradaIA): string {
  const x = e.extracao;
  const partes = [
    `Hoje é ${hojeTexto()}.`,
    `Link: ${e.link}`,
    x?.urlFinal && x.urlFinal !== e.link ? `URL final após redirecionamento: ${x.urlFinal}` : '',
    x ? `Plataforma detectada: ${x.plataforma}` : '',
    x?.youtube ? `YouTube — vídeo: "${x.youtube.titulo}" | canal: ${x.youtube.canal} (${x.youtube.canalUrl})` : '',
    x?.titulo ? `Título da página: ${x.titulo}` : '',
    x?.siteName ? `Site: ${x.siteName}` : '',
    x?.descricao ? `Descrição da página: ${x.descricao}` : '',
    x?.instagramHandles.length ? `Perfis do Instagram citados na página: ${x.instagramHandles.map((h) => '@' + h).join(', ')}` : '',
    x?.jsonLd ? `Dados estruturados (JSON-LD):\n${x.jsonLd}` : '',
    x?.texto ? `Trecho do texto da página:\n${x.texto}` : '',
    x?.erro ? `(Não foi possível ler a página: ${x.erro})` : '',
    e.legenda?.trim() ? `Legenda/texto colado pelo usuário:\n${e.legenda.trim()}` : '',
    e.imagemBase64 ? 'Há um print anexado (post ou perfil). Leia todas as informações dele.' : '',
    `Categorias disponíveis: ${e.categorias.join(' | ')}`,
    e.tagsExistentes.length ? `Tags já usadas pelo usuário: ${e.tagsExistentes.join(', ')}` : '',
  ];
  return partes.filter(Boolean).join('\n\n');
}

function extrairJson(texto: string): any {
  const limpo = texto.replace(/```json|```/g, '');
  const ini = limpo.indexOf('{');
  const fim = limpo.lastIndexOf('}');
  if (ini < 0 || fim <= ini) throw new Error('A IA não retornou dados estruturados.');
  return JSON.parse(limpo.slice(ini, fim + 1));
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

export async function enriquecer(e: EntradaIA): Promise<ResultadoIA> {
  const conteudo: object[] = [];
  if (e.imagemBase64) {
    conteudo.push({
      type: 'image',
      source: { type: 'base64', media_type: e.imagemMime || 'image/jpeg', data: e.imagemBase64 },
    });
  }
  conteudo.push({ type: 'text', text: montarContexto(e) });

  const messages: { role: 'user' | 'assistant'; content: unknown }[] = [
    { role: 'user', content: conteudo },
  ];

  let resp: { content: Bloco[]; stop_reason: string } | null = null;
  for (let i = 0; i < 4; i++) {
    resp = await chamar(e.apiKey, {
      model: e.modelo,
      max_tokens: 4096,
      system: SISTEMA,
      messages,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
    });
    if (resp.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: resp.content });
  }
  if (!resp) throw new Error('Sem resposta da IA.');

  const textoFinal = resp.content
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n');

  const j = extrairJson(textoFinal);
  const ini = localParaIso(j.data_inicio);
  const fim = localParaIso(j.data_fim);
  const formato = ['online', 'presencial', 'hibrido'].includes(j.formato) ? j.formato : null;

  return {
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
    tags: Array.isArray(j.tags) ? j.tags.filter((t: unknown) => typeof t === 'string').map((t: string) => t.toLowerCase().trim()).slice(0, 8) : [],
    gratuito: typeof j.gratuito === 'boolean' ? j.gratuito : null,
    valor: typeof j.valor === 'number' ? j.valor : null,
    data_inicio: ini.iso,
    data_fim: fim.iso,
    hora_incerta: !!j.hora_incerta || ini.semHora,
  };
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}
