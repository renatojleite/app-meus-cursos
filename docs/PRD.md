# PRD — Meus Cursos

App Android pessoal para guardar cursos, lives e workshops a partir de um link, enriquecer os dados com IA e sincronizar as datas com a agenda do celular (Google Agenda).

- **Usuário:** um só (o dono do app), com login e-mail + senha.
- **Plataformas:** Android (APK via GitHub Actions) e web/PC (GitHub Pages), mesmo código Expo.
- **Dados:** Supabase (Postgres com RLS). A IA roda numa Edge Function com a chave guardada no servidor.

> v2 (16/11/2026): dados migrados do SQLite local para o Supabase; versão web para gerenciar pelo PC. A agenda nativa continua sendo atualizada pelo celular (ao abrir o app), inclusive para mudanças feitas no PC.

---

## 1. Problema

Inscrições em cursos/lives/workshops ficam espalhadas entre Instagram, YouTube, Sympla, Hotmart, landing pages e e-mails. Fica difícil lembrar o que foi visto, quem é o organizador, quanto custa e quando acontece.

## 2. Objetivo

Colar (ou compartilhar) um link e, em segundos, ter um registro completo — organizador, Instagram, análise breve do perfil, categoria, tags, valor, data — com o evento já na agenda do celular e lembrete de 1h antes.

## 3. Escopo

### 3.1 Captura
- Colar link manualmente na tela "Novo".
- Receber link via **"Compartilhar"** do Android (Instagram, YouTube, navegador etc.) — abre direto a tela "Novo" com o link preenchido.
- Entradas opcionais extras: **texto/legenda** colado e **print** (imagem da galeria) — essenciais para posts do Instagram, cujo conteúdo é fechado.

### 3.2 Enriquecimento (IA)
1. **Extração local:** o app baixa a página e extrai `og:title`, `og:description`, `og:site_name`, `<title>`, meta description, links de Instagram encontrados no HTML e um trecho do texto visível. Para YouTube, usa também o oEmbed (título + canal).
2. **Claude + web search:** recebe link, extração, legenda e print. Deve:
   - identificar organizador/instrutor;
   - **encontrar a conta do Instagram correspondente** (mesmo quando o link é de site ou YouTube);
   - fazer uma **análise breve do perfil** (quem é, nicho, autoridade/porte aproximado, sinais de credibilidade) com base no que a busca encontrar;
   - preencher título, descrição breve, categoria, tags, gratuito/pago, valor, data/hora início e fim, plataforma, formato (online/presencial) e local.
3. **Revisão:** formulário pré-preenchido; o usuário ajusta e salva.
4. **Enriquecer novamente:** no detalhe de um evento salvo, botão "✨ Enriquecer novamente com IA" (só o link ou com print). Abre a edição com os dados mesclados — a IA atualiza o que encontrar, mantém o que não encontrar, preserva o status e soma tags novas às existentes. Nada é gravado até o usuário tocar em Salvar.

> Limitação conhecida: o Instagram não permite leitura direta de perfis/posts sem login. A análise vem de buscas na web (bio indexada, site, menções). Um print do perfil melhora a precisão.

### 3.3 Categorias
- Lista fixa inicial: Tecnologia/Programação, IA, Design, Negócios/Empreendedorismo, Marketing/Vendas, Finanças, Produtividade, Desenvolvimento Pessoal, Saúde/Bem-estar, Idiomas, Outros.
- A IA escolhe uma da lista **ou sugere uma nova**. Na revisão aparece "Criar categoria X?" — só entra na lista se o usuário aceitar.
- Categorias podem ser criadas, renomeadas e excluídas nas Configurações.

### 3.4 Tags
- Muitos-para-muitos. A IA sugere; o usuário adiciona/remove livremente na revisão e no detalhe.
- Tags novas são criadas ao salvar. Gerenciáveis nas Configurações (renomear/excluir).

### 3.5 Status
`pesquisando` → `interessado` → `inscrito`. Troca rápida na lista (toque longo) e no detalhe.

