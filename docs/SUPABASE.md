# Supabase 연결

계정과 서버 저장은 Supabase를 쓴다. `js/core/server_config.js`가 비어 있는 동안 게임은 **테스트 서버**로 돈다. 테스트 서버에서는 계정과 저장이 이 브라우저의 localStorage(`dungeonGuard.testServer`) 안에만 있다. 주소와 공개 키를 넣으면 같은 흐름이 실제 서버로 바뀐다.

## 1. 프로젝트 만들기 (사용자)

1. supabase.com에서 새 프로젝트를 만든다. 지역은 Northeast Asia (Seoul)이다.
2. **Project Settings → API**에서 두 값을 `js/core/server_config.js`에 넣는다.
   - `Project URL` → `url`
   - `anon public` → `anonKey`
   - `service_role` 키는 저장소에도, 대화에도 넣지 않는다.

## 2. 로그인 설정

- **Authentication → Providers → Email**
  - 켠다.
  - **Confirm email**은 끈다. 아이디 로그인은 `아이디@id.dungeonguard.game` 형태의 가짜 이메일을 쓰므로 확인 메일을 받을 수 없다. 켜 두면 가입할 때 "서버 설정 확인: 이메일 확인 끄기"가 뜬다.
- **Authentication → Providers → Google**
  - Google Cloud에서 OAuth 클라이언트를 만든 뒤 Client ID와 Secret을 넣는다. 쓰지 않을 거면 꺼 둔다.
- **Authentication → URL Configuration**
  - Site URL과 Redirect URLs에 게임 주소를 넣는다.
  - Google 로그인은 그 주소로 돌아와 로그인을 이어받는다.

## 3. 표와 보안 규칙 (SQL Editor에서 한 번 실행)

```sql
-- 계정 기록(Meta.data 한 덩어리). 자기 줄만 읽고 쓴다
create table if not exists public.saves (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.saves enable row level security;
create policy "saves: read own" on public.saves for select using (auth.uid() = user_id);
create policy "saves: insert own" on public.saves for insert with check (auth.uid() = user_id);
create policy "saves: update own" on public.saves for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- 저장 크기 상한(약 256KB)
alter table public.saves add constraint saves_size check (pg_column_size(data) < 262144);

-- 닉네임(랭킹 이름). 겹치지 않고, 대소문자를 가리지 않는다. 누구나 읽고 자기 것만 쓴다
create table if not exists public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  nickname text not null check (nickname ~ '^[가-힣a-zA-Z0-9_]{2,12}$'),
  updated_at timestamptz not null default now()
);
create unique index if not exists profiles_nickname_key on public.profiles (lower(nickname));
alter table public.profiles enable row level security;
create policy "profiles: read all" on public.profiles for select using (true);
create policy "profiles: insert own" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles: update own" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## 4. 게임 흐름

- **손님:** 기록은 `dungeonGuard.meta` 한 칸에 있다.
- **가입·로그인:** 서버 기록(`saves`)을 읽는다. 기록의 이 기기 사본은 `dungeonGuard.meta@<계정 id>` 칸에 둔다.
  - 서버 기록이 없고 손님 기록이 있으면 **옮기기**를 묻는다. 옮기면 손님 칸을 비운다.
  - 둘 다 있고 서로 다르면 **이 기기 것 / 서버 것**을 고르게 한다.
- **다시 켤 때:** 남은 로그인을 이어받는다. 이 기기 사본과 서버 기록 중 `savedAt`이 새로운 쪽을 묻지 않고 쓴다.
- **저장:** `Meta.save()`를 하고 2초 뒤 한 번에 서버로 올린다.
- **로그아웃:** 손님 칸으로 돌아간다.

랭킹(점수 제출, 입력 재생 검증)은 이 계정 위에 따로 붙인다.
