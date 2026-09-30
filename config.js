/* ============================================================
 *  东川路流动奶龙の轨迹 —— 配置
 *
 *  这是全项目【唯一】需要你修改的文件。
 *  把下面两个值换成你自己 Supabase 项目的。
 *
 *  在哪找：
 *    Supabase 控制台 → 你的项目 → 左下角 Settings（齿轮）→ API Keys
 *
 *    · Project URL
 *        形如 https://abcdefghijklmnopqrst.supabase.co
 *        （在 Settings → Data API 里，或点右上角 Connect 按钮也能看到）
 *        → 填到下面的 SUPABASE_URL
 *
 *    · Publishable key
 *        形如 sb_publishable_xxxxxxxxxxxx
 *        （老项目可能在「Legacy anon, service_role API keys」页签里，
 *          形如 eyJhbGciOi... 的一长串 JWT，用那个也一样）
 *        → 填到下面的 SUPABASE_ANON_KEY
 *
 *  ⚠️ 关于把公开密钥写在公开仓库里：
 *     这是 Supabase 的正常用法，不用慌。Publishable key（等于老版的
 *     anon key）设计上就是给浏览器用的公开密钥，它本身不含任何权限 ——
 *     真正的安全边界是数据库里的 RLS 策略（见 sql/schema.sql）。
 *
 *  ⚠️⚠️ 绝对不要用 Secret key（sb_secret_...，等于老版的 service_role）。
 *     那是管理员密钥、权限全开，绕过所有 RLS。一旦写进公开仓库，
 *     等于把整个数据库交给全世界 —— 任何人都能读、能改、能删。
 *     认准 sb_publishable_ 开头。
 * ============================================================ */

window.NAIWA_CONFIG = {
  // 已按你的项目填好（从控制台地址栏读出，并经 DNS + HTTPS 实测可达）
  SUPABASE_URL: 'https://urrhravhdctywalgbjjh.supabase.co',

  // 例：'sb_publishable_xxxxxxxxxxxxxxxx'（新版）
  // 或：'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....'（旧版，很长一串）
  // 认准 publishable / anon —— 绝不要 sb_secret_ / service_role
  SUPABASE_ANON_KEY: 'sb_publishable_jPdV5SwwvZmQBwaXhqU1Eg_94XlNQ1_',

  // 每页加载多少条
  PAGE_SIZE: 20,

  // 连续点击页面标题几次唤出删除口令输入框
  ADMIN_TAP_COUNT: 5,
};
