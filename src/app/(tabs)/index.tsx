import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EventoCard from '../../components/EventoCard';
import { Botao, Chip, Rotulo, Vazio, s } from '../../components/ui';
import { atualizarStatus, listarCategorias, listarEventos, listarTags } from '../../db/repo';
import { syncEvento } from '../../services/calendar';
import { cores, espaco, raio } from '../../theme';
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
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [filtros, setFiltros] = useState<Filtros>(filtrosPadrao);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [modal, setModal] = useState(false);

  const carregar = useCallback(async () => {
    const [ev, cats, tg] = await Promise.all([listarEventos(db, filtros), listarCategorias(db), listarTags(db)]);
    setEventos(ev);
    setCategorias(cats);
    setTags(tg);
  }, [db, filtros]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  const qtdFiltros =
    filtros.status.length + filtros.categorias.length + filtros.tags.length + (filtros.preco !== 'todos' ? 1 : 0);

  const mudarStatus = (e: Evento) => {
    Alert.alert(
      'Mudar status',
      e.titulo,
      [
        ...STATUS_LIST.filter((st) => st !== e.status).map((st) => ({
          text: `${STATUS_INFO[st].emoji} ${STATUS_INFO[st].label}`,
          onPress: async () => {
            await atualizarStatus(db, e.id, st as Status);
            const r = await syncEvento(db, e.id);
            if (!r.ok) Alert.alert('Agenda', r.motivo);
            carregar();
          },
        })),
        { text: 'Cancelar', style: 'cancel' as const },
      ],
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: espaco.lg, paddingBottom: espaco.sm }}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: espaco.sm }}>
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="Buscar título, organizador, @..."
            placeholderTextColor={cores.textoSuave}
            value={filtros.busca}
            onChangeText={(busca) => setFiltros({ ...filtros, busca })}
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {PERIODOS.map((p) => (
            <Chip
              key={p.k}
              label={p.label}
              ativo={filtros.periodo === p.k}
              onPress={() => setFiltros({ ...filtros, periodo: p.k })}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={eventos}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={{ paddingHorizontal: espaco.lg, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <EventoCard
            evento={item}
            onPress={() => router.push(`/evento/${item.id}`)}
            onLongPress={() => mudarStatus(item)}
          />
        )}
        ListEmptyComponent={
          qtdFiltros || filtros.busca || filtros.periodo !== 'todos' ? (
            <Vazio titulo="Nada encontrado" texto="Ajuste os filtros." />
          ) : (
            <Vazio
              titulo="Nenhum curso ainda"
              texto={'Toque em + e cole um link, ou use "Compartilhar" no Instagram, YouTube ou navegador.'}
            />
          )
        }
      />

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
                onPress={() => setFiltros({ ...filtrosPadrao, busca: filtros.busca, periodo: filtros.periodo })}
              />
              <Botao titulo="Aplicar" style={{ flex: 1 }} onPress={() => setModal(false)} />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
