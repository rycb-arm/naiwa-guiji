# 东川路流动奶龙の轨迹

一个可以在微信里传播的公开网页：谁打开链接都能发一条**文字 + 地点**，
所有内容按时间倒序排成一条时间轴。不需要注册，不需要登录，不需要装 App。

- **成本**：¥0。不用买域名，不用备案，不用实名。
- **托管**：页面放 GitHub Pages，数据放 Supabase。
- **不发图片**（有意为之）：没有图片就不用配存储桶、不用盯流量配额，
  也不存在手机照片带着拍摄地点被传上去的风险。

---

## 一、上线（大概 20 分钟）

### 第 1 步：建 Supabase 项目

1. 打开 <https://supabase.com> 注册（用 GitHub 账号登录最快，不需要实名）
2. 新建一个项目，地区随便选（推荐 Singapore 或 Tokyo，离国内近一点）
3. 等它初始化完成（约 2 分钟）

### 第 2 步：建数据表和权限

1. 左边栏点 **SQL Editor** → **New query**
2. 把 `sql/schema.sql` 的**全部内容**粘进去 → 点 **Run**

   > ⚠️ **最常见的错误：把文件路径 `sql/schema.sql` 当成内容粘进去了。**
   > 那只是一个路径字符串，数据库会报
   > `syntax error at or near "'sql/schema.sql'"`。
   > 你要粘的是那个文件**打开后的全部文字**。
   >
   > 不想手动开文件全选复制的话，在项目文件夹里跑这一句，
   > SQL 就直接进剪贴板了，回到浏览器 Ctrl+V 即可：
   >
   > ```bash
   > powershell -NoProfile -Command "Set-Clipboard -Value (Get-Content -Raw -Encoding UTF8 'sql\schema.sql')"
   > ```

   应该显示 Success。这个脚本可以重复执行，不会出错。

3. 设置删除口令。在 SQL Editor 里执行下面这句，
   把 `换成你自己的口令` 替换掉（**用 20 位以上的随机字母数字，别用生日、别用 naiwa123**）：

   ```sql
   insert into public.admin_config (id, delete_pass_hash)
   values (1, extensions.crypt('换成你自己的口令', extensions.gen_salt('bf', 10)))
   on conflict (id) do update set delete_pass_hash = excluded.delete_pass_hash;
   ```

   > 为什么要求这么强：这个删除接口谁都能调，每调一次服务器就跑一次密码校验运算。
   > 口令够随机，猜到它需要的算力超出任何人能承受的范围；口令太弱，就真能被跑出来。

### 第 3 步：填配置

1. Supabase 左边栏 **Settings**（齿轮）→ **API Keys**
2. 复制两个值填进 `config.js`：

   | 复制这个 | 填到 `config.js` 的这一行 |
   |---|---|
   | **Project URL**，形如 `https://abcdefghijklmnop.supabase.co` | `SUPABASE_URL` |
   | **Publishable key**，形如 `sb_publishable_xxxxxx` | `SUPABASE_ANON_KEY` |

   > **Project URL 在哪**：在 **Settings → Data API** 页，或者点窗口**右上角的 Connect 按钮**，
   > 都能看到 `https://<项目代号>.supabase.co` 这一串。注意 `<项目代号>` 是 20 位小写字母，
   > 这不是项目名称（显示名），别搞混。
   >
   > **老项目**：如果你的界面里没有 `sb_publishable_` 开头的东西，切到
   > 「**Legacy anon, service_role API keys**」页签，复制 **anon** 那个
   > （`eyJhbGci...` 开头的一长串 JWT）。两种格式都能用，效果一样。

   > ⚠️⚠️ **千万别复制成 Secret key（`sb_secret_...`）或 `service_role`。**
   > 那两个是同一类东西：管理员密钥、权限全开、绕过所有 RLS 策略。
   > 一旦写进公开仓库，任何人拿到它就等于拿到了你整个数据库——
   > 能读、能改、能删，你设的口令也拦不住。
   > **认准 `sb_publishable_` 开头**（或老版的 `anon`）。