### 3.6 Valor
- `gratuito` (sim/não). Se pago, campo `valor` (R$).

### 3.7 Agenda nativa
- **Todo evento com data** vai para a agenda do celular, no calendário escolhido nas Configurações (ex.: a conta Google — sincroniza sozinho com o Google Agenda).
- O **título sinaliza o status**: `✅` inscrito, `⭐` interessado, `🔍` pesquisando. Ex.: `✅ Workshop de IA — @fulano`.
- **Lembrete de 1h antes** em todos os eventos.
- Editar evento ou status no app → atualiza na agenda. Excluir no app → remove da agenda.
- Sem data → não vai para a agenda. Ao ganhar data → é criado.
- Toggle global "Sincronizar com agenda" (padrão: ligado). Botão "Ressincronizar tudo" nas Configurações.

### 3.8 Lista e filtros
- Lista ordenada por data (próximos primeiro; sem data no fim).
- Filtros combináveis: período (próximos / passados / sem data / todos), status, categoria, tags (qualquer das selecionadas), gratuito/pago, busca por texto (título, organizador, Instagram, descrição).

### 3.9 Agenda no app
- Calendário mensal com marcadores coloridos por status.
- Toque no dia → lista dos eventos daquele dia → detalhe.

### 3.10 Configurações
- Chave da API Claude (SecureStore) + modelo (padrão `claude-sonnet-5-5`).
- Calendário de destino, toggle de sincronização, ressincronizar.
- Gerenciar categorias e tags.

## 4. Fora de escopo (v1)
Login, backup em nuvem, iOS, múltiplos usuários, notificações próprias além do alarme da agenda, scraping autenticado do Instagram.

## 5. Modelo de dados (SQLite)

```sql
categorias (id INTEGER PK, nome TEXT UNIQUE NOT NULL, criado_em TEXT)

tags (id INTEGER PK, nome TEXT UNIQUE NOT NULL COLLATE NOCASE)

eventos (
  id INTEGER PK,
  link TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  organizador TEXT,
  instagram TEXT,              -- handle sem @
  analise_perfil TEXT,
  plataforma TEXT,             -- Instagram, YouTube, Sympla, Hotmart...
  formato TEXT,                -- online | presencial | hibrido
  local TEXT,
  categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'interessado',  -- pesquisando|interessado|inscrito
  gratuito INTEGER NOT NULL DEFAULT 1,
  valor REAL,
  data_inicio TEXT,            -- ISO 8601 com fuso
  data_fim TEXT,
  calendar_event_id TEXT,      -- id do evento na agenda nativa
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
)

evento_tags (evento_id INTEGER, tag_id INTEGER, PRIMARY KEY (evento_id, tag_id))

config (chave TEXT PK, valor TEXT)   -- calendar_id, sync_agenda, modelo
```

## 6. Telas
1. **Lista** (aba) — filtros + cards (status, título, organizador/@, data, categoria, gratuito/valor, tags).
2. **Agenda** (aba) — calendário mensal + eventos do dia.
3. **Config** (aba).
4. **Novo** (modal) — link, legenda, print → "Enriquecer com IA" → formulário de revisão → Salvar. Também permite "Preencher manualmente".
5. **Detalhe/Edição** — mesmo formulário, abrir link, abrir Instagram, excluir.

## 7. Fases
1. Base: projeto, banco, Config (chave API).
2. Captura + extração + Claude + formulário de revisão + salvar.
3. Lista com filtros, tags e categorias.
4. Agenda nativa (criar/atualizar/excluir, lembrete, prefixo de status) + Agenda no app.
5. Share intent, print/legenda, APK.

## 8. Critérios de aceite
- Compartilhar um link do YouTube/Instagram/site abre o app com o link preenchido.
- Enriquecer retorna formulário preenchido em < ~40s, com @ do Instagram e análise quando encontráveis.
- Salvar evento com data cria evento na agenda escolhida com alarme 1h antes e prefixo de status.
- Mudar status atualiza o prefixo do título na agenda.
- Excluir no app remove da agenda.
- Filtros combinados funcionam na lista.
