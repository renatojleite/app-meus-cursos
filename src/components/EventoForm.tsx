import React, { useState } from 'react';
import { Linking, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { cores, espaco } from '../theme';
import DataHora from './DataHora';
import { STATUS_INFO, STATUS_LIST, type Categoria, type EventoDraft, type Formato } from '../types';
import { Botao, Campo, Card, Chip, Rotulo, s } from './ui';

interface Props {
  draft: EventoDraft;
  onChange: (d: EventoDraft) => void;
  categorias: Categoria[];
  tagsExistentes: string[];
  onCriarCategoria: (nome: string) => Promise<number>;
  horaIncerta?: boolean;
}

export default function EventoForm({
  draft,
  onChange,
  categorias,
  tagsExistentes,
  onCriarCategoria,
  horaIncerta,
}: Props) {
  const [novaTag, setNovaTag] = useState('');
  const set = <K extends keyof EventoDraft>(k: K, v: EventoDraft[K]) => onChange({ ...draft, [k]: v });

  const addTag = (t: string) => {
    const n = t.trim().toLowerCase().replace(/^#/, '');
    if (!n || draft.tags.includes(n)) return;
    onChange({ ...draft, tags: [...draft.tags, n] });
    setNovaTag('');
  };

  const sugestoesTag = tagsExistentes
    .filter((t) => !draft.tags.includes(t) && (!novaTag || t.includes(novaTag.toLowerCase())))
    .slice(0, 10);

  return (
    <View>
      <Campo rotulo="Título" value={draft.titulo} onChangeText={(v) => set('titulo', v)} />

      <Rotulo>Status</Rotulo>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: espaco.md }}>
        {STATUS_LIST.map((st) => (
          <Chip
            key={st}
            label={`${STATUS_INFO[st].emoji} ${STATUS_INFO[st].label}`}
            ativo={draft.status === st}
            cor={STATUS_INFO[st].cor}
            onPress={() => set('status', st)}
          />
        ))}
      </View>

      <Rotulo>Data e hora</Rotulo>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
        <DataHora valor={draft.data_inicio} placeholder="Início" onChange={(iso) => set('data_inicio', iso)} />
        <DataHora
          valor={draft.data_fim}
          sugestao={draft.data_inicio}
          placeholder="Fim (opcional)"
          onChange={(iso) => set('data_fim', iso)}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: espaco.md }}>
        <Text style={s.dica}>
          {horaIncerta && draft.data_inicio ? '⚠️ Horário não encontrado — confira.' : draft.data_inicio ? 'Vai para a agenda do celular com lembrete 1h antes.' : 'Sem data não vai para a agenda.'}
        </Text>
        {(draft.data_inicio || draft.data_fim) && (
          <Pressable onPress={() => onChange({ ...draft, data_inicio: null, data_fim: null })}>
            <Text style={{ color: cores.perigo, fontSize: 12 }}>Limpar</Text>
          </Pressable>
        )}
      </View>

      <Rotulo>Categoria</Rotulo>
      {draft.categoria_sugerida ? (
        <Card style={{ marginBottom: espaco.sm, padding: espaco.md, backgroundColor: cores.primariaSuave }}>
          <Text style={{ color: cores.texto, marginBottom: 8 }}>
            A IA sugeriu uma categoria nova: <Text style={{ fontWeight: '700' }}>{draft.categoria_sugerida}</Text>
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Botao
              titulo="Criar"
              style={{ flex: 1, paddingVertical: 9 }}
              onPress={async () => {
                const id = await onCriarCategoria(draft.categoria_sugerida!);
                onChange({ ...draft, categoria_id: id, categoria_sugerida: null });
              }}
            />
            <Botao
              titulo="Ignorar"
              variante="secundario"
              style={{ flex: 1, paddingVertical: 9 }}
              onPress={() => set('categoria_sugerida', null)}
            />
          </View>
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: espaco.md }}>
        {categorias.map((c) => (
          <Chip
            key={c.id}
            label={c.nome}
            ativo={draft.categoria_id === c.id}
            onPress={() => set('categoria_id', draft.categoria_id === c.id ? null : c.id)}
          />
        ))}
      </View>

      <Rotulo>Tags</Rotulo>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {draft.tags.map((t) => (
          <Chip key={t} label={`#${t}  ✕`} ativo onPress={() => set('tags', draft.tags.filter((x) => x !== t))} />
        ))}
      </View>
      <TextInput
        style={[s.input, { marginBottom: 6 }]}
        placeholder="Adicionar tag e Enter"
        placeholderTextColor={cores.textoSuave}
        value={novaTag}
        onChangeText={setNovaTag}
        autoCapitalize="none"
        onSubmitEditing={() => addTag(novaTag)}
        submitBehavior="submit"
      />
      {sugestoesTag.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: espaco.sm }}>
          {sugestoesTag.map((t) => (
            <Chip key={t} pequeno label={`+ ${t}`} onPress={() => addTag(t)} />
          ))}
        </View>
      )}
      <View style={{ height: espaco.md }} />

      <Rotulo>Preço</Rotulo>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: espaco.md, gap: 10 }}>
        <Switch value={draft.gratuito} onValueChange={(v) => set('gratuito', v)} />
        <Text style={{ color: cores.texto }}>{draft.gratuito ? 'Gratuito' : 'Pago'}</Text>
        {!draft.gratuito && (
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="Valor (R$)"
            placeholderTextColor={cores.textoSuave}
            keyboardType="decimal-pad"
            value={draft.valor != null ? String(draft.valor).replace('.', ',') : ''}
            onChangeText={(v) => {
              const n = parseFloat(v.replace(/\./g, '').replace(',', '.'));
              set('valor', isNaN(n) ? null : n);
            }}
          />
        )}
      </View>

      <Campo rotulo="Organizador / instrutor" value={draft.organizador} onChangeText={(v) => set('organizador', v)} />

      <Rotulo>Instagram</Rotulo>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: espaco.md }}>
        <TextInput
          style={[s.input, { flex: 1 }]}
          placeholder="@perfil"
          placeholderTextColor={cores.textoSuave}
          autoCapitalize="none"
          value={draft.instagram}
          onChangeText={(v) => set('instagram', v)}
        />
        {draft.instagram ? (
          <Botao
            titulo="Abrir"
            variante="secundario"
            style={{ paddingVertical: 10 }}
            onPress={() => Linking.openURL(`https://instagram.com/${draft.instagram.replace(/^@/, '')}`)}
          />
        ) : null}
      </View>

      <Campo
        rotulo="Análise do perfil"
        multiline
        value={draft.analise_perfil}
        onChangeText={(v) => set('analise_perfil', v)}
      />
      <Campo rotulo="Descrição" multiline value={draft.descricao} onChangeText={(v) => set('descricao', v)} />

      <Rotulo>Formato</Rotulo>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: espaco.md }}>
        {(['online', 'presencial', 'hibrido'] as Formato[]).map((f) => (
          <Chip
            key={f}
            label={f === 'hibrido' ? 'Híbrido' : f[0].toUpperCase() + f.slice(1)}
            ativo={draft.formato === f}
            onPress={() => set('formato', draft.formato === f ? null : f)}
          />
        ))}
      </View>
      {draft.formato && draft.formato !== 'online' ? (
        <Campo rotulo="Local" value={draft.local} onChangeText={(v) => set('local', v)} />
      ) : null}

      <Campo rotulo="Plataforma" value={draft.plataforma} onChangeText={(v) => set('plataforma', v)} />
      <Campo rotulo="Link" value={draft.link} autoCapitalize="none" onChangeText={(v) => set('link', v)} />
    </View>
  );
}
