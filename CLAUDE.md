# CLAUDE.md — Meus Cursos

App pessoal (Expo) para salvar cursos/lives/workshops a partir de um link, enriquecer com Claude e sincronizar com a agenda nativa. Roda no **Android (APK)** e na **web (GitHub Pages)** com o mesmo código; os dados ficam no **Supabase**. Especificação completa em `docs/PRD.md` — leia antes de mudar comportamento.

## Stack
- Expo SDK 58, React Native 0.88, React 19, TypeScript strict.
- Expo Router (rotas em `src/app/`).
- **Supabase** (projeto `wwwiuzmpthyhiwoqcafv`, sa-east-1): Auth e-mail+senha, Postgres com RLS por `user_id`, view `eventos_v` (com `tags`/`tag_ids`), RPCs `salvar_evento` e `garantir_categorias`, Edge Function `enriquecer`. Cliente em `src/lib/supabase.ts` (chave publishable, sessão no AsyncStorage).
- `expo-sqlite` só para migrar dados da versão 1 (local) — `services/migracao.ts`.
- Web: `react-native-web`, `web.output: single`, `experiments.baseUrl: /app-meus-cursos`.
- `expo-calendar` — **API nova orientada a objetos** (`getCalendars()`, `ExpoCalendar.get(id)`, `calendar.createEvent()`, `ExpoCalendarEvent.get(id)`, `event.update()`, `event.delete()`). As funções `*Async` antigas lançam erro em runtime; se precisar delas, importe de `expo-calendar/legacy`.
- `expo-share-intent` (receber links via "Compartilhar"; `ShareIntentProvider` no layout raiz + `src/app/+native-intent.tsx`).
- `@react-native-async-storage/async-storage` (preferências do aparelho), `expo-image-picker` (print, base64), `@react-native-community/datetimepicker`, `react-native-calendars`.

> Expo muda a cada SDK. Não confie em memória: confira os `.d.ts` em `node_modules` ou https://docs.expo.dev/versions/v58.0.0/ antes de usar uma API.

## Estrutura
```
src/
  app/                 # rotas (Expo Router)
    _layout.tsx        # Sessão, Portão (login/migração/sync agenda), Compartilhar, DialogoHost
    login.tsx
    (tabs)/            # index (Lista), agenda, config
    novo.tsx           # captura + enriquecimento + revisão
    evento/[id].tsx    # detalhe/edição/enriquecer novamente
  db/repo.ts           # acesso ao Supabase (todas as consultas)
  lib/
    supabase.ts, sessao.tsx
    dialogo.tsx        # escolher()/avisar(): Alert no celular, modal na web (Alert não funciona na web)
    local.ts           # AsyncStorage: calendário escolhido, sync on/off, mapa evento→agenda
    arquivo(.web).ts
  services/
    claude.ts          # chama a Edge Function e normaliza datas (hora local → ISO)
    enriquecimento.ts  # rodarEnriquecimento + aplicarResultado (novo/mesclar)
    calendar.ts        # agenda nativa (Android); calendar.web.ts = stubs
    migracao(.web).ts  # SQLite v1 → Supabase (uma vez)
    link.ts
  components/          # EventoForm, EventoCard, DataHora(.web), Compartilhar(.web), ui
supabase/
  functions/enriquecer # Deno: lê a página + Claude com web_search
  migrations/          # registro do schema
docs/PRD.md
```

## Arquivos por plataforma
Quando algo nativo não existe na web, crie `x.web.ts(x)` com a mesma interface (ex.: `calendar.web.ts`, `DataHora.web.tsx`). Nunca use `Alert` direto: use `lib/dialogo`. Envolva conteúdo de tela em `larguraMax` (theme) para ficar bom no desktop.

## Regras de domínio (não quebrar)
- Status: `pesquisando` | `interessado` | `inscrito`. Prefixo no título da agenda: 🔍 / ⭐ / ✅.
- Todo evento **com data** vai para a agenda nativa do celular (se sync ligado), com alarme `relativeOffset: -60`.
- O vínculo evento→agenda fica **no aparelho** (`lib/local.ts`, com hash do conteúdo). `sincronizarAgenda()` roda ao logar e quando o app volta ao primeiro plano: aplica o que mudou (inclusive pelo PC) e remove o que foi excluído.
- Salvar/editar/excluir chama `syncEvento` / `removerDaAgenda`. Falha na agenda **não** impede salvar — mostra aviso.
- Categoria sugerida pela IA que não existe só é criada se o usuário aceitar.
- Datas armazenadas em ISO 8601 (`toISOString()`); exibidas em `pt-BR`, fuso local.

## Claude API (Edge Function `enriquecer`)
- Secrets no Supabase: `ANTHROPIC_API_KEY`, `ALLOWED_EMAILS` (e-mails que podem usar a IA), `ANTHROPIC_MODEL` opcional (padrão `claude-sonnet-5-5`).
- Ferramenta `web_search_20250305` (max_uses 5); trata `pause_turn`; resposta final só JSON.
- Deploy: ferramenta MCP `deploy_edge_function` (verify_jwt true) com os 3 arquivos da pasta.

## Comandos
```bash
npx expo install <pkg>        # sempre, para versões compatíveis com o SDK
npx tsc --noEmit              # typecheck — rodar antes de concluir qualquer tarefa
npx expo-doctor
npx expo export --platform web      # build web
```
CI (`.github/workflows`): `android-apk.yml` publica o APK em Releases; `web.yml` publica no GitHub Pages. Ambos a cada push na `main`. Não roda no Expo Go (módulos nativos).

## Convenções
- Textos de UI em português (pt-BR). Código e nomes de domínio em português (`evento`, `categoria`), utilitários em inglês ok.
- Componentes funcionais + hooks. Sem lib de estado global; recarregar dados com `useFocusEffect`.
- Mudança de schema: `apply_migration` no Supabase + registrar em `supabase/migrations/`.
