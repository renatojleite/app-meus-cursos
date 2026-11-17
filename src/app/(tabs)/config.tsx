import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { VersaoApp } from '../../components/Atualizacao';
import { Botao, Card, Rotulo, s } from '../../components/ui';
import {
  criarCategoria,
  excluirCategoria,
  excluirTag,
  listarCategorias,
  listarTags,
  renomearCategoria,
  renomearTag,
} from '../../db/repo';
import { avisar, escolher } from '../../lib/dialogo';
import { getCalendarId, getSyncAgenda, setCalendarId, setSyncAgenda } from '../../lib/local';
import { useSessao } from '../../lib/sessao';
import { supabase } from '../../lib/supabase';
import {
  AGENDA_DISPONIVEL,
  listarCalendarios,
  sincronizarAgenda,
  type CalendarioInfo,
} from '../../services/calendar';
import { cores, espaco, larguraMax, raio } from '../../theme';
import type { Categoria, Tag } from '../../types';

type Edicao = { tipo: 'categoria' | 'tag'; id: number | null; nome: string } | null;

export default function Config() {
  const { session } = useSessao();
  const [calendarios, setCalendarios] = useState<CalendarioInfo[]>([]);
  const [calId, setCalId] = useState<string | null>(null);
  const [sync, setSync] = useState(true);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [tags, setTags] = useState<(Tag & { total: number })[]>([]);
  const [edicao, setEdicao] = useState<Edicao>(null);
  const [ressincronizando, setRessincronizando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setCalId(await getCalendarId());
      setSync(await getSyncAgenda());
      setCategorias(await listarCategorias());
      setTags(await listarTags());
    } catch (e) {
      avisar('Erro', e instanceof Error ? e.message : String(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  const carregarCalendarios = async () => {
    const cals = await listarCalendarios();
    if (!cals.length) avisar('Agenda', 'Permita o acesso à agenda para escolher um calendário.');
    setCalendarios(cals);
  };

  const salvarEdicao = async () => {
    if (!edicao || !edicao.nome.trim()) return;
    try {
      if (edicao.tipo === 'categoria') {
        if (edicao.id) await renomearCategoria(edicao.id, edicao.nome);
        else await criarCategoria(edicao.nome);
      } else if (edicao.id) {
        await renomearTag(edicao.id, edicao.nome);
      }
      setEdicao(null);
      carregar();
    } catch {
      avisar('Erro', 'Já existe um item com esse nome.');
    }
  };

  const excluirEdicao = () => {
    if (!edicao?.id) return;
    const alvo = edicao;
    setEdicao(null);
    escolher('Excluir', `Excluir "${alvo.nome}"? Os cursos não são apagados.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          if (alvo.tipo === 'categoria') await excluirCategoria(alvo.id!);
          else await excluirTag(alvo.id!);
          carregar();
        },
      },
    ]);
  };

  const sair = () =>
    escolher('Sair', 'Sair da sua conta neste aparelho?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);

  const calAtual = calendarios.find((c) => c.id === calId);

  return (
    <ScrollView contentContainerStyle={[{ padding: espaco.lg, paddingBottom: 60, gap: espaco.lg }, larguraMax]}>
      <Card>
        <Text style={titulo}>Conta</Text>
        <Text style={{ color: cores.texto, marginBottom: espaco.md }}>{session?.user.email}</Text>
        <Text style={[s.dica, { marginBottom: espaco.md }]}>
          Seus cursos ficam na nuvem: acesse pelo celular ou pelo navegador do PC com este mesmo login.
        </Text>
        <Botao titulo="Sair" variante="secundario" onPress={sair} />
      </Card>

      <Card>
        <Text style={titulo}>Versão do app</Text>
        <VersaoApp />
      </Card>

      {AGENDA_DISPONIVEL ? (
        <Card>
          <Text style={titulo}>Agenda do celular</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: espaco.md }}>
            <Text style={{ color: cores.texto, flex: 1 }}>Sincronizar cursos com a agenda</Text>
            <Switch
              value={sync}
              onValueChange={async (v) => {
                setSync(v);
                await setSyncAgenda(v);
              }}
            />
          </View>

          <Rotulo>Calendário de destino</Rotulo>
          <Text style={{ color: cores.texto, marginBottom: espaco.sm }}>
            {calAtual ? `${calAtual.titulo} · ${calAtual.conta}` : calId ? 'Calendário selecionado' : 'Nenhum escolhido'}
          </Text>
          {calendarios.length === 0 ? (
            <Botao titulo="Escolher calendário" variante="secundario" onPress={carregarCalendarios} />
          ) : (
            calendarios.map((c) => (
              <Pressable
                key={c.id}
                onPress={async () => {
                  setCalId(c.id);
                  await setCalendarId(c.id);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: espaco.sm,
                  borderRadius: raio.sm,
                  backgroundColor: c.id === calId ? cores.primariaSuave : 'transparent',
                }}
              >
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.cor, marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: cores.texto, fontWeight: '500' }}>{c.titulo}</Text>
                  <Text style={s.dica}>{c.conta}</Text>
                </View>
                {c.id === calId && <Text style={{ color: cores.primaria }}>✓</Text>}
              </Pressable>
            ))
          )}
          <Text style={[s.dica, { marginTop: espaco.sm }]}>
            Escolha o calendário da sua conta Google para sincronizar com o Google Agenda. Mudanças feitas no PC
            chegam à agenda quando você abre o app no celular.
          </Text>
          <Botao
            titulo="Ressincronizar tudo"
            variante="texto"
            carregando={ressincronizando}
            onPress={async () => {
              setRessincronizando(true);
              const r = await sincronizarAgenda(true);
              setRessincronizando(false);
              if (!r) avisar('Agenda', 'Ligue a sincronização e escolha um calendário.');
              else avisar('Agenda', `${r.ok} de ${r.total} cursos sincronizados${r.falhas ? `, ${r.falhas} falhas` : ''}.`);
            }}
          />
        </Card>
      ) : (
        <Card>
          <Text style={titulo}>Agenda</Text>
          <Text style={s.dica}>
            Os cursos com data entram na agenda do Google pelo app do celular. O que você editar aqui é aplicado
            na agenda quando abrir o app no celular.
          </Text>
        </Card>
      )}

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={titulo}>Categorias</Text>
          <Pressable onPress={() => setEdicao({ tipo: 'categoria', id: null, nome: '' })}>
            <Text style={{ color: cores.primaria, fontWeight: '600' }}>+ Nova</Text>
          </Pressable>
        </View>
        {categorias.map((c) => (
          <Pressable key={c.id} onPress={() => setEdicao({ tipo: 'categoria', id: c.id, nome: c.nome })} style={linha}>
            <Text style={{ color: cores.texto }}>{c.nome}</Text>
            <Text style={s.dica}>editar</Text>
          </Pressable>
        ))}
      </Card>

      <Card>
        <Text style={titulo}>Tags</Text>
        {tags.length === 0 ? (
          <Text style={s.dica}>As tags aparecem aqui conforme você salva cursos.</Text>
        ) : (
          tags.map((t) => (
            <Pressable key={t.id} onPress={() => setEdicao({ tipo: 'tag', id: t.id, nome: t.nome })} style={linha}>
              <Text style={{ color: cores.texto }}>#{t.nome}</Text>
              <Text style={s.dica}>{t.total} curso(s)</Text>
            </Pressable>
          ))
        )}
      </Card>

      <Modal visible={!!edicao} transparent animationType="fade" onRequestClose={() => setEdicao(null)}>
        <View style={{ flex: 1, backgroundColor: '#0006', justifyContent: 'center', alignItems: 'center', padding: espaco.xl }}>
          <Card style={{ width: '100%', maxWidth: 420 }}>
            <Text style={titulo}>
              {edicao?.id ? 'Editar' : 'Nova'} {edicao?.tipo === 'tag' ? 'tag' : 'categoria'}
            </Text>
            <TextInput
              style={[s.input, { marginBottom: espaco.md }]}
              autoFocus
              value={edicao?.nome ?? ''}
              onChangeText={(nome) => edicao && setEdicao({ ...edicao, nome })}
              onSubmitEditing={salvarEdicao}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {edicao?.id ? (
                <Botao titulo="Excluir" variante="perigo" style={{ flex: 1 }} onPress={excluirEdicao} />
              ) : null}
              <Botao titulo="Cancelar" variante="secundario" style={{ flex: 1 }} onPress={() => setEdicao(null)} />
              <Botao titulo="Salvar" style={{ flex: 1 }} onPress={salvarEdicao} />
            </View>
          </Card>
        </View>
      </Modal>
    </ScrollView>
  );
}

const titulo = { fontSize: 17, fontWeight: '700' as const, color: cores.texto, marginBottom: espaco.md };
const linha = {
  flexDirection: 'row' as const,
  justifyContent: 'space-between' as const,
  paddingVertical: 10,
  borderBottomWidth: 1,
  borderBottomColor: cores.borda,
};