### 第 4 步：本地跑起来看一眼

在这个文件夹里执行：

```bash
python -m http.server 8000
```

然后浏览器打开 <http://localhost:8000>。

> ⚠️ **不要直接双击 `index.html` 打开。** 那样是 `file://` 协议，
> Supabase SDK 会报错、页面会白屏。必须走 http。

试着发一条内容，然后去 Supabase 的 **Table Editor** 看 `posts` 表里有没有数据。

### 第 5 步：传上 GitHub，开 Pages

1. 在 GitHub 新建一个**公开**仓库，比如叫 `naiwa-trail`
2. 把这个文件夹里的所有东西推上去：

   ```bash
   git init
   git add .
   git commit -m "东川路流动奶龙の轨迹"
   git branch -M main
   git remote add origin https://github.com/你的用户名/naiwa-trail.git
   git push -u origin main
   ```

3. 仓库页面 → **Settings** → 左边栏 **Pages**
   - Source 选 **Deploy from a branch**
   - Branch 选 **main**，文件夹选 **/(root)** → Save
4. 等 1~2 分钟，刷新页面，顶部会出现网址：

   ```
   https://你的用户名.github.io/naiwa-trail/
   ```

   **这个就是发到微信群里的链接。**

### 第 6 步：加保活（别跳过）

Supabase 免费项目闲置约 7 天会自动暂停，之后所有请求报错——
群里冷场一周，链接就打不开了。

1. 仓库 **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
2. 加两个（名字必须完全一致）：
   - `SUPABASE_URL` → 你的 Project URL
   - `SUPABASE_ANON_KEY` → 你的 Publishable key（`sb_publishable_` 开头；老项目填 anon）

   > 这两个值跟 `config.js` 里填的**完全一样**，直接从 `config.js` 里复制即可。
3. 仓库 **Actions** 标签页 → 左边选 **Keep Supabase Alive** → **Run workflow** 试一次，
   看到绿色的 ✅ 就说明通了。之后它每天会自动跑一次。

---

## 二、怎么用

**发布**：打开链接 → 写点什么 → 填个地点（可选）→ 点发布。
正文不能为空，地点可以不填。

**看**：往下滑自动加载更早的内容。

**删帖**（仅你）：
1. **连续点页面顶部标题 5 下** → 进入管理员模式（卡片会出现红框和「删除」按钮）
2. 点某条卡片上的「删除」→ 输入口令
3. 再点标题 5 下退出管理员模式

---

## 三、你可能遇到的问题

**页面白屏 / 一直显示「还没配置好」**
`config.js` 里的值还没改。

**发布时报权限错误**
`sql/schema.sql` 没跑成功，或者跑的是旧版本。回去把第 2 步重做一遍。

**删帖时提示「口令不对」**
口令没设置，或者设置的时候打错了。重跑第 2 步的第 3 小步。

**微信里打不开**
这是唯一没法提前验证的环节。先确认电脑浏览器能打开；
如果电脑能、微信不能，就是 `github.io` 域名在微信里被拦了。
解决办法是买一个几块钱的域名（`.top`/`.xyz` 首年约 ¥8~30）挂到 Cloudflare Pages——
**前端代码一行都不用改**，把文件原样传上去即可，因为托管方式和代码是无关的。

**`github.com` 打不开 / `git push` 卡住不动**

这个项目**只用到 GitHub 两个功能**：传代码 + 开 Pages。而 `github.com`
这个网页域名在某些网络下会被阻断——注意是**只有它一个**，GitHub 的其它
域名（`api.github.com`、`raw.githubusercontent.com`、`codeload.github.com`）
都是通的，你部署好的 `github.io` 也照常能被别人访问。

所以这不影响你的网站能不能用，只影响你自己传代码。修法是在 hosts 里
把 `github.com` 固定到一个能用的 IP：

