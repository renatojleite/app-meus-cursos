import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Botao, Campo, Card, Rotulo, s } from '../../components/ui';
import {
  criarCategoria,
  excluirCategoria,
  excluirTag,
  listarCategorias,
  listarTags,
  renomearCategoria,
  renomearTag,
} from '../../db/repo';
import { listarCalendarios, ressincronizarTudo, type CalendarioInfo } from '../../services/calendar';
import {
  MODELO_PADRAO,
  getApiKey,
  getCalendarId,
  getModelo,
  getSyncAgenda,
  setApiKey,
  setCalendarId,
  setModelo,
  setSyncAgenda,
} from '../../services/settings';
import { cores, espaco, raio } from '../../theme';
import type { Categoria, Tag } from '../../types';

type Edicao = { tipo: 'categoria' | 'tag'; id: number | null; nome: string } | null;

export default function Config() {
  const db = useSQLiteContext();
  const [temChave, setTemChave] = useState(false);
  const [chave, setChave] = useState('');
  const [modelo, setModeloState] = useState(MODELO_PADRAO);
  const [calendarios, setCalendarios] = useState<CalendarioInfo[]>([]);
  const [calId, setCalId] = useState<string | null>(null);
  const [sync, setSync] = useState(true);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [tags, setTags] = useState<(Tag & { total: number })[]>([]);
  const [edicao, setEdicao] = useState<Edicao>(null);
  const [ressincronizando, setRessincronizando] = useState(false);

  const carregar = useCallback(async () => {
    setTemChave(!!(await getApiKey()));
    setModeloState(await getModelo(db));
    setCalId(await getCalendarId(db));
    setSync(await getSyncAgenda(db));
    setCategorias(await listarCategorias(db));
    setTags(await listarTags(db));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  const carregarCalendarios = async () => {
    const cals = await listarCalendarios();
    if (!cals.length) Alert.alert('Agenda', 'Permita o acesso à agenda para escolher um calendário.');
    setCalendarios(cals);
  };

  const salvarEdicao = async () => {
    if (!edicao || !edicao.nome.trim()) return;
    try {
      if (edicao.tipo === 'categoria') {
        if (edicao.id) await renomearCategoria(db, edicao.id, edicao.nome);
        else await criarCategoria(db, edicao.nome);
      } else if (edicao.id) {
        await renomearTag(db, edicao.id, edicao.nome);
      }
      setEdicao(null);
      carregar();
    } catch {
      Alert.alert('Erro', 'Já existe um item com esse nome.');
    }
  };

  const excluirEdicao = () => {
    if (!edicao?.id) return;
    Alert.alert('Excluir', `Excluir "${edicao.nome}"? Os eventos não são apagados.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          if (edicao.tipo === 'categoria') await excluirCategoria(db, edicao.id!);
          else await excluirTag(db, edicao.id!);
          setEdicao(null);
          carregar();
        },
      },
    ]);
  };

  const calAtual = calendarios.find((c) => c.id === calId);

  return (
    <ScrollView contentContainerStyle={{ padding: espaco.lg, paddingBottom: 60, gap: espaco.lg }}>
      <Card>
        <Text style={titulo}>IA (Claude)</Text>
        <Campo
          rotulo="Chave da API"
          placeholder={temChave ? '•••••••• (salva)' : 'sk-ant-...'}
          value={chave}
          onChangeText={setChave}
          autoCapitalize="none"
          secureTextEntry
          dica="Fica guardada só neste aparelho (armazenamento seguro). Web search precisa estar habilitado no Console."
        />
        <Campo
          rotulo="Modelo"
          value={modelo}
          onChangeText={setModeloState}
          autoCapitalize="none"
          dica={`Padrão: ${MODELO_PADRAO}`}
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Botao
            titulo="Salvar"
            style={{ flex: 1 }}
            onPress={async () => {
              if (chave.trim()) await setApiKey(chave);
              await setModelo(db, modelo);
              setChave('');
              await carregar();
              Alert.alert('Pronto', 'Configurações da IA salvas.');
            }}
          />
          {temChave && (
            <Botao
              titulo="Remover chave"
              variante="secundario"
              style={{ flex: 1 }}
              onPress={async () => {
                await setApiKey(null);
                carregar();
              }}
            />
          )}
        </View>
      </Card>

      <Card>
        <Text style={titulo}>Agenda do celular</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: espaco.md }}>
          <Text style={{ color: cores.texto, flex: 1 }}>Sincronizar eventos com a agenda</Text>
          <Switch
            value={sync}
            onValueChange={async (v) => {
              setSync(v);
              await setSyncAgenda(db, v);
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
                await setCalendarId(db, c.id);
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
          Escolha o calendário da sua conta Google para sincronizar com o Google Agenda.
        </Text>
        <Botao
          titulo="Ressincronizar tudo"
          variante="texto"
          carregando={ressincronizando}
          onPress={async () => {
            setRessincronizando(true);
            const r = await ressincronizarTudo(db);
            setRessincronizando(false);
            Alert.alert('Agenda', `${r.ok} de ${r.total} eventos sincronizados${r.falhas ? `, ${r.falhas} falhas` : ''}.`);
          }}
        />
      </Card>

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
          <Text style={s.dica}>As tags aparecem aqui conforme você salva eventos.</Text>
        ) : (
          tags.map((t) => (
            <Pressable key={t.id} onPress={() => setEdicao({ tipo: 'tag', id: t.id, nome: t.nome })} style={linha}>
              <Text style={{ color: cores.texto }}>#{t.nome}</Text>
              <Text style={s.dica}>{t.total} evento(s)</Text>
            </Pressable>
          ))
        )}
      </Card>

      <Modal visible={!!edicao} transparent animationType="fade" onRequestClose={() => setEdicao(null)}>
        <View style={{ flex: 1, backgroundColor: '#0006', justifyContent: 'center', padding: espaco.xl }}>
          <Card>
            <Text style={titulo}>
              {edicao?.id ? 'Editar' : 'Nova'} {edicao?.tipo === 'tag' ? 'tag' : 'categoria'}
            </Text>
            <TextInput
              style={[s.input, { marginBottom: espaco.md }]}
              autoFocus
              value={edicao?.nome ?? ''}
              onChangeText={(nome) => edicao && setEdicao({ ...edicao, nome })}
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
