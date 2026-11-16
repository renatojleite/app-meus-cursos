import { Stack, router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
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
import { limparBase64 } from '../../lib/arquivo';
import { avisar, escolher } from '../../lib/dialogo';
import { AGENDA_DISPONIVEL, estaNaAgenda, removerDaAgenda, syncEvento } from '../../services/calendar';
import {
  aplicarResultado,
  rodarEnriquecimento,
  type ImagemEntrada,
} from '../../services/enriquecimento';
import { formatarData, formatarValor } from '../../format';
import { cores, espaco, larguraMax } from '../../theme';
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventoId = Number(id);
  const [evento, setEvento] = useState<Evento | null>(null);
  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState<EventoDraft | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [carregandoIA, setCarregandoIA] = useState<string | null>(null);
  const [viaIA, setViaIA] = useState(false);
  const [horaIncerta, setHoraIncerta] = useState(false);

  const [naAgenda, setNaAgenda] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const e = await obterEvento(eventoId);
      setEvento(e);
      if (e) setDraft(paraDraft(e));
      setNaAgenda(await estaNaAgenda(eventoId));
      setCategorias(await listarCategorias());
      setTags((await listarTags()).map((t) => t.nome));
    } catch (err) {
      avisar('Erro', err instanceof Error ? err.message : String(err));
    }
  }, [eventoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!evento || !draft) {
    return <View style={{ flex: 1 }} />;
  }

  if (carregandoIA) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: espaco.xl }}>
        <Stack.Screen options={{ title: 'Enriquecendo…', headerRight: () => null }} />
        <ActivityIndicator size="large" color={cores.primaria} />
        <Text style={{ marginTop: espaco.lg, color: cores.texto, fontSize: 16, textAlign: 'center' }}>{carregandoIA}</Text>
        <Text style={{ marginTop: 6, color: cores.textoSuave, textAlign: 'center' }}>Pode levar até um minuto.</Text>
      </View>
    );
  }

  const reenriquecer = async (imagem: ImagemEntrada | null) => {
    try {
      const { resultado, plataforma } = await rodarEnriquecimento({
        link: evento.link,
        imagem,
        categorias,
        onEtapa: setCarregandoIA,
      });
      setDraft(aplicarResultado(paraDraft(evento), resultado, categorias, plataforma, 'mesclar'));
      setHoraIncerta(resultado.hora_incerta);
      setViaIA(true);
      setEditando(true);
    } catch (e) {
      avisar('Não deu para enriquecer', e instanceof Error ? e.message : String(e));
    } finally {
      setCarregandoIA(null);
    }
  };

  const perguntarReenriquecer = () => {
    escolher(
      'Enriquecer novamente',
      'A IA busca os dados de novo pelo link. Você revisa antes de salvar; status e tags atuais são mantidos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Com print',
          onPress: async () => {
            const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.6 });
            if (r.canceled || !r.assets[0]) return;
            const a = r.assets[0];
            reenriquecer({ base64: limparBase64(a.base64), mime: a.mimeType || 'image/jpeg' });
          },
        },
        { text: 'Só o link', onPress: () => reenriquecer(null) },
      ],
    );
  };

  const cancelarEdicao = () => {
    setDraft(paraDraft(evento));
    setEditando(false);
    setViaIA(false);
    setHoraIncerta(false);
  };

  const mudarStatus = async (st: Status) => {
    await atualizarStatus(evento.id, st);
    const r = await syncEvento(evento.id);
    if (!r.ok) avisar('Agenda', r.motivo);
    carregar();
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      await salvarEvento(draft, evento.id);
      const r = await syncEvento(evento.id);
      if (!r.ok) avisar('Salvo, mas a agenda não atualizou', r.motivo);
      setEditando(false);
      setViaIA(false);
      setHoraIncerta(false);
      carregar();
    } catch (e) {
      avisar('Erro ao salvar', e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = () => {
    escolher('Excluir', 'Excluir este curso? Ele também sai da agenda do celular.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await excluirEvento(evento.id);
          await removerDaAgenda(evento.id);
          if (router.canGoBack()) router.back();
          else router.replace('/');
        },
      },
    ]);
  };

  const headerRight = () => (
    <Pressable onPress={() => (editando ? cancelarEdicao() : setEditando(true))}>
      <Text style={{ color: cores.primaria, fontWeight: '600', fontSize: 16 }}>{editando ? 'Cancelar' : 'Editar'}</Text>
    </Pressable>
  );

  return (
    <ScrollView contentContainerStyle={[{ padding: espaco.lg, paddingBottom: 60 }, larguraMax]} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: editando ? 'Editar' : 'Detalhe', headerRight }} />

      {editando ? (
        <>
          {viaIA ? (
            <Card style={{ marginBottom: espaco.lg, padding: espaco.md, backgroundColor: cores.primariaSuave }}>
              <Text style={{ color: cores.texto }}>
                ✨ Dados atualizados pela IA. Revise e toque em Salvar, ou em Cancelar para descartar.
              </Text>
            </Card>
          ) : null}
          <EventoForm
            draft={draft}
            horaIncerta={horaIncerta}
            onChange={setDraft}
            categorias={categorias}
            tagsExistentes={tags}
            onCriarCategoria={async (nome) => {
              const cid = await criarCategoria(nome);
              setCategorias(await listarCategorias());
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
          {naAgenda ? (
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
          <Botao
            titulo="✨ Enriquecer novamente com IA"
            variante="secundario"
            style={{ marginTop: espaco.sm }}
            onPress={perguntarReenriquecer}
          />
          {AGENDA_DISPONIVEL && evento.data_inicio && !naAgenda ? (
            <Botao
              titulo="Adicionar à agenda"
              variante="secundario"
              style={{ marginTop: espaco.sm }}
              onPress={async () => {
                const r = await syncEvento(evento.id);
                if (!r.ok) avisar('Agenda', r.motivo);
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
