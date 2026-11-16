import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Pressable, ScrollView, Text, View } from 'react-native';
import EventoForm from '../components/EventoForm';
import { Botao, Campo, Card, Rotulo } from '../components/ui';
import { criarCategoria, listarCategorias, listarTags, salvarEvento } from '../db/repo';
import { syncEvento } from '../services/calendar';
import { lerBase64, limparBase64 } from '../lib/arquivo';
import { avisar, escolher } from '../lib/dialogo';
import { aplicarResultado, rodarEnriquecimento } from '../services/enriquecimento';
import { detectarPlataforma, extrairUrl } from '../services/link';
import { cores, espaco, larguraMax, raio } from '../theme';
import { draftVazio, type Categoria, type EventoDraft } from '../types';

type Imagem = { uri: string; base64: string | null; mime: string };

export default function Novo() {
  const params = useLocalSearchParams<{ link?: string; legenda?: string; imagem?: string; mime?: string; t?: string }>();

  const [link, setLink] = useState('');
  const [legenda, setLegenda] = useState('');
  const [imagem, setImagem] = useState<Imagem | null>(null);
  const [etapa, setEtapa] = useState<'captura' | 'revisao'>('captura');
  const [carregando, setCarregando] = useState<string | null>(null);
  const [draft, setDraft] = useState<EventoDraft>(draftVazio());
  const [horaIncerta, setHoraIncerta] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [tagsExistentes, setTagsExistentes] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    listarCategorias().then(setCategorias).catch(() => {});
    listarTags()
      .then((t) => setTagsExistentes(t.map((x) => x.nome)))
      .catch(() => {});
  }, []);

  // Conteúdo vindo do "Compartilhar"
  useEffect(() => {
    if (params.link) setLink(params.link);
    if (params.legenda) setLegenda(params.legenda);
    if (params.imagem) {
      lerBase64(params.imagem)
        .then(({ uri, base64 }) => setImagem({ uri, base64, mime: params.mime || 'image/jpeg' }))
        .catch(() => {}); // usuário pode anexar manualmente
    }
    setEtapa('captura');
  }, [params.t]); // eslint-disable-line react-hooks/exhaustive-deps

  const escolherPrint = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.6,
    });
    if (!r.canceled && r.assets[0]) {
      const a = r.assets[0];
      setImagem({ uri: a.uri, base64: limparBase64(a.base64), mime: a.mimeType || 'image/jpeg' });
    }
  };

  const linkLimpo = () => extrairUrl(link) ?? link.trim();

  const preencherManual = () => {
    const l = linkLimpo();
    setDraft({ ...draftVazio(l), plataforma: l ? detectarPlataforma(l) : '', descricao: legenda.trim() });
    setHoraIncerta(false);
    setEtapa('revisao');
  };

  const enriquecerIA = async () => {
    const l = linkLimpo();
    if (!l && !legenda.trim() && !imagem) {
      avisar('Falta conteúdo', 'Cole um link, uma legenda ou anexe um print.');
      return;
    }
    try {
      const { resultado, link: lk, plataforma } = await rodarEnriquecimento({
        link: l,
        legenda,
        imagem,
        categorias,
        onEtapa: setCarregando,
      });
      setDraft(aplicarResultado(draftVazio(lk), resultado, categorias, plataforma, 'novo'));
      setHoraIncerta(resultado.hora_incerta);
      setEtapa('revisao');
    } catch (e) {
      escolher('Não deu para enriquecer', e instanceof Error ? e.message : String(e), [
        { text: 'Tentar de novo', style: 'cancel' },
        { text: 'Preencher manualmente', onPress: preencherManual },
      ]);
    } finally {
      setCarregando(null);
    }
  };

  const salvar = async () => {
    if (!draft.titulo.trim()) {
      avisar('Título', 'Dê um título ao curso.');
      return;
    }
    setSalvando(true);
    try {
      const id = await salvarEvento(draft);
      const sync = await syncEvento(id);
      if (!sync.ok) avisar('Salvo, mas não foi para a agenda', sync.motivo);
      router.replace(`/evento/${id}`);
    } catch (e) {
      avisar('Erro ao salvar', e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: espaco.xl }}>
        <ActivityIndicator size="large" color={cores.primaria} />
        <Text style={{ marginTop: espaco.lg, color: cores.texto, fontSize: 16, textAlign: 'center' }}>{carregando}</Text>
        <Text style={{ marginTop: 6, color: cores.textoSuave, textAlign: 'center' }}>
          Pode levar até um minuto.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="height">
      <ScrollView contentContainerStyle={[{ padding: espaco.lg, paddingBottom: 60 }, larguraMax]} keyboardShouldPersistTaps="handled">
        {etapa === 'captura' ? (
          <>
            <Campo
              rotulo="Link"
              placeholder="https://..."
              value={link}
              onChangeText={setLink}
              autoCapitalize="none"
              keyboardType="url"
              dica="Instagram, YouTube, Sympla, Hotmart, site do evento…"
            />
            <Campo
              rotulo="Legenda ou texto (opcional)"
              placeholder="Cole a legenda do post — ajuda muito no Instagram"
              value={legenda}
              onChangeText={setLegenda}
              multiline
            />
            <Rotulo>Print (opcional)</Rotulo>
            {imagem ? (
              <View style={{ marginBottom: espaco.md }}>
                <Image source={{ uri: imagem.uri }} style={{ width: '100%', height: 220, borderRadius: raio.md }} resizeMode="contain" />
                <Pressable onPress={() => setImagem(null)} style={{ marginTop: 6 }}>
                  <Text style={{ color: cores.perigo }}>Remover print</Text>
                </Pressable>
              </View>
            ) : (
              <Botao titulo="Anexar print da galeria" variante="secundario" onPress={escolherPrint} style={{ marginBottom: espaco.md }} />
            )}

            <Botao titulo="✨ Enriquecer com IA" onPress={enriquecerIA} style={{ marginTop: espaco.sm }} />
            <Botao titulo="Preencher manualmente" variante="texto" onPress={preencherManual} />
          </>
        ) : (
          <>
            <Card style={{ marginBottom: espaco.lg, padding: espaco.md, backgroundColor: cores.primariaSuave }}>
              <Text style={{ color: cores.texto }}>Confira os dados antes de salvar.</Text>
              <Pressable onPress={() => setEtapa('captura')}>
                <Text style={{ color: cores.primaria, marginTop: 4, fontWeight: '600' }}>← Voltar e refazer</Text>
              </Pressable>
            </Card>
            <EventoForm
              draft={draft}
              onChange={setDraft}
              categorias={categorias}
              tagsExistentes={tagsExistentes}
              horaIncerta={horaIncerta}
              onCriarCategoria={async (nome) => {
                const id = await criarCategoria(nome);
                setCategorias(await listarCategorias());
                return id;
              }}
            />
            <Botao titulo="Salvar" onPress={salvar} carregando={salvando} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
