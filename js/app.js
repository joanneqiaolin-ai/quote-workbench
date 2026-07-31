/* 外贸报价AI工作台 - 主控逻辑 */
(function (global) {
  'use strict';
  const WB = global.WB = global.WB || {};

  // ---- Toast ----
  let toastTimer = null;
  WB.toast = function (msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  };

  // ---- 页面切换 ----
  WB.go = function (page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    const el = document.getElementById('page-' + page);
    if (el) el.classList.add('active');
    window.scrollTo(0, 0);
  };

  // ---- Modal ----
  WB.openModal = function (html) {
    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('modalMask').classList.add('show');
  };
  WB.closeModal = function () {
    document.getElementById('modalMask').classList.remove('show');
    document.getElementById('modalBody').innerHTML = '';
  };

  // ---- 设置（公司名 / 默认汇率） ----
  async function openSettings() {
    const company = await WB.DB.getKV('company', '');
    const rate = await WB.DB.getKV('rate', '7.2');
    WB.openModal(`
      <button class="close" id="setClose">×</button>
      <h3>⚙ 工作台设置</h3>
      <div class="field"><label>我方公司名称</label><input id="setCompany" value="${WB.escapeAttr ? WB.escapeAttr(company) : company}" placeholder="Your Company Ltd." /></div>
      <div class="field"><label>默认汇率 (USD/CNY)</label><input id="setRate" type="number" value="${rate}" /></div>
      <div class="muted mb">设置后，生成的文档与文案将自动带入公司名；新报价默认使用此汇率。</div>
      <button class="btn" id="setSave">保存设置</button>

      <div class="section-title" style="margin-top:18px">📦 数据备份与恢复（跨设备同步）</div>
      <div class="muted mb">手机导出的备份，在电脑上「导入」即可让产品库、自建模板、设置完全一致。数据仅存本机，不上传云端。</div>
      <div class="flex gap" style="gap:8px">
        <button class="btn ghost sm" id="btnExport">📤 导出备份</button>
        <button class="btn ghost sm" id="btnImport">📥 导入备份</button>
        <input type="file" id="importFile" accept="application/json,.json" hidden />
      </div>
    `);
    document.getElementById('setClose').onclick = WB.closeModal;
    document.getElementById('setSave').onclick = async () => {
      WB._company = document.getElementById('setCompany').value.trim();
      await WB.DB.setKV('company', WB._company);
      await WB.DB.setKV('rate', document.getElementById('setRate').value.trim());
      // 同步到报价汇率（若未改）
      const rc = document.getElementById('c_rate');
      if (rc && (!rc.value || rc.value === '7.2')) rc.value = document.getElementById('setRate').value.trim();
      WB.toast('设置已保存');
      WB.closeModal();
    };
    // 导出备份
    document.getElementById('btnExport').onclick = async () => {
      try {
        const data = await WB.DB.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const fname = 'workbench-backup-' + new Date().toISOString().slice(0, 10) + '.json';
        saveAs(blob, fname);
        WB.toast('备份已导出：' + fname);
      } catch (e) { WB.toast('导出失败：' + (e.message || e)); }
    };
    // 导入备份
    document.getElementById('btnImport').onclick = () => document.getElementById('importFile').click();
    document.getElementById('importFile').onchange = async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      try {
        const text = await f.text();
        const obj = JSON.parse(text);
        await WB.DB.importAll(obj);
        WB.toast('导入成功，正在刷新数据…');
        WB.closeModal();
        if (WB.Products && WB.Products.refreshSelect) await WB.Products.refreshSelect('doc_product', true);
        if (WB.Docs && WB.Docs.refreshTemplates) await WB.Docs.refreshTemplates();
      } catch (err) {
        WB.toast('导入失败：' + (err.message || err));
      }
      e.target.value = '';
    };
  }
  WB.escapeAttr = function (s) { return String(s == null ? '' : s).replace(/"/g, '&quot;'); };

  // ---- 安装到桌面 ----
  let deferredPrompt = null;
  function showInstallBtn() { document.getElementById('installBtn').hidden = false; }
  function showInstallGuide() {
    WB.toast('安卓 Chrome：点地址栏右侧“安装”图标（⬇或⊕），或右上角 ⋮ → “安装应用”。iPhone：Safari 分享→添加到主屏幕。', 5000);
  }

  // 中文安装指引弹窗（手机上点开即可跟着装）
  function openInstallGuide() {
    const url = location.href.split('#')[0];
    WB.openModal(`
      <button class="close" id="igClose">×</button>
      <h3>📱 安装到手机（中文指引）</h3>
      <div class="muted mb">把工作台“添加到主屏幕”，就能像 App 一样一键打开，还支持离线使用。推荐用手机自带浏览器打开下面的链接。</div>

      <div class="section-title">① 先在手机上打开这个链接</div>
      <div class="field" style="margin-bottom:8px"><input id="igUrl" readonly value="${WB.escapeAttr(url)}" style="font-size:13px" /></div>
      <button class="btn ghost sm" id="igCopy" style="margin-bottom:14px">📋 复制链接</button>

      <div class="section-title">② 安卓 · Chrome 浏览器</div>
      <div class="kv"><span>1. 用 Chrome 打开上面的链接</span></div>
      <div class="kv"><span>2. 点地址栏右侧的“安装”图标（⬇ 或 ⊕）</span></div>
      <div class="kv"><span>3. 或点右上角 ⋮ → 选「安装应用 / 添加到主屏幕」</span></div>
      <div class="kv"><span>4. 点「安装」，桌面即出现「报价工作台」图标</span></div>

      <div class="section-title" style="margin-top:14px">② 苹果 iPhone · Safari 浏览器</div>
      <div class="kv"><span>1. 用 Safari 打开上面的链接</span></div>
      <div class="kv"><span>2. 点底部「分享」按钮（□↑ 图标）</span></div>
      <div class="kv"><span>3. 向上滑，点「添加到主屏幕」</span></div>
      <div class="kv"><span>4. 点「添加」，桌面即出现图标</span></div>

      <div class="muted mt">提示：安装入口需 https 链接。若没看到安装图标，先点右上角「安装到桌面」按钮，会再次弹出指引。</div>
    `);
    document.getElementById('igClose').onclick = WB.closeModal;
    document.getElementById('igCopy').onclick = () => {
      const inp = document.getElementById('igUrl');
      inp.select();
      try {
        navigator.clipboard.writeText(inp.value);
        WB.toast('链接已复制，去手机浏览器粘贴打开');
      } catch (e) {
        document.execCommand('copy');
        WB.toast('链接已复制');
      }
    };
  }
  // 捕获浏览器安装事件，支持一键安装
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e; showInstallBtn();
  });
  // 只要满足 https + 支持 SW，就常显安装入口，避免依赖偶发弹窗
  function maybeShowInstall() {
    if (window.isSecureContext !== false && 'serviceWorker' in navigator) showInstallBtn();
  }
  window.addEventListener('appinstalled', () => { document.getElementById('installBtn').hidden = true; });
  // 安装按钮行为：能一键弹窗就弹窗，否则给引导
  function setupInstallButton() {
    const btn = document.getElementById('installBtn');
    btn.onclick = async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice; deferredPrompt = null;
        btn.hidden = true;
      } else {
        showInstallGuide();
      }
    };
  }

  // 非 HTTPS 环境无法安装到主屏幕，给出明确提示
  function checkSecure() {
    if (window.isSecureContext === false) {
      const bar = document.createElement('div');
      bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99;background:#e0892b;color:#fff;font-size:13px;padding:8px 12px;text-align:center;line-height:1.4';
      bar.textContent = '⚠ 当前不是 https 链接，无法“安装到桌面”。请部署到带 https 的固定域名后重试。';
      document.body.appendChild(bar);
    }
  }

  // ---- 启动 ----
  async function boot() {
    WB._company = await WB.DB.getKV('company', '');
    const r = await WB.DB.getKV('rate', '');
    if (r) { const rc = document.getElementById('c_rate'); if (rc && (!rc.value)) rc.value = r; }

    // Tab 切换
    document.querySelectorAll('.tabbar button').forEach(b => b.onclick = () => WB.go(b.dataset.page));
    document.querySelector('.app-header .brand').onclick = openSettings;
    document.getElementById('helpBtn').onclick = openInstallGuide;

    // 模态关闭（点遮罩）
    document.getElementById('modalMask').addEventListener('click', (e) => {
      if (e.target.id === 'modalMask') WB.closeModal();
    });

    // 模块初始化
    await WB.Products.init();   // 异步加载列表
    WB.Calc.init();
    await WB.Docs.init();        // 异步刷新模板/产品下拉
    WB.Copy.init();

    // 注册 Service Worker（PWA 离线/可安装）
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {/* 忽略，不影响使用 */});
    }
    setupInstallButton();
    maybeShowInstall();
    checkSecure();
    WB.toast('工作台已就绪');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
