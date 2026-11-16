import React, { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, View } from 'react-native';
import { Botao, Campo, Card } from '../components/ui';
import { avisar } from '../lib/dialogo';
import { supabase } from '../lib/supabase';
import { cores, espaco } from '../theme';

export default function Login() {
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);

  const enviar = async () => {
    if (!email.trim() || senha.length < 6) {
      avisar('Confira os dados', 'Informe o e-mail e uma senha com pelo menos 6 caracteres.');
      return;
    }
    setCarregando(true);
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) {
          avisar(
            'Não foi possível entrar',
            /confirm/i.test(error.message)
              ? 'Confirme seu e-mail pelo link que enviamos e tente de novo.'
              : 'E-mail ou senha incorretos.',
          );
        }
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: senha });
        if (error) avisar('Não foi possível criar a conta', error.message);
        else if (!data.session) {
          avisar(
            'Confirme seu e-mail',
            'Enviamos um link de confirmação. Toque nele (pode abrir uma página de erro, tudo bem) e depois volte aqui para entrar.',
          );
          setModo('entrar');
        }
      }
    } finally {
      setCarregando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: cores.fundo }} behavior="height">
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: espaco.xl }}>
        <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center' }}>
          <Text style={{ fontSize: 40, textAlign: 'center' }}>📚</Text>
          <Text style={{ fontSize: 26, fontWeight: '800', color: cores.texto, textAlign: 'center', marginTop: 8 }}>
            Meus Cursos
          </Text>
          <Text style={{ color: cores.textoSuave, textAlign: 'center', marginTop: 4, marginBottom: espaco.xl }}>
            Seus cursos, lives e workshops no celular e no PC.
          </Text>
          <Card>
            <Campo
              rotulo="E-mail"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <Campo
              rotulo="Senha"
              value={senha}
              onChangeText={setSenha}
              secureTextEntry
              autoComplete={modo === 'criar' ? 'new-password' : 'current-password'}
              onSubmitEditing={enviar}
            />
            <Botao titulo={modo === 'entrar' ? 'Entrar' : 'Criar conta'} onPress={enviar} carregando={carregando} />
          </Card>
          <Pressable onPress={() => setModo(modo === 'entrar' ? 'criar' : 'entrar')} style={{ marginTop: espaco.lg }}>
            <Text style={{ color: cores.primaria, textAlign: 'center', fontWeight: '600' }}>
              {modo === 'entrar' ? 'Primeiro acesso? Criar conta' : 'Já tenho conta. Entrar'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
