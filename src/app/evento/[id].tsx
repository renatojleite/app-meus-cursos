import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import EventoForm from '../../components/EventoForm';
import { Botao, Card, Chip, Rotulo } from '../../components/ui';
import {
  atualizarStatus,
  criarCategoria,
  excluirEvento,
  listarCategorias,
  listarTags,
  obterEvento,
  salvarEvento,
} from '../../db/repo';
import { removerDaAgenda, syncEvento } from '../../services/calendar';
import { formatarData, formatarValor } from '../../format';
import { cores, espaco } from '../../theme';
import { STATUS_INFO, STATUS_LIST, type Categoria, type Evento, type EventoDraft, type Status } from '../../types';

function paraDraft(e: Evento): EventoDraft {
  return {
    link: e.link,
    titulo: e.titulo,
    descricao: e.descricao ?? '',
    organizador: e.organizador ?? '',
    instagram: e.instagram ?? '',
    analise_perfil: e.analise_perfil ?? '',
    plataforma: e.plataforma ?? '',
    formato: e.formato,
    local: e.local ?? '',
    categoria_id: e.categoria_id,
    categoria_sugerida: null,
    status: e.status,
    gratuito: e.gratuito,
    valor: e.valor,
    data_inicio: e.data_inicio,
    data_fim: e.data_fim,
    tags: e.tags ?? [],
  };
}

export default function Detalhe() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventoId = Number(id);
  const [evento, setEvento] = useState<Evento | null>(null);
  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState<EventoDraft | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const e = await obterEvento(db, eventoId);
    setEvento(e);
    if (e) setDraft(paraDraft(e));
    setCategorias(await listarCategorias(db));
    setTags((await listarTags(db)).map((t) => t.nome));
  }, [db, eventoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!evento || !draft) {
    return <View style={{ flex: 1 }} />;
  }

  const mudarStatus = async (st: Status) => {
    await atualizarStatus(db, evento.id, st);
    const r = await syncEvento(db, evento.id);
    if (!r.ok) Alert.alert('Agenda', r.motivo);
    carregar();
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      await salvarEvento(db, draft, evento.id);
      const r = await syncEvento(db, evento.id);
      if (!r.ok) Alert.alert('Salvo, mas a agenda não atualizou', r.motivo);
      setEditando(false);
      carregar();
    } finally {
      setSalvando(false);
    }
  };

  const excluir = () => {
    Alert.alert('Excluir', 'Excluir este evento? Ele também sai da agenda do celular.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await removerDaAgenda(evento.calendar_event_id);
          await excluirEvento(db, evento.id);
          router.back();
        },
      },
    ]);
  };

  const headerRight = () => (
    <Pressable onPress={() => (editando ? (setDraft(paraDraft(evento)), setEditando(false)) : setEditando(true))}>
      <Text style={{ color: cores.primaria, fontWeight: '600', fontSize: 16 }}>{editando ? 'Cancelar' : 'Editar'}</Text>
    </Pressable>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: espaco.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: editando ? 'Editar' : 'Detalhe', headerRight }} />

      {editando ? (
        <>
          <EventoForm
            draft={draft}
            onChange={setDraft}
            categorias={categorias}
            tagsExistentes={tags}
            onCriarCategoria={async (nome) => {
              const cid = await criarCategoria(db, nome);
              setCategorias(await listarCategorias(db));
              return cid;
            }}
          />
          <Botao titulo="Salvar alterações" onPress={salvar} carregando={salvando} />
        </>
      ) : (
        <>
          <Text style={{ fontSize: 22, fontWeight: '700', color: cores.texto }}>{evento.titulo}</Text>
          <Text style={{ color: cores.textoSuave, marginTop: 4 }}>
            {formatarData(evento.data_inicio)}
            {evento.data_fim ? ` → ${formatarData(evento.data_fim)}` : ''}
          </Text>
          {evento.calendar_event_id ? (
            <Text style={{ color: cores.sucesso, fontSize: 12, marginTop: 4 }}>📅 Na agenda · lembrete 1h antes</Text>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: espaco.lg }}>
            {STATUS_LIST.map((st) => (
              <Chip
                key={st}
                label={`${STATUS_INFO[st].emoji} ${STATUS_INFO[st].label}`}
                cor={STATUS_INFO[st].cor}
                ativo={evento.status === st}
                onPress={() => evento.status !== st && mudarStatus(st)}
              />
            ))}
          </View>

          <Card style={{ marginTop: espaco.md, gap: 10 }}>
            <Info rotulo="Categoria" valor={evento.categoria_nome} />
            <Info rotulo="Preço" valor={formatarValor(evento.gratuito, evento.valor)} />
            <Info rotulo="Organizador" valor={evento.organizador} />
            <Info rotulo="Plataforma" valor={evento.plataforma} />
            <Info
              rotulo="Formato"
              valor={evento.formato ? `${evento.formato}${evento.local ? ` · ${evento.local}` : ''}` : null}
            />
            {evento.tags?.length ? <Info rotulo="Tags" valor={evento.tags.map((t) => `#${t}`).join('  ')} /> : null}
          </Card>

          {evento.descricao ? (
            <Card style={{ marginTop: espaco.md }}>
              <Rotulo>Descrição</Rotulo>
              <Text style={{ color: cores.texto, lineHeight: 21 }}>{evento.descricao}</Text>
            </Card>
          ) : null}

          {evento.instagram || evento.analise_perfil ? (
            <Card style={{ marginTop: espaco.md }}>
              <Rotulo>Perfil {evento.instagram ? `@${evento.instagram}` : ''}</Rotulo>
              {evento.analise_perfil ? (
                <Text style={{ color: cores.texto, lineHeight: 21 }}>{evento.analise_perfil}</Text>
              ) : null}
              {evento.instagram ? (
                <Botao
                  titulo="Abrir no Instagram"
                  variante="secundario"
                  style={{ marginTop: espaco.md }}
                  onPress={() => Linking.openURL(`https://instagram.com/${evento.instagram}`)}
                />
              ) : null}
            </Card>
          ) : null}

          <Botao titulo="Abrir link" style={{ marginTop: espaco.lg }} onPress={() => Linking.openURL(evento.link)} />
          {evento.data_inicio && !evento.calendar_event_id ? (
            <Botao
              titulo="Adicionar à agenda"
              variante="secundario"
              style={{ marginTop: espaco.sm }}
              onPress={async () => {
                const r = await syncEvento(db, evento.id);
                if (!r.ok) Alert.alert('Agenda', r.motivo);
                carregar();
              }}
            />
          ) : null}
          <Botao titulo="Excluir" variante="texto" style={{ marginTop: espaco.sm }} onPress={excluir} />
        </>
      )}
    </ScrollView>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  if (!valor) return null;
  return (
    <View style={{ flexDirection: 'row' }}>
      <Text style={{ width: 100, color: cores.textoSuave, fontSize: 13 }}>{rotulo}</Text>
      <Text style={{ flex: 1, color: cores.texto, fontSize: 14 }}>{valor}</Text>
    </View>
  );
}
