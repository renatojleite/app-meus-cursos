/** Mostra os outros cursos ligados ao mesmo perfil do Instagram. */
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { eventosDoPerfil, normalizarInstagram } from '../db/repo';
import { formatarData } from '../format';
import { cores, espaco } from '../theme';
import { STATUS_INFO, type Evento } from '../types';
import { Card, Rotulo } from './ui';

export default function MesmoPerfil({
  instagram,
  excetoId,
  aviso,
  onCarregar,
}: {
  instagram: string | null | undefined;
  excetoId?: number;
  /** Texto extra no topo (ex.: na revisão de um curso novo). */
  aviso?: string;
  onCarregar?: (eventos: Evento[]) => void;
}) {
  const handle = normalizarInstagram(instagram);
  const [eventos, setEventos] = useState<Evento[]>([]);

  useEffect(() => {
    let ativo = true;
    const t = setTimeout(() => {
      eventosDoPerfil(handle, excetoId)
        .then((r) => {
          if (!ativo) return;
          setEventos(r);
          onCarregar?.(r);
        })
        .catch(() => ativo && setEventos([]));
    }, 400);
    return () => {
      ativo = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, excetoId]);

  if (!handle || eventos.length === 0) return null;

  const visiveis = eventos.slice(0, 5);
  return (
    <Card style={{ marginTop: espaco.md, borderColor: cores.primaria, borderWidth: 1 }}>
      <Rotulo>🔗 Mesmo perfil · @{handle}</Rotulo>
      {aviso ? <Text style={{ color: cores.texto, marginBottom: espaco.sm }}>{aviso}</Text> : null}
      {visiveis.map((e) => (
        <Pressable
          key={e.id}
          onPress={() => router.push(`/evento/${e.id}`)}
          style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: cores.borda }}
        >
          <Text style={{ color: cores.texto, fontWeight: '500' }} numberOfLines={1}>
            {STATUS_INFO[e.status].emoji} {e.titulo}
          </Text>
          <Text style={{ color: cores.textoSuave, fontSize: 12 }}>{formatarData(e.data_inicio, false)}</Text>
        </Pressable>
      ))}
      <Pressable
        onPress={() => router.push({ pathname: '/', params: { perfil: handle } })}
        style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: cores.borda }}
      >
        <Text style={{ color: cores.primaria, fontWeight: '600' }}>
          Ver todos os cursos de @{handle} ({eventos.length + (excetoId ? 1 : 0)}) →
        </Text>
      </Pressable>
    </Card>
  );
}

