/**
 * Agenda nativa (só no celular — a versão web usa calendar.web.ts).
 * Os dados vivem no Supabase; o vínculo evento → evento da agenda fica neste
 * aparelho (lib/local.ts). Assim, mudanças feitas no PC chegam à agenda quando
 * o app do celular sincroniza (ao abrir / voltar ao app).
 */
import {
  AlarmMethod,
  ExpoCalendar,
  ExpoCalendarEvent,
  getCalendarPermissions,
  getCalendars,
  requestCalendarPermissions,
} from 'expo-calendar';
import { obterEvento, todosEventos } from '../db/repo';
import { getCalendarId, getMapa, getSyncAgenda, setMapa, type MapaAgenda } from '../lib/local';
import { STATUS_INFO, type Evento } from '../types';

export const AGENDA_DISPONIVEL = true;

export interface CalendarioInfo {
  id: string;
  titulo: string;
  conta: string;
  cor: string;
  principal: boolean;
}

export async function garantirPermissao(): Promise<boolean> {
  const atual = await getCalendarPermissions();
  if (atual.granted) return true;
  const r = await requestCalendarPermissions();
  return r.granted;
}

export async function listarCalendarios(): Promise<CalendarioInfo[]> {
  if (!(await garantirPermissao())) return [];
  const cals = await getCalendars();
  return cals
    .filter((c) => c.allowsModifications)
    .map((c) => ({
      id: c.id,
      titulo: c.title,
      conta: c.ownerAccount || c.source?.name || '',
      cor: c.color || '#888',
      principal: !!c.isPrimary,
    }))
    .sort((a, b) => Number(b.principal) - Number(a.principal) || a.conta.localeCompare(b.conta));
}

export function tituloAgenda(e: Pick<Evento, 'status' | 'titulo' | 'instagram'>): string {
  return `${STATUS_INFO[e.status].emoji} ${e.titulo}${e.instagram ? ` — @${e.instagram}` : ''}`;
}

