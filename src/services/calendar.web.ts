/** Na web não há agenda nativa: quem sincroniza é o app do celular. */
export const AGENDA_DISPONIVEL = false;

export interface CalendarioInfo {
  id: string;
  titulo: string;
  conta: string;
  cor: string;
  principal: boolean;
}

export type ResultadoSync =
  | { ok: true; acao: 'criado' | 'atualizado' | 'removido' | 'nada' }
  | { ok: false; motivo: string };

export async function garantirPermissao() {
  return false;
}
export async function listarCalendarios(): Promise<CalendarioInfo[]> {
  return [];
}
export async function syncEvento(_id: number): Promise<ResultadoSync> {
  return { ok: true, acao: 'nada' };
}
export async function removerDaAgenda(_id: number) {}
export async function estaNaAgenda(_id: number) {
  return false;
}
export async function sincronizarAgenda(_forcar = false) {
  return null;
}
export async function vincular(_e: number, _c: string) {}
