import { Tabs } from 'expo-router/tabs';
import React from 'react';
import { Text } from 'react-native';
import { cores } from '../../theme';

const icone = (emoji: string) =>
  function Icone({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: cores.fundo },
        headerShadowVisible: false,
        headerTintColor: cores.texto,
        tabBarActiveTintColor: cores.primaria,
        tabBarStyle: { backgroundColor: cores.card },
        sceneStyle: { backgroundColor: cores.fundo },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Meus cursos', tabBarLabel: 'Lista', tabBarIcon: icone('📚') }} />
      <Tabs.Screen name="agenda" options={{ title: 'Agenda', tabBarIcon: icone('🗓️') }} />
      <Tabs.Screen name="config" options={{ title: 'Configurações', tabBarLabel: 'Config', tabBarIcon: icone('⚙️') }} />
    </Tabs>
  );
}
