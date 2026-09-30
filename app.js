/* ============================================================
 *  东川路流动奶龙の轨迹
 *
 *  ⚠️ 全局纪律：所有来自用户的内容一律用 textContent 写入 DOM。
 *     这个页面允许任何人写文字，只要有一处用了 innerHTML，
 *     就等于给所有人开了一个存储型 XSS 的口子 —— 挂马、跳转、
 *     篡改页面全都来了。要加富文本请先接 DOMPurify。
 *
 *  本版不含图片：没有上传、没有存储桶、没有缩略图。
 *  运行时只跟 Postgres 打交道，不碰 Supabase Storage。
 * ============================================================ */

(function () {
  'use strict';

  var CFG = window.NAIWA_CONFIG;
  var $ = function (id) { return document.getElementById(id); };

  /* ----------------------------------------------------------
     配置自检：config.js 还没改就直接说清楚，别让用户对着
     一个白屏猜半天。
     ---------------------------------------------------------- */
  function isPlaceholder(v) {
    return !v || typeof v !== 'string' || v.indexOf('REPLACE_WITH') === 0;
  }
  if (!CFG || isPlaceholder(CFG.SUPABASE_URL) || isPlaceholder(CFG.SUPABASE_ANON_KEY)) {
    $('fatalMsg').textContent =
      '请打开 config.js，把 SUPABASE_URL 和 SUPABASE_ANON_KEY 换成你自己 ' +
      'Supabase 项目的值。在 Supabase 控制台的 Settings → API Keys 里能找到：' +
      'Project URL 填 SUPABASE_URL，Publishable key（sb_publishable_ 开头）' +
      '填 SUPABASE_ANON_KEY。注意别用成 Secret key。';
    $('fatal').hidden = false;
    return;
  }

  var sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

  /* ==========================================================
     状态
     ========================================================== */
  var state = {
    cursor: null,        // { created_at, id } —— 复合游标
    loading: false,
    exhausted: false,
    admin: false,
    busy: false,
    pendingDeleteId: null,
  };

  var PASS_KEY = 'naiwa.admin.pass';   // 口令只存 sessionStorage，关掉标签页即失效

  /* ==========================================================
     工具
     ========================================================== */

  // 用 id 当种子算倾斜角，保证同一条每次渲染的角度都一样（不会刷新一次变一次）
  function tiltFor(id) {
    var h = 0;
    for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return ((h % 300) / 100 - 1.5).toFixed(2) + 'deg';
  }

  function fmtTime(iso) {
    var d = new Date(iso);
    var now = new Date();
    var diff = (now - d) / 1000;

    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';

    var pad = function (n) { return String(n).padStart(2, '0'); };
    var md = (d.getMonth() + 1) + '月' + d.getDate() + '日';
    var hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
    var y = d.getFullYear() !== now.getFullYear() ? d.getFullYear() + '年' : '';
    return y + md + ' ' + hm;
  }

  function notice(el, text, isError) {
    el.textContent = text || '';
    el.hidden = !text;
    el.classList.toggle('is-error', !!isError);
  }

  /* ==========================================================
     发布
     ========================================================== */
  function publish() {
    if (state.busy) return;

    var content = $('content').value.trim();
    var place = $('place').value.trim();

    if (!content) {
      notice($('composeMsg'), '写点什么吧', true);
      return;
    }

    state.busy = true;
    $('publish').disabled = true;
    notice($('composeMsg'), '发布中…');

    Promise.resolve()
      .then(function () {
        // 只传这两列。id / created_at 由数据库触发器赋值 ——
        // 客户端无权写，写了会被列级权限直接拒绝。
        return sb.from('posts')
          .insert({ content: content, place: place || null })
          .select('id,content,place,created_at')
          .single();
      })
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);

        prependCard(res.data);
        resetCompose();
        notice($('composeMsg'), '发布成功');
        setTimeout(function () { notice($('composeMsg'), ''); }, 2200);
      })
      .catch(function (err) {
        notice($('composeMsg'), err.message || String(err), true);
      })
      .then(function () {
        state.busy = false;
        $('publish').disabled = false;
      });
  }

  function resetCompose() {
    $('content').value = '';
    $('place').value = '';
    state.exhausted = false;
  }

  /* ==========================================================
     渲染
     ========================================================== */

  function buildCard(post) {
    var el = document.createElement('article');
    el.className = 'card';
    el.dataset.id = post.id;
    el.style.setProperty('--tilt', tiltFor(post.id));

    var p = document.createElement('p');
    p.className = 'card-text';
    p.textContent = post.content;      // ⚠️ 绝对不要改成 innerHTML
    el.appendChild(p);

    if (post.content.length > 160) {
      p.classList.add('is-clamped');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card-expand';
      btn.textContent = '展开';
      btn.addEventListener('click', function () {
        var clamped = p.classList.toggle('is-clamped');
        btn.textContent = clamped ? '展开' : '收起';
      });
      el.appendChild(btn);
    }

    var meta = document.createElement('div');
    meta.className = 'card-meta';

    if (post.place) {
      var pl = document.createElement('span');
      pl.className = 'card-place';
      pl.textContent = '📍 ' + post.place;   // ⚠️ textContent
      pl.title = post.place;
      meta.appendChild(pl);
    }

    var time = document.createElement('time');
    time.className = 'card-time';
    time.dateTime = post.created_at;
    time.textContent = fmtTime(post.created_at);
    meta.appendChild(time);

    if (state.admin) meta.appendChild(buildDeleteBtn(post.id));

    el.appendChild(meta);
    return el;
  }

  function buildDeleteBtn(id) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'card-del';
    b.textContent = '删除';
    b.addEventListener('click', function () { askDelete(id); });
    return b;
  }

  function prependCard(post) {
    $('feed').insertBefore(buildCard(post), $('feed').firstChild);
  }

  /* ==========================================================
     翻页
     ----------------------------------------------------------
     用 (created_at, id) 复合游标。单用 created_at 会丢数据：
     now() 是事务时间，同一秒内的多条记录时间戳完全相同，
     翻页边界落在其中就会整批跳过。
     ========================================================== */
  function loadMore() {
    if (state.loading || state.exhausted) return;
    state.loading = true;
    $('more').disabled = true;

    if (!state.cursor) notice($('feedState'), '加载中…');

    sb.rpc('list_posts', {
      p_limit: CFG.PAGE_SIZE || 20,
      p_ts: state.cursor ? state.cursor.created_at : null,
      p_id: state.cursor ? state.cursor.id : null,
    }).then(function (res) {
      state.loading = false;
      $('more').disabled = false;

      if (res.error) {
        notice($('feedState'), '加载失败：' + res.error.message, true);
        return;
      }

      var rows = res.data || [];

      if (rows.length === 0) {
        state.exhausted = true;
        $('more').hidden = true;
        notice($('feedState'),
          state.cursor ? '到底啦，就这些。' : '还没有人发过，你可以做第一个。');
        return;
      }

      var frag = document.createDocumentFragment();
      var feed = $('feed');
      rows.forEach(function (r) {
        // 去重：发布时做过乐观插入，重新拉第一页会把刚发的那条再带回来
        if (feed.querySelector('[data-id="' + r.id + '"]')) return;
        frag.appendChild(buildCard(r));
      });
      feed.appendChild(frag);

      var last = rows[rows.length - 1];
      state.cursor = { created_at: last.created_at, id: last.id };

      if (rows.length < (CFG.PAGE_SIZE || 20)) {
        state.exhausted = true;
        $('more').hidden = true;
        notice($('feedState'), '到底啦，就这些。');
      } else {
        $('more').hidden = false;
        notice($('feedState'), '');
      }
    });
  }

  /* ==========================================================
     管理员删除
     ----------------------------------------------------------
     口令在服务端（Postgres 函数里）校验，前端不比对 ——
     源码是公开的，前端比对等于把口令印在网页上。
     ========================================================== */
  var taps = [];

  function onTitleTap() {
    var now = Date.now();
    taps = taps.filter(function (t) { return now - t < 3000; });
    taps.push(now);
    if (taps.length >= (CFG.ADMIN_TAP_COUNT || 5)) {
      taps = [];
      toggleAdmin();
    }
  }

  function toggleAdmin() {
    state.admin = !state.admin;
    document.body.classList.toggle('admin', state.admin);

    Array.prototype.forEach.call($('feed').children, function (card) {
      var meta = card.querySelector('.card-meta');
      if (!meta) return;
      var existing = meta.querySelector('.card-del');
      if (state.admin && !existing) {
        meta.appendChild(buildDeleteBtn(card.dataset.id));
      } else if (!state.admin && existing) {
        existing.remove();
      }
    });

    if (!state.admin) sessionStorage.removeItem(PASS_KEY);
    notice($('feedState'), state.admin ? '管理员模式：点卡片上的「删除」' : '');
  }

  function askDelete(id) {
    state.pendingDeleteId = id;
    var cached = sessionStorage.getItem(PASS_KEY);
    if (cached) return doDelete(id, cached);

    $('pwdInput').value = '';
    notice($('pwdMsg'), '');
    $('pwdModal').hidden = false;
    $('pwdInput').focus();
  }

  function doDelete(id, pass) {
    notice($('feedState'), '删除中…');

    sb.rpc('delete_post', { p_id: id, p_pass: pass }).then(function (res) {
      if (res.error) {
        notice($('feedState'), '删除失败：' + res.error.message, true);
        return;
      }
      if (res.data !== true) {
        // 口令不对（或是数据库里还没设置过口令）
        sessionStorage.removeItem(PASS_KEY);
        if (!$('pwdModal').hidden) notice($('pwdMsg'), '口令不对', true);
        else notice($('feedState'), '口令已失效，请重新点「删除」输入', true);
        return;
      }

      sessionStorage.setItem(PASS_KEY, pass);
      var card = $('feed').querySelector('[data-id="' + id + '"]');
      if (card) card.remove();
      $('pwdModal').hidden = true;
      notice($('feedState'), '已删除');
    });
  }

  /* ==========================================================
     事件绑定
     ========================================================== */

  $('title').addEventListener('click', onTitleTap);
  $('publish').addEventListener('click', publish);
  $('more').addEventListener('click', loadMore);

  $('pwdCancel').addEventListener('click', function () {
    $('pwdModal').hidden = true;
    state.pendingDeleteId = null;
  });
  $('pwdOk').addEventListener('click', function () {
    var pass = $('pwdInput').value;
    if (!pass) return notice($('pwdMsg'), '口令不能为空', true);
    if (state.pendingDeleteId) doDelete(state.pendingDeleteId, pass);
  });
  $('pwdInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') $('pwdOk').click();
  });

  // 正文框 Ctrl/Cmd + Enter 直接发布
  $('content').addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') publish();
  });

  // 滚动到底自动加载（保留按钮作为兜底，两者不冲突）
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '400px' }).observe($('feedState'));
  }

  loadMore();
})();
