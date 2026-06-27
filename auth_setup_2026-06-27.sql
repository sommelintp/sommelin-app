-- ============================================================
-- ソムリン 認証の土台: profiles + business_applications + RLS
-- 実行方法: Supabase ダッシュボード → SQL Editor に全部貼り付けて Run
-- 何度実行してもOK（idempotent）。2026-06-27
-- ============================================================

-- 1) プロフィール（auth.users と 1:1。role を保持）
create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  role                text not null default 'individual'
                       check (role in ('individual','importer','retailer','store','admin')),
  display_name        text,
  company             text,
  phone               text,
  contact_email       text,
  verification_status text not null default 'none'
                       check (verification_status in ('none','pending','approved','rejected')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- 2) サインアップ時に profiles を自動作成（role はサインアップ時のメタデータから）
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, display_name, contact_email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'individual'),
    new.raw_user_meta_data->>'display_name',
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3) 業務者の申請（名刺・URL等。名刺画像のStorage保存はフェーズ2）
create table if not exists public.business_applications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text,
  company       text,
  contact_name  text,
  job_title     text,
  phone         text,
  contact_email text,
  urls          jsonb,
  card_front_uploaded boolean default false,
  card_back_uploaded  boolean default false,
  status        text not null default 'pending'
                check (status in ('pending','approved','rejected')),
  created_at    timestamptz not null default now()
);

alter table public.business_applications enable row level security;

drop policy if exists ba_select_own on public.business_applications;
create policy ba_select_own on public.business_applications
  for select using (auth.uid() = user_id);

drop policy if exists ba_insert_own on public.business_applications;
create policy ba_insert_own on public.business_applications
  for insert with check (auth.uid() = user_id);

-- 4) updated_at 自動更新
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ============================================================
-- 実行後にやること（Supabaseダッシュボード）:
--  Authentication → Providers → Email を有効化。
--  即時利用させたい場合は「Confirm email」をOFF（確認メールなしで即ログイン）。
--  ONのままなら、登録時に確認メールが届き、リンクで認証後にログイン可能。
--  Authentication → URL Configuration の Site URL に
--    https://sommelintp.github.io/sommelin-app/ を設定。
-- ============================================================
