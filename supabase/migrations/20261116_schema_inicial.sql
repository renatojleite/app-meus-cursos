-- Aplicado no projeto Supabase wwwiuzmpthyhiwoqcafv em 16/11/2026 (migration "schema_inicial").
create table public.categorias (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  criado_em timestamptz not null default now()
);
create unique index categorias_user_nome_uk on public.categorias (user_id, lower(nome));

create table public.tags (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0)
);
create unique index tags_user_nome_uk on public.tags (user_id, lower(nome));

create table public.eventos (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  link text not null default '',
  titulo text not null,
  descricao text,
  organizador text,
  instagram text,
  analise_perfil text,
  plataforma text,
  formato text check (formato in ('online','presencial','hibrido')),
  local text,
  categoria_id bigint references public.categorias(id) on delete set null,
  status text not null default 'interessado' check (status in ('pesquisando','interessado','inscrito')),
  gratuito boolean not null default true,
  valor numeric(12,2),
  data_inicio timestamptz,
  data_fim timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index eventos_user_data_idx on public.eventos (user_id, data_inicio);
create index eventos_categoria_idx on public.eventos (categoria_id);

create table public.evento_tags (
  evento_id bigint not null references public.eventos(id) on delete cascade,
  tag_id bigint not null references public.tags(id) on delete cascade,
  primary key (evento_id, tag_id)
);
create index evento_tags_tag_idx on public.evento_tags (tag_id);

alter table public.categorias enable row level security;
alter table public.tags enable row level security;
alter table public.eventos enable row level security;
alter table public.evento_tags enable row level security;

create policy "dono" on public.categorias for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "dono" on public.tags for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "dono" on public.eventos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "dono" on public.evento_tags for all to authenticated
  using (exists (select 1 from public.eventos e where e.id = evento_id and e.user_id = (select auth.uid())))
  with check (
    exists (select 1 from public.eventos e where e.id = evento_id and e.user_id = (select auth.uid()))
    and exists (select 1 from public.tags t where t.id = tag_id and t.user_id = (select auth.uid()))
  );

create view public.eventos_v with (security_invoker = true) as
select e.*,
  c.nome as categoria_nome,
  coalesce(array_agg(t.nome order by t.nome) filter (where t.id is not null), '{}') as tags,
  coalesce(array_agg(t.id) filter (where t.id is not null), '{}') as tag_ids
from public.eventos e
left join public.categorias c on c.id = e.categoria_id
left join public.evento_tags et on et.evento_id = e.id
left join public.tags t on t.id = et.tag_id
group by e.id, c.nome;

create function public.garantir_categorias() returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.categorias where user_id = auth.uid()) then
    insert into public.categorias (nome) values
      ('Tecnologia/Programação'),('IA'),('Design'),('Negócios/Empreendedorismo'),
      ('Marketing/Vendas'),('Finanças'),('Produtividade'),('Desenvolvimento Pessoal'),
      ('Saúde/Bem-estar'),('Idiomas'),('Outros');
  end if;
end $$;

-- salvar_evento(p_id, p jsonb, p_tags text[]): cria/atualiza o evento e substitui as tags
-- numa transação (ver definição completa no projeto: pg_get_functiondef).

-- migration "auto_confirmar_email": contas novas já nascem confirmadas (sem link por e-mail)
create function public.auto_confirmar_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is null then new.email_confirmed_at := now(); end if;
  return new;
end $$;
revoke execute on function public.auto_confirmar_email() from anon, authenticated, public;
create trigger auto_confirmar_email before insert on auth.users
  for each row execute function public.auto_confirmar_email();
