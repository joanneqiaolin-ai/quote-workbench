/* 外贸报价AI工作台 - 产品资料库模块 */
(function (global) {
  'use strict';
  const WB = global.WB = global.WB || {};

  let cached = []; // 当前列表（含全部字段）
  const cacheMap = {};

  function $(id) { return document.getElementById(id); }

  async function load() {
    cached = await WB.DB.listProducts();
    cached.forEach(p => cacheMap[p.id] = p);
    render();
  }

  function getCached(id) { return cacheMap[id]; }

  function render() {
    const q = ($('prodSearch').value || '').trim().toLowerCase();
    const list = $('prodList');
    const filtered = cached.filter(p =>
      !q || (p.name || '').toLowerCase().includes(q) || (p.material || '').toLowerCase().includes(q));
    if (!filtered.length) {
      list.innerHTML = '<div class="empty"><span class="em">📦</span>' +
        (cached.length ? '没有匹配的产品' : '还没有产品，点右上角“+ 新增”添加') + '</div>';
      return;
    }
    list.innerHTML = '';
    filtered.forEach(p => {
      const div = document.createElement('div');
      div.className = 'list-item';
      const thumb = p.imageUrl
        ? '<img class="thumb" src="' + escapeAttr(p.imageUrl) + '" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{textContent:\'📦\',className:\'thumb\'}))" />'
        : '<span class="thumb">📦</span>';
      div.innerHTML =
        thumb +
        '<div class="info"><div class="nm">' + escapeHtml(p.name) + '</div>' +
        '<div class="mt">' + (p.material ? escapeHtml(p.material) : '—') +
        (p.cost ? ' ｜ ¥' + p.cost + '/双' : '') + '</div></div>' +
        '<div class="acts">' +
        '<button class="btn accent sm" data-act="calc">报价</button>' +
        '<button class="btn light sm" data-act="doc">文档</button>' +
        '<button class="btn ghost sm" data-act="edit">改</button>' +
        '<button class="btn danger sm" data-act="del">删</button>' +
        '</div>';
      div.querySelector('[data-act=calc]').onclick = () => loadToCalc(p);
      div.querySelector('[data-act=doc]').onclick = () => loadToDoc(p);
      div.querySelector('[data-act=edit]').onclick = () => openEditor(p);
      div.querySelector('[data-act=del]').onclick = async () => {
        if (confirm('确认删除「' + p.name + '」？')) { await WB.DB.deleteProduct(p.id); WB.toast('已删除'); load(); }
      };
      list.appendChild(div);
    });
  }

  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
  function escapeAttr(s) { return String(s == null ? '' : s).replace(/"/g, '&quot;'); }

  // ---- 新增/编辑 弹窗 ----
  function openEditor(p) {
    p = p || {};
    const body = `
      <button class="close" id="peClose">×</button>
      <h3>${p.id ? '编辑产品' : '新增产品'}</h3>
      <div class="field"><label>产品名称 *</label><input id="pe_name" value="${escapeAttr(p.name)}" placeholder="如：ST-201 Steel Toe Shoe" /></div>
      <div class="field"><label>材质 / 规格</label><input id="pe_material" value="${escapeAttr(p.material)}" placeholder="PU+网布 / 钢头 / EVA底" /></div>
      <div class="section-title">装箱尺寸（外箱 cm）</div>
      <div class="grid3">
        <div class="field"><label>长</label><input id="pe_l" type="number" value="${p.sizeL || ''}" /></div>
        <div class="field"><label>宽</label><input id="pe_w" type="number" value="${p.sizeW || ''}" /></div>
        <div class="field"><label>高</label><input id="pe_h" type="number" value="${p.sizeH || ''}" /></div>
      </div>
      <div class="grid2">
        <div class="field"><label>每箱双数</label><input id="pe_ppc" type="number" value="${p.ppc || ''}" /></div>
        <div class="field"><label>MOQ (双)</label><input id="pe_moq" type="number" value="${p.moq || ''}" /></div>
      </div>
      <div class="grid2">
        <div class="field"><label>人民币成本(元/双)</label><input id="pe_cost" type="number" value="${p.cost || ''}" /></div>
        <div class="field"><label>国内费用(元/双)</label><input id="pe_dom" type="number" value="${p.dom || ''}" /></div>
      </div>
      <div class="field"><label>图片地址 (URL)</label><input id="pe_img" value="${escapeAttr(p.imageUrl)}" placeholder="https://... 或留空" /></div>
      <div class="field"><label>备注</label><textarea id="pe_notes" placeholder="颜色、卖点、交期等">${escapeHtml(p.notes)}</textarea></div>
      <div class="btn-row">
        <button class="btn" id="peSave">保存</button>
        <button class="btn ghost" id="peCancel">取消</button>
      </div>`;
    WB.openModal(body);
    $('peClose').onclick = WB.closeModal;
    $('peCancel').onclick = WB.closeModal;
    $('peSave').onclick = async () => {
      const obj = Object.assign({}, p, {
        name: $('pe_name').value.trim() || ('产品' + Date.now()),
        material: $('pe_material').value.trim(),
        sizeL: parseFloat($('pe_l').value) || 0,
        sizeW: parseFloat($('pe_w').value) || 0,
        sizeH: parseFloat($('pe_h').value) || 0,
        ppc: parseFloat($('pe_ppc').value) || 0,
        moq: parseFloat($('pe_moq').value) || 0,
        cost: parseFloat($('pe_cost').value) || 0,
        dom: parseFloat($('pe_dom').value) || 0,
        imageUrl: $('pe_img').value.trim(),
        notes: $('pe_notes').value.trim()
      });
      await WB.DB.saveProduct(obj);
      WB.toast('已保存');
      WB.closeModal(); load();
    };
  }

  // ---- 调到报价 ----
  function loadToCalc(p) {
    $('c_name').value = p.name || '';
    $('c_material').value = p.material || '';
    $('c_l').value = p.sizeL || '';
    $('c_w').value = p.sizeW || '';
    $('c_h').value = p.sizeH || '';
    $('c_ppc').value = p.ppc || '';
    $('c_cost').value = p.cost || '';
    $('c_dom').value = p.dom || '';
    $('c_moq').value = p.moq || '';
    WB.go('calc');
    WB.toast('已调入报价，可点计算');
  }

  // ---- 调到文档 ----
  function loadToDoc(p) {
    refreshSelect('doc_product', true).then(() => {
      const sel = $('doc_product');
      sel.value = p.id;
      if (sel.onchange) sel.onchange();
    });
    WB.go('docs');
    WB.toast('已调入文档，点生成');
  }

  // 供 docs 模块调用：刷新产品下拉
  async function refreshSelect(selId, includeEmpty) {
    const sel = $(selId); if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '';
    if (includeEmpty) { const o = document.createElement('option'); o.value = ''; o.textContent = '— 手动输入 / 暂不调入 —'; sel.appendChild(o); }
    cached.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name; sel.appendChild(o); });
    if (cur) sel.value = cur;
  }

  async function save(p) {
    await WB.DB.saveProduct(p);
    await load();
  }

  function init() {
    $('addProd').onclick = () => openEditor(null);
    $('prodSearch').oninput = render;
    load();
  }

  WB.Products = { init, load, save, getCached, refreshSelect };
})(window);