1. 开始菜单搜 `PowerShell` → 右键 → **以管理员身份运行**
2. 执行这一条：

   ```powershell
   Add-Content "$env:SystemRoot\System32\drivers\etc\hosts" "`n20.27.177.113 github.com"
   ```

3. 关掉所有浏览器重开，`github.com` 就通了

> 为什么是这个 IP：`github.com` 解析出来的是一个新加坡入口 `20.205.243.166`，
> 那条线路恰好被阻断；GitHub 还有另外 7 个入口，实测**全部可用**，
> 其中日本入口 `20.27.177.113` 最快（连接 0.04 秒，连续 5 次测试全通）。
>
> **以后如果又打不开了**，多半是 GitHub 换 IP 了。把 hosts 里那行删掉，
> 换下面任意一个试试：
>
> ```
> 140.82.116.4     github.com
> 140.82.113.3     github.com
> 4.237.22.38      github.com
> 20.26.156.215    github.com
> ```

> **实在改不了 hosts**（没有管理员权限）：`api.github.com` 是通的，
> 可以用 GitHub 的 Contents API 传文件、开 Pages，全程不碰 `github.com`。
> 需要先去 GitHub 建一个 Personal Access Token。

**链接用了一段时间突然全打不开了**
多半是 Supabase 项目被暂停了。去 Supabase 控制台看看，
如果有 Resume 按钮点一下就行，然后检查保活任务是不是被 GitHub 停用了
（仓库连续 60 天没有提交活动，GitHub 会停用定时任务）。

**用超额度了**
页面不含图片，一次翻页的数据量也就几十 KB，正常使用碰不到免费额度。
真被大量转发到触顶了，去 Supabase 控制台 **Settings → Usage** 看是哪个指标超的。

---

## 四、关于安全，你应该知道的事

**Publishable key 公开在源码里是正常的。** 它是设计上就给浏览器用的公开密钥，
不含任何权限。真正的安全边界是数据库里的 RLS 策略——只开放了「读」和「新增」，
改和删一律默认拒绝。

这一点是拿真 key 直接打 REST 接口验证过的：匿名删帖、匿名改帖都被
`42501 permission denied` 挡掉，管理表读出来是空的，错口令删帖返回 `false`，
伪造时间戳连列级授权都过不去。

**但有一件事这套方案防不住，你需要知道：**

**链接外流后，任何人都能上传。** 上传权限没法只靠前端限制，因为前端的一切都是公开的。
熟人圈子里用没问题；如果哪天被转到不认识的人群里，可能会有人乱传。
真遇到了，解决办法是加人机验证或者上传口令。

**反过来说，删帖是真的删干净了。** 没有图片文件，删掉就是删掉，
不会留下任何还能被直链打开的残留。

**这个站不收集任何定位信息。** 没有 GPS、没有地图、没有任何坐标计算——
「地点」只是大家在输入框里手打的几个字，服务器和浏览器都不知道那具体是哪儿。

---

## 五、文件说明

| 文件 | 作用 |
|---|---|
| `index.html` | 页面骨架 |
| `style.css` | 样式 |
| `app.js` | 全部逻辑：发布、拉取、翻页、删除 |
| `config.js` | **唯一需要你修改的文件** |
| `sql/schema.sql` | 数据库配置，在 Supabase 里跑一次 |
| `vendor/supabase.js` | Supabase SDK，已打包进仓库，运行时零外部依赖 |
| `.github/workflows/keepalive.yml` | 保活定时任务 |

### 关于 `vendor/supabase.js`

SDK 没有从 CDN 加载，而是**直接打包进了仓库**。

原因：国内访问境外 CDN 很不稳定，而 `cdn.jsdelivr.net`、`unpkg` 这类
在微信内置浏览器里都可能加载失败。打包进来之后，整站运行时就只剩
`supabase.co` 一个外部域名——风险面被压到最小，而它已经实测可达。

升级 SDK：替换这个文件即可，代码不用动。
