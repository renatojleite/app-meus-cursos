import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BannerAtualizacao } from '../../components/Atualizacao';
import EventoCard from '../../components/EventoCard';
import EventosTabela, { type Ordem } from '../../components/EventosTabela';
import { Botao, Chip, Rotulo, Vazio, s } from '../../components/ui';
import { atualizarStatus, listarCategorias, listarEventos, listarTags } from '../../db/repo';
import { syncEvento } from '../../services/calendar';
import { escolher, avisar } from '../../lib/dialogo';
import { cores, espaco, larguraMax, raio } from '../../theme';
import {
  STATUS_INFO,
  STATUS_LIST,
  filtrosPadrao,
  type Categoria,
  type Evento,
  type Filtros,
  type Status,
  type Tag,
} from '../../types';

const PERIODOS: { k: Filtros['periodo']; label: string }[] = [
  { k: 'todos', label: 'Todos' },
  { k: 'proximos', label: 'Próximos' },
  { k: 'passados', label: 'Passados' },
  { k: 'sem_data', label: 'Sem data' },
];

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export default function Lista() {
  const insets = useSafeAreaInsets();
  const [filtros, setFiltros] = useState<Filtros>(filtrosPadrao);
  const { perfil } = useLocalSearchParams<{ perfil?: string }>();

  // Vindo de "Ver todos os cursos de @perfil"
  useEffect(() => {
    if (perfil) setFiltros((f) => ({ ...f, instagram: perfil, periodo: 'todos' }));
  }, [perfil]);

  const limparPerfil = () => {
    setFiltros((f) => ({ ...f, instagram: null }));
    router.setParams({ perfil: undefined });
  };
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [modal, setModal] = useState(false);

  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [modo, setModo] = useState<'cards' | 'tabela'>('cards');
  const [ordem, setOrdem] = useState<Ordem>({ coluna: 'data', asc: true });

  // Lembra a visualização e a ordenação neste aparelho
  useEffect(() => {
    AsyncStorage.multiGet(['lista_modo', 'lista_ordem'])
      .then(([[, m], [, o]]) => {
        if (m === 'tabela' || m === 'cards') setModo(m);
        if (o) setOrdem(JSON.parse(o));
      })
      .catch(() => {});
  }, []);
  const mudarModo = (m: 'cards' | 'tabela') => {
    setModo(m);
    AsyncStorage.setItem('lista_modo', m).catch(() => {});
  };
  const mudarOrdem = (o: Ordem) => {
    setOrdem(o);
    AsyncStorage.setItem('lista_ordem', JSON.stringify(o)).catch(() => {});
  };
  const largura = modo === 'tabela' ? { ...larguraMax, maxWidth: 1400 } : larguraMax;

  // Busca com pequeno atraso para não consultar a cada tecla
  useEffect(() => {
    const t = setTimeout(() => setFiltros((f) => (f.busca === busca ? f : { ...f, busca })), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const carregar = useCallback(async () => {
    try {
    const [ev, cats, tg] = await Promise.all([listarEventos(filtros), listarCategorias(), listarTags()]);
    setEventos(ev);
    setCategorias(cats);
    setTags(tg);
    setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, [filtros]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  const qtdFiltros =
    (filtros.instagram ? 1 : 0) +
    filtros.status.length + filtros.categorias.length + filtros.tags.length + (filtros.preco !== 'todos' ? 1 : 0);

  const mudarStatus = (e: Evento) => {
    escolher(
      'Mudar status',
      e.titulo,
      [
        ...STATUS_LIST.filter((st) => st !== e.status).map((st) => ({
          text: `${STATUS_INFO[st].emoji} ${STATUS_INFO[st].label}`,
          onPress: async () => {
            await atualizarStatus(e.id, st as Status);
            const r = await syncEvento(e.id);
            if (!r.ok) avisar('Agenda', r.motivo);
            carregar();
          },
        })),
        { text: 'Cancelar', style: 'cancel' as const },
      ],
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={[{ paddingHorizontal: espaco.lg, paddingBottom: espaco.sm }, largura]}>
        <BannerAtualizacao />
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: espaco.sm }}>
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="Buscar título, organizador, @..."
            placeholderTextColor={cores.textoSuave}
            value={busca}
            onChangeText={setBusca}
          />
          <Pressable
            onPress={() => setModal(true)}
            style={[s.input, { justifyContent: 'center', backgroundColor: qtdFiltros ? cores.primariaSuave : cores.card }]}
          >
            <Text style={{ color: cores.primaria, fontWeight: '600' }}>
              Filtros{qtdFiltros ? ` (${qtdFiltros})` : ''}
            </Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            {PERIODOS.map((p) => (
              <Chip
                key={p.k}
                label={p.label}
                ativo={filtros.periodo === p.k}
                onPress={() => setFiltros({ ...filtros, periodo: p.k })}
              />
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: cores.borda, borderRadius: raio.pill, overflow: 'hidden', marginLeft: 6 }}>
            {(['cards', 'tabela'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => mudarModo(m)}
                style={{ paddingHorizontal: 12, paddingVertical: 7, backgroundColor: modo === m ? cores.primaria : cores.card }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: modo === m ? '#fff' : cores.textoSuave }}>
                  {m === 'cards' ? '▤ Cards' : '▦ Tabela'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        {filtros.instagram ? (
          <View style={{ flexDirection: 'row', marginTop: espaco.xs }}>
            <Chip label={`🔗 @${filtros.instagram}  ✕`} ativo onPress={limparPerfil} />
          </View>
        ) : null}
      </View>

      {modo === 'tabela' && eventos.length > 0 ? (
        <ScrollView contentContainerStyle={[{ paddingHorizontal: espaco.lg, paddingBottom: 100 }, largura]}>
          <EventosTabela
            eventos={eventos}
            ordem={ordem}
            onOrdem={mudarOrdem}
            onPress={(e) => router.push(`/evento/${e.id}`)}
            onLongPress={mudarStatus}
          />
          <Text style={[s.dica, { marginTop: espaco.sm }]}>
            {eventos.length} curso(s) · clique no título da coluna para ordenar
          </Text>
        </ScrollView>
      ) : (
      <FlatList
        data={eventos}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={[{ paddingHorizontal: espaco.lg, paddingBottom: 100 }, larguraMax]}
        renderItem={({ item }) => (
          <EventoCard
            evento={item}
            onPress={() => router.push(`/evento/${item.id}`)}
            onLongPress={() => mudarStatus(item)}
          />
        )}
        ListEmptyComponent={
          erro ? (
            <Vazio titulo="Não foi possível carregar" texto={erro} />
          ) : qtdFiltros || filtros.busca || filtros.periodo !== 'todos' ? (
            <Vazio titulo="Nada encontrado" texto="Ajuste os filtros." />
          ) : (
            <Vazio
              titulo="Nenhum curso ainda"
              texto={'Toque em + e cole um link, ou use "Compartilhar" no Instagram, YouTube ou navegador.'}
            />
          )
        }
      />
      )}

      <Pressable
        onPress={() => router.push('/novo')}
        style={{
          position: 'absolute',
          right: espaco.xl,
          bottom: espaco.xl,
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: cores.primaria,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 4,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 30, marginTop: -2 }}>+</Text>
      </Pressable>

      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#0006' }} onPress={() => setModal(false)} />
        <View
          style={{
            backgroundColor: cores.fundo,
            borderTopLeftRadius: raio.lg,
            borderTopRightRadius: raio.lg,
            maxHeight: '80%',
            width: '100%',
            maxWidth: 760,
            alignSelf: 'center',
            paddingBottom: insets.bottom + espaco.md,
          }}
        >
          <ScrollView contentContainerStyle={{ padding: espaco.lg }}>
            <Rotulo>Status</Rotulo>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: espaco.md }}>
              {STATUS_LIST.map((st) => (
                <Chip
                  key={st}
                  label={`${STATUS_INFO[st].emoji} ${STATUS_INFO[st].label}`}
                  cor={STATUS_INFO[st].cor}
                  ativo={filtros.status.includes(st)}
                  onPress={() => setFiltros({ ...filtros, status: toggle(filtros.status, st) })}
                />
              ))}
            </View>

            <Rotulo>Preço</Rotulo>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: espaco.md }}>
              {(['todos', 'gratuito', 'pago'] as const).map((p) => (
                <Chip
                  key={p}
                  label={p === 'todos' ? 'Todos' : p === 'gratuito' ? 'Gratuitos' : 'Pagos'}
                  ativo={filtros.preco === p}
                  onPress={() => setFiltros({ ...filtros, preco: p })}
                />
              ))}
            </View>

            <Rotulo>Categorias</Rotulo>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: espaco.md }}>
              {categorias.map((c) => (
                <Chip
                  key={c.id}
                  label={c.nome}
                  ativo={filtros.categorias.includes(c.id)}
                  onPress={() => setFiltros({ ...filtros, categorias: toggle(filtros.categorias, c.id) })}
                />
              ))}
            </View>

            <Rotulo>Tags</Rotulo>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: espaco.md }}>
              {tags.length === 0 ? (
                <Text style={s.dica}>Nenhuma tag ainda.</Text>
              ) : (
                tags.map((t) => (
                  <Chip
                    key={t.id}
                    label={`#${t.nome}`}
                    ativo={filtros.tags.includes(t.id)}
                    onPress={() => setFiltros({ ...filtros, tags: toggle(filtros.tags, t.id) })}
                  />
                ))
              )}
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Botao
                titulo="Limpar"
                variante="secundario"
                style={{ flex: 1 }}
                onPress={() => setFiltros({ ...filtrosPadrao, busca: filtros.busca, periodo: filtros.periodo, instagram: filtros.instagram })}
              />
              <Botao titulo="Aplicar" style={{ flex: 1 }} onPress={() => setModal(false)} />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
