import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import EventoCard from '../../components/EventoCard';
import { Vazio } from '../../components/ui';
import { eventosNoIntervalo } from '../../db/repo';
import { chaveDia } from '../../format';
import { cores, espaco, raio } from '../../theme';
import { STATUS_INFO, type Evento } from '../../types';

LocaleConfig.locales['pt-br'] = {
  monthNames: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
  monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  dayNames: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
  dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  today: 'Hoje',
};
LocaleConfig.defaultLocale = 'pt-br';

export default function Agenda() {
  const db = useSQLiteContext();
  const hoje = chaveDia(new Date());
  const [mes, setMes] = useState(() => {
    const d = new Date();
    return { ano: d.getFullYear(), mes: d.getMonth() };
  });
  const [selecionado, setSelecionado] = useState(hoje);
  const [eventos, setEventos] = useState<Evento[]>([]);

  const carregar = useCallback(async () => {
    // mês visível + margem para os dias de meses vizinhos exibidos
    const ini = new Date(mes.ano, mes.mes - 1, 20);
    const fim = new Date(mes.ano, mes.mes + 1, 12);
    setEventos(await eventosNoIntervalo(db, ini.toISOString(), fim.toISOString()));
  }, [db, mes]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  const porDia = useMemo(() => {
    const m = new Map<string, Evento[]>();
    for (const e of eventos) {
      const k = chaveDia(new Date(e.data_inicio!));
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return m;
  }, [eventos]);

  const marcados = useMemo(() => {
    const out: Record<string, any> = {};
    porDia.forEach((evs, k) => {
      out[k] = {
        dots: evs.slice(0, 4).map((e) => ({ key: String(e.id), color: STATUS_INFO[e.status].cor })),
      };
    });
    out[selecionado] = { ...(out[selecionado] ?? {}), selected: true, selectedColor: cores.primaria };
    return out;
  }, [porDia, selecionado]);

  const doDia = porDia.get(selecionado) ?? [];
  const [y, m, d] = selecionado.split('-').map(Number);
  const tituloDia = new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

  return (
    <ScrollView contentContainerStyle={{ padding: espaco.lg, paddingBottom: 40 }}>
      <View style={{ borderRadius: raio.lg, overflow: 'hidden', marginBottom: espaco.lg }}>
        <Calendar
          markingType="multi-dot"
          markedDates={marcados}
          onDayPress={(day) => setSelecionado(day.dateString)}
          onMonthChange={(mm) => setMes({ ano: mm.year, mes: mm.month - 1 })}
          firstDay={0}
          theme={{
            todayTextColor: cores.primaria,
            arrowColor: cores.primaria,
            selectedDayBackgroundColor: cores.primaria,
            textMonthFontWeight: '700',
          }}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: espaco.md }}>
        {Object.values(STATUS_INFO).map((st) => (
          <Text key={st.label} style={{ fontSize: 12, color: cores.textoSuave }}>
            <Text style={{ color: st.cor }}>●</Text> {st.label}
          </Text>
        ))}
      </View>

      <Text style={{ fontSize: 16, fontWeight: '700', color: cores.texto, marginBottom: espaco.sm, textTransform: 'capitalize' }}>
        {tituloDia}
      </Text>
      {doDia.length === 0 ? (
        <Vazio titulo="Nada neste dia" />
      ) : (
        doDia.map((e) => <EventoCard key={e.id} evento={e} onPress={() => router.push(`/evento/${e.id}`)} />)
      )}
    </ScrollView>
  );
}
