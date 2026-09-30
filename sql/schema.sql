-- ============================================================
--  东川路流动奶龙の轨迹 —— 数据层配置
--
--  用法：Supabase 控制台 → SQL Editor → 整份粘贴 → Run
--  可以重复执行，不会报错。
--
--  ⚠️ 执行完记得单独跑最后一段「设置删除口令」。
-- ============================================================


-- ------------------------------------------------------------
--  1. 数据表
-- ------------------------------------------------------------
create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  content    text,
  place      text,
  image_path text,          -- 历史遗留：早期版本支持传图，现在恒为 null。
                            -- 保留不动（删列不可逆），对现有数据无影响。
  created_at timestamptz not null default now(),

  constraint posts_content_len check (char_length(coalesce(content, '')) <= 2000),
  constraint posts_place_len   check (char_length(coalesce(place,   '')) <= 50),

  -- 图片路径只允许「UUID.扩展名」，堵死客户端塞任意字符串。
  -- 现在没有图片了，这条约束只是让上面那列闲置着也保持干净。
  constraint posts_image_fmt check (
    image_path is null
    or image_path ~ '^[0-9a-f-]{36}\.(webp|jpg|jpeg|png)$'
  )
);

-- 复合索引：供 (created_at, id) 游标分页使用。
-- 单列 created_at 索引不够用，因为它无法服务 id 这个决胜列。
create index if not exists posts_created_id_idx
  on public.posts (created_at desc, id desc);


-- ------------------------------------------------------------
--  2. 触发器：禁止客户端伪造时间戳
--
--  ⚠️ 这是必须的。default now() 只在「字段被省略」时生效，
--     不加这道防线，任何人都能传一个 2999 年的 created_at，
--     把自己永久钉在时间轴最顶部 —— 直接废掉核心功能。
-- ------------------------------------------------------------
create or replace function public.stamp_post()
returns trigger
language plpgsql
as $$
begin
  new.created_at := now();                          -- 无条件覆盖客户端的值
  new.id         := coalesce(new.id, gen_random_uuid());
  return new;
end $$;

drop trigger if exists trg_stamp_post on public.posts;
create trigger trg_stamp_post
  before insert on public.posts
  for each row execute function public.stamp_post();


-- ------------------------------------------------------------
--  3. RLS：只开放「读」和「新增」
--     故意不建 update / delete policy —— RLS 默认拒绝。
-- ------------------------------------------------------------
alter table public.posts enable row level security;

drop policy if exists "anyone can read"   on public.posts;
drop policy if exists "anyone can insert" on public.posts;

create policy "anyone can read" on public.posts
  for select using (true);

create policy "anyone can insert" on public.posts
  for insert with check (true);


-- ------------------------------------------------------------
--  4. 列级权限与纵深防御
--     即使将来有人误关了 RLS，这几条也能兜住。
-- ------------------------------------------------------------

-- 只允许写这两列。created_at / id / image_path 客户端根本无权写。
-- 少授一列就少一条攻击路径：客户端一旦往请求体里塞 created_at，
-- 会在这一层就被 42501 拒掉，根本到不了触发器。
--
-- 表级、列级各写一遍：PostgreSQL 把这两种授权分开记账，只写表级
-- 不一定能清掉早年授出去的列级权限。两行都写，重跑后结果才确定。
revoke insert on public.posts from anon, authenticated;
revoke insert (image_path) on public.posts from anon, authenticated;
grant  insert (content, place) on public.posts to anon, authenticated;

-- TRUNCATE 会绕过 RLS 完全不受策略约束，必须显式收回。
revoke update, delete, truncate on public.posts from anon, authenticated;

-- 防止有人在 public 下建同名对象来劫持 security definer 函数内的符号解析。
revoke create on schema public from public, anon, authenticated;


-- ------------------------------------------------------------
--  5. 游标分页函数
--
--  为什么不直接在客户端拼 .or() 过滤串：时间戳里的点和冒号
--  容易和 PostgREST 的过滤语法打架，而且同秒记录会漏。用行值
--  比较 (created_at, id) < (p_ts, p_id) 一次解决两个问题。
--
--  security invoker：以调用者身份执行，RLS 照常生效。
-- ------------------------------------------------------------
create or replace function public.list_posts(
  p_limit int         default 20,
  p_ts    timestamptz default null,
  p_id    uuid        default null
)
returns setof public.posts
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from public.posts
  where p_ts is null
     or (created_at, id) < (p_ts, p_id)
  order by created_at desc, id desc
  limit least(coalesce(p_limit, 20), 50);
$$;

grant execute on function public.list_posts(int, timestamptz, uuid) to anon, authenticated;


-- ------------------------------------------------------------
--  6. 口令删除（服务端校验）
--
--  ⚠️ 口令绝不能在客户端比对 —— 源码是公开的，那等于把口令
--     印在网页上。
--
--  这里没有存储桶相关配置。站点不发图片，运行时不碰 Storage，
--  所以不需要建桶、也不需要桶策略。
-- ------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.admin_config (
  id               int primary key default 1 check (id = 1),
  delete_pass_hash text not null
);

alter table public.admin_config enable row level security;
-- 不建任何 policy：连管理员都读不到哈希。

create or replace function public.delete_post(p_id uuid, p_pass text)
returns boolean
language plpgsql
security definer
-- ⚠️ 空 search_path + 全限定名不是洁癖，是修 bug。
--    Supabase 的 pgcrypto 装在 extensions schema 而非 public；
--    若用 set search_path = public，函数内 crypt() 会解析失败并抛
--    「function crypt(text, text) does not exist」，删除功能直接失效。
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  select (c.delete_pass_hash = extensions.crypt(p_pass, c.delete_pass_hash))
    into v_ok
    from public.admin_config c
   where c.id = 1;

  if v_ok is not true then
    return false;
  end if;

  delete from public.posts p where p.id = p_id;
  return found;
end $$;

-- 必须先 revoke：CREATE FUNCTION 默认就把 EXECUTE 授予 PUBLIC 了。
revoke all on function public.delete_post(uuid, text) from public;
grant execute on function public.delete_post(uuid, text) to anon, authenticated;


-- ============================================================
--  7. 设置删除口令 —— 最后单独跑这一段
--
--  把 'REPLACE_ME' 换成你自己的口令，然后执行。
--  用高熵随机串（比如 20 位以上大小写字母+数字），不要用
--  naiwa123 这种。原因：这个函数等于一个在线口令猜测接口，
--  每次调用消耗一次 bcrypt 运算 —— 口令够随机，暴力破解在
--  数学上不可行；口令太弱，就真的能被猜出来。
--
--  改口令：直接重跑这一句即可（会覆盖旧口令）。
-- ============================================================
-- insert into public.admin_config (id, delete_pass_hash)
-- values (1, extensions.crypt('REPLACE_ME', extensions.gen_salt('bf', 10)))
-- on conflict (id) do update set delete_pass_hash = excluded.delete_pass_hash;
