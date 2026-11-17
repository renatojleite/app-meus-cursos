/** Lista de cursos em formato de tabela, com ordenação por coluna. */
import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { formatarData, formatarValor } from '../format';
import { cores, espaco, raio } from '../theme';
import { STATUS_INFO, STATUS_LIST, type Evento } from '../types';

export type ColunaChave =
  | 'status'
  | 'titulo'
  | 'instagram'
  | 'categoria'
  | 'data'
  | 'valor'
  | 'plataforma'
  | 'tags'
  | 'criado';

export interface Ordem {
  coluna: ColunaChave;
  asc: boolean;
}

interface Coluna {
  chave: ColunaChave;
  titulo: string;
  largura: number;
  render: (e: Evento) => React.ReactNode;
  valor: (e: Evento) => string | number | null;
}

const txt = (v: string | null | undefined, forte = false) => (
  <Text numberOfLines={1} style={{ color: v ? cores.texto : cores.textoSuave, fontWeight: forte ? '600' : '400', fontSize: 13 }}>
    {v || '—'}
  </Text>
);

const COLUNAS: Coluna[] = [
  {
    chave: 'status',
    titulo: 'Status',
    largura: 130,
    render: (e) => (
      <Text numberOfLines={1} style={{ color: STATUS_INFO[e.status].cor, fontWeight: '700', fontSize: 12 }}>
        {STATUS_INFO[e.status].emoji} {STATUS_INFO[e.status].label}
      </Text>
    ),
    valor: (e) => STATUS_LIST.indexOf(e.status),
  },
  { chave: 'titulo', titulo: 'Título', largura: 300, render: (e) => txt(e.titulo, true), valor: (e) => e.titulo.toLowerCase() },
  {
    chave: 'instagram',
    titulo: 'Perfil',
    largura: 170,
    render: (e) => txt(e.instagram ? `@${e.instagram}` : e.organizador),
    valor: (e) => (e.instagram ?? e.organizador ?? '').toLowerCase() || null,
  },
  { chave: 'categoria', titulo: 'Categoria', largura: 160, render: (e) => txt(e.categoria_nome), valor: (e) => e.categoria_nome?.toLowerCase() ?? null },
  { chave: 'data', titulo: 'Data', largura: 170, render: (e) => txt(e.data_inicio ? formatarData(e.data_inicio) : null), valor: (e) => e.data_inicio },
  {
    chave: 'valor',
    titulo: 'Valor',
    largura: 110,
    render: (e) => txt(formatarValor(e.gratuito, e.valor)),
    valor: (e) => (e.gratuito ? 0 : e.valor ?? null),
  },
  { chave: 'plataforma', titulo: 'Plataforma', largura: 120, render: (e) => txt(e.plataforma), valor: (e) => e.plataforma?.toLowerCase() ?? null },
  {
    chave: 'tags',
    titulo: 'Tags',
    largura: 200,
    render: (e) => txt(e.tags?.length ? e.tags.map((t) => `#${t}`).join(' ') : null),
    valor: (e) => e.tags?.[0] ?? null,
  },
  {
    chave: 'criado',
    titulo: 'Adicionado',
    largura: 120,
    render: (e) => txt(new Date(e.criado_em).toLocaleDateString('pt-BR')),
    valor: (e) => e.criado_em,
  },
];

const LARGURA_TOTAL = COLUNAS.reduce((s, c) => s + c.largura, 0);

/** Ordena; vazios sempre no fim, independente da direção. */
export function ordenar(eventos: Evento[], ordem: Ordem): Evento[] {
  const col = COLUNAS.find((c) => c.chave === ordem.coluna)!;
  return [...eventos].sort((a, b) => {
    const va = col.valor(a);
    const vb = col.valor(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const r = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR');
    return ordem.asc ? r : -r;
  });
}

export default function EventosTabela({
  eventos,
  ordem,
  onOrdem,
  onPress,
  onLongPress,
}: {
  eventos: Evento[];
  ordem: Ordem;
  onOrdem: (o: Ordem) => void;
  onPress: (e: Evento) => void;
  onLongPress?: (e: Evento) => void;
}) {
  const linhas = useMemo(() => ordenar(eventos, ordem), [eventos, ordem]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexGrow: 1 }}>
      <View
        style={{
          minWidth: LARGURA_TOTAL,
          flexGrow: 1,
          backgroundColor: cores.card,
          borderRadius: raio.lg,
          borderWidth: 1,
          borderColor: cores.borda,
          overflow: 'hidden',
        }}
      >
        {/* Cabeçalho */}
        <View style={{ flexDirection: 'row', backgroundColor: '#F0EFEA', borderBottomWidth: 1, borderBottomColor: cores.borda }}>
          {COLUNAS.map((c) => {
            const ativa = ordem.coluna === c.chave;
            return (
              <Pressable
                key={c.chave}
                onPress={() => onOrdem({ coluna: c.chave, asc: ativa ? !ordem.asc : true })}
                style={({ hovered }: any) => ({
                  width: c.largura,
                  flexGrow: c.chave === 'titulo' ? 1 : 0,
                  paddingVertical: 10,
                  paddingHorizontal: espaco.md,
                  backgroundColor: hovered ? '#E7E5DF' : 'transparent',
                })}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: ativa ? cores.primaria : cores.textoSuave }}>
                  {c.titulo.toUpperCase()} {ativa ? (ordem.asc ? '▲' : '▼') : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Linhas */}
        {linhas.map((e, i) => (
          <Pressable
            key={e.id}
            onPress={() => onPress(e)}
            onLongPress={() => onLongPress?.(e)}
            style={({ hovered, pressed }: any) => ({
              flexDirection: 'row',
              alignItems: 'center',
              borderBottomWidth: i < linhas.length - 1 ? 1 : 0,
              borderBottomColor: cores.borda,
              backgroundColor: pressed ? cores.primariaSuave : hovered ? '#FAF9F6' : cores.card,
            })}
          >
            {COLUNAS.map((c) => (
              <View
                key={c.chave}
                style={{
                  width: c.largura,
                  flexGrow: c.chave === 'titulo' ? 1 : 0,
                  paddingVertical: 10,
                  paddingHorizontal: espaco.md,
                }}
              >
                {c.render(e)}
              </View>
            ))}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
