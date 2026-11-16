# Meus Cursos

App Android pessoal: cole ou compartilhe um link de curso/live/workshop → a IA (Claude) enriquece com organizador, Instagram, análise do perfil, categoria, tags, preço e data → salva local e na agenda do celular com lembrete de 1h.

Especificação: [`docs/PRD.md`](docs/PRD.md) · Guia para o Claude Code: [`CLAUDE.md`](CLAUDE.md)

## Rodar / gerar APK

```bash
npm install

# APK para instalar no celular (build na nuvem do EAS, conta Expo gratuita)
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview

# Desenvolvimento (precisa de development build — não funciona no Expo Go)
npx eas-cli@latest build -p android --profile development
npx expo start --dev-client
```

## Primeiro uso
1. **Config → IA:** cole sua chave da API Anthropic (`sk-ant-...`). Web search precisa estar habilitado no Console da Anthropic.
2. **Config → Agenda:** toque em "Escolher calendário" e selecione o calendário da sua conta Google.
3. Na lista, toque em **+** ou use **Compartilhar → Meus Cursos** no Instagram/YouTube/navegador.