function notasAgenda(e: Evento): string {
  return [
    e.descricao,
    e.organizador ? `Organizador: ${e.organizador}` : null,
    e.instagram ? `Instagram: https://instagram.com/${e.instagram}` : null,
    e.gratuito ? 'Gratuito' : e.valor != null ? `Valor: R$ ${e.valor.toFixed(2).replace('.', ',')}` : null,
    `Status: ${STATUS_INFO[e.status].label}`,
    `Link: ${e.link}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function detalhes(e: Evento) {
  const inicio = new Date(e.data_inicio!);
  const fim = e.data_fim ? new Date(e.data_fim) : new Date(inicio.getTime() + 60 * 60 * 1000);
  return {
    title: tituloAgenda(e),
    startDate: inicio,
    endDate: fim > inicio ? fim : new Date(inicio.getTime() + 60 * 60 * 1000),
    notes: notasAgenda(e),
    location: e.formato === 'presencial' || e.formato === 'hibrido' ? e.local ?? e.link : e.link,
    alarms: [{ relativeOffset: -60, method: AlarmMethod.ALERT }],
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/** Assinatura do que aparece na agenda: se não mudou, não regrava. */
function hashEvento(e: Evento, calId: string) {
  const d = detalhes(e);
  return [calId, d.title, d.startDate.toISOString(), d.endDate.toISOString(), d.notes, d.location].join('|');
}

async function apagarNativo(calEventId: string) {
  try {
    const ev = await ExpoCalendarEvent.get(calEventId);
    await ev.delete();
  } catch {
    // já não existe
  }
}

/** Cria/atualiza/remove um evento na agenda. Altera o mapa recebido. */
async function aplicar(e: Evento | null, eventoId: number, calId: string, mapa: MapaAgenda, forcar: boolean) {
  const k = String(eventoId);
  const vinc = mapa[k];

  if (!e || !e.data_inicio) {
    if (vinc) {
      await apagarNativo(vinc.calEventId);
      delete mapa[k];
      return 'removido' as const;
    }
    return 'nada' as const;
  }

  const hash = hashEvento(e, calId);
  if (vinc && vinc.hash === hash && !forcar) return 'nada' as const;
  const det = detalhes(e);

  if (vinc) {
    try {
      const ev = await ExpoCalendarEvent.get(vinc.calEventId);
      if (ev.calendarId === calId) {
        await ev.update(det);
        mapa[k] = { calEventId: vinc.calEventId, hash };
        return 'atualizado' as const;
      }
      await ev.delete(); // mudou o calendário de destino
    } catch {
      // apagado manualmente da agenda: recria
    }
  }
  const cal = await ExpoCalendar.get(calId);
  const novo = await cal.createEvent(det);
  mapa[k] = { calEventId: novo.id, hash };
  return 'criado' as const;
}

export type ResultadoSync =
  | { ok: true; acao: 'criado' | 'atualizado' | 'removido' | 'nada' }
  | { ok: false; motivo: string };

async function preparar(): Promise<{ calId: string } | { motivo: string } | null> {
  if (!(await getSyncAgenda())) return null;
  const calId = await getCalendarId();
  if (!calId) return { motivo: 'Escolha um calendário em Configurações.' };
  if (!(await garantirPermissao())) return { motivo: 'Sem permissão para a agenda.' };
  return { calId };
}

/** Sincroniza um evento (depois de salvar/mudar status). Nunca lança. */
export async function syncEvento(eventoId: number): Promise<ResultadoSync> {
  try {
    const prep = await preparar();
    if (!prep) return { ok: true, acao: 'nada' };
    if ('motivo' in prep) {
      // Sem data não precisa de agenda: não incomoda com aviso
      const e = await obterEvento(eventoId);
      return e?.data_inicio ? { ok: false, motivo: prep.motivo } : { ok: true, acao: 'nada' };
    }
    const mapa = await getMapa();
    const acao = await aplicar(await obterEvento(eventoId), eventoId, prep.calId, mapa, false);
    await setMapa(mapa);
    return { ok: true, acao };
  } catch (err) {
    return { ok: false, motivo: err instanceof Error ? err.message : String(err) };
  }
}

/** Remove da agenda um evento que foi excluído. */
export async function removerDaAgenda(eventoId: number) {
  const mapa = await getMapa();
  const v = mapa[String(eventoId)];
  if (!v) return;
  if (await garantirPermissao()) await apagarNativo(v.calEventId);
  delete mapa[String(eventoId)];
  await setMapa(mapa);
}

export async function estaNaAgenda(eventoId: number) {
  return !!(await getMapa())[String(eventoId)];
}

let rodando = false;

/**
 * Sincronização completa: aplica o que mudou (inclusive pelo PC) e remove da
 * agenda o que foi excluído ou perdeu a data.
 */
export async function sincronizarAgenda(forcar = false): Promise<{ ok: number; falhas: number; total: number } | null> {
  if (rodando) return null;
  rodando = true;
  try {
    const prep = await preparar();
    if (!prep || 'motivo' in prep) return null;
    const eventos = await todosEventos();
    const mapa = await getMapa();
    const porId = new Map(eventos.map((e) => [String(e.id), e]));
    let ok = 0;
    let falhas = 0;

    const ids = new Set([...eventos.filter((e) => e.data_inicio).map((e) => String(e.id)), ...Object.keys(mapa)]);
    for (const k of ids) {
      try {
        await aplicar(porId.get(k) ?? null, Number(k), prep.calId, mapa, forcar);
        ok++;
      } catch {
        falhas++;
      }
    }
    await setMapa(mapa);
    return { ok, falhas, total: ids.size };
  } finally {
    rodando = false;
  }
}

/** Usado pela migração: associa um evento novo a um evento já existente na agenda. */
export async function vincular(eventoId: number, calEventId: string) {
  const mapa = await getMapa();
  mapa[String(eventoId)] = { calEventId, hash: '' };
  await setMapa(mapa);
}
