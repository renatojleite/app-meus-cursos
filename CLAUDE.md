# CLAUDE.md — Meus Cursos

App Android pessoal (Expo) para salvar cursos/lives/workshops a partir de um link, enriquecer com Claude e sincronizar com a agenda nativa. Especificação completa em `docs/PRD.md` — leia antes de mudar comportamento.

## Stack
- Expo SDK 58, React Native 0.88, React 19, TypeScript strict.
- Expo Router (rotas em `src/app/`).
- `expo-sqlite` (banco local, `SQLiteProvider` + `useSQLiteContext`).
- `expo-calendar` — **API nova orientada a objetos** (`getCalendars()`, `ExpoCalendar.get(id)`, `calendar.createEvent()`, `ExpoCalendarEvent.get(id)`, `event.update()`, `event.delete()`). As funções `*Async` antigas lançam erro em runtime; se precisar delas, importe de `expo-calendar/legacy`.
- `expo-share-intent` (receber links via "Compartilhar"; `ShareIntentProvider` no layout raiz + `src/app/+native-intent.tsx`).
- `expo-secure-store` (chave da API), `expo-image-picker` (print, base64), `@react-native-community/datetimepicker`, `react-native-calendars`.

> Expo muda a cada SDK. Não confie em memória: confira os `.d.ts` em `node_modules` ou https://docs.expo.dev/versions/v58.0.0/ antes de usar uma API.

## Estrutura
```
src/
  app/                 # rotas (Expo Router)
    _layout.tsx        # Providers: SQLite, ShareIntent, Stack
    +native-intent.tsx # desvia deep link do share intent para "/"
    (tabs)/            # index (Lista), agenda, config
    novo.tsx           # captura + enriquecimento + revisão
    evento/[id].tsx    # detalhe/edição
  db/                  # schema, migrações, repositórios (SQL puro)
  services/
    extract.ts         # baixa página e extrai metadados
    claude.ts          # chamada à Messages API com web_search
    enriquecimento.ts  # orquestra extração + Claude; aplicarResultado (modo novo/mesclar)
    calendar.ts        # sincronização com agenda nativa
    settings.ts        # SecureStore + tabela config
  components/          # UI reutilizável (EventoForm, Chip, filtros...)
  theme.ts             # cores e espaçamentos
  types.ts             # tipos de domínio
docs/PRD.md
```

## Regras de domínio (não quebrar)
- Status: `pesquisando` | `interessado` | `inscrito`. Prefixo no título da agenda: 🔍 / ⭐ / ✅.
- Todo evento **com data** vai para a agenda nativa (se sync ligado), com alarme `relativeOffset: -60`.
- Salvar/editar/excluir evento sempre chama `syncEvento` / `removerDaAgenda` em `services/calendar.ts`. Falha na agenda **não** impede salvar no banco — mostra aviso.
- Categoria sugerida pela IA que não existe só é criada se o usuário aceitar.
- Datas armazenadas em ISO 8601 (`toISOString()`); exibidas em `pt-BR`, fuso local.

## Claude API
- `POST https://api.anthropic.com/v1/messages`, headers `x-api-key`, `anthropic-version: 2023-06-01`.
- Ferramenta `{ type: "web_search_20250305", name: "web_search", max_uses: 5 }`.
- Resposta final deve conter **só JSON** (o parser extrai o primeiro objeto `{...}`). Tratar `stop_reason: "pause_turn"` reenviando o conteúdo do assistente.
- Modelo configurável (padrão `claude-sonnet-5-5`).

## Comandos
```bash
npx expo install <pkg>        # sempre, para versões compatíveis com o SDK
npx tsc --noEmit              # typecheck — rodar antes de concluir qualquer tarefa
npx expo-doctor
npx eas-cli@latest build -p android --profile preview   # gera APK
```
O app usa módulos nativos (share intent, calendar, sqlite): **não roda no Expo Go** — use development build (`--profile development`) ou o APK `preview`.

## Convenções
- Textos de UI em português (pt-BR). Código e nomes de domínio em português (`evento`, `categoria`), utilitários em inglês ok.
- Componentes funcionais + hooks. Sem lib de estado global; recarregar dados com `useFocusEffect`.
- SQL parametrizado sempre (`runAsync(sql, params)`).
