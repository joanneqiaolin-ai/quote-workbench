/* 外贸报价AI工作台 - 文档生成模块 */
(function (global) {
  'use strict';
  const WB = global.WB = global.WB || {};

  // 内置模板（随应用分发，用户也可上传自己的替换）
  const BUILTIN = [
    { id: 'builtin_quotation', name: '内置模板 · Quotation 报价单', url: 'templates/Quotation.docx', kind: 'docx' },
    { id: 'builtin_pi', name: '内置模板 · PI 形式发票', url: 'templates/PI.docx', kind: 'docx' }
  ];

  // 占位符 → 规范字段 的中文标签 & 取值键
  const CANON = {
    customer: '客户/收货方', company: '我方公司', date: '日期', quote_no: '报价单号',
    pi_no: 'PI编号', payment: '付款方式', no: '序号', product_name: '产品名称',
    material: '材质/规格', packing: '装箱尺寸', unit_price: '单价', moq: 'MOQ',
    qty: '数量', amount: '金额', total: '总金额', product_image: '产品图片',
    incoterm: '贸易术语', price_term: '价格条款', freight: '海运费', insurance: '保险费',
    fob_price: 'FOB单价', exw_price: 'EXW单价'
  };

  // 常用别名 → 规范键（用于识别用户自有模板里的各种命名）
  const SYN = {
    customer: ['customer', 'client', 'buyer', 'consignee', 'attn', 'to', 'receiver'],
    company: ['company', 'seller', 'exporter', 'shipper', 'ourcompany', 'ourside', 'beneficiary'],
    product_name: ['product', 'productname', 'item', 'goods', 'article', 'description', 'model'],
    material: ['material', 'spec', 'specification', 'quality', 'composition'],
    unit_price: ['price', 'unitprice', 'unit_price', 'uprice', 'fob', 'fobprice', 'unit'],
    moq: ['moq', 'minorder', 'minqty', 'minorderqty'],
    qty: ['qty', 'quantity', 'orderqty', 'quantity'],
    total: ['total', 'grandtotal', 'sum', 'amounttotal', 'alltotal'],
    payment: ['payment', 'payterm', 'payterms', 'term'],
    incoterm: ['incoterm', 'trade', 'term', 'tradeterm'],
    price_term: ['priceterm', 'tradeclause', 'deliveryterm'],
    freight: ['freight', 'seafreight', 'oceanfreight', 'shipment'],
    insurance: ['insurance', 'premium']
  };

  // 把模板里的占位符名解析为规范键
  function resolveCanon(name) {
    const raw = name.toLowerCase();
    if (CANON[raw]) return raw;                                 // 精确匹配原名（如 price_term）
    const k = raw.replace(/[^a-z0-9]/g, '');
    if (CANON[k]) return k;
    for (const ck of Object.keys(SYN)) {
      // 词边界匹配，避免 price 误中 priceterm
      if (SYN[ck].some(s => new RegExp('(^|_)' + s + '(_|$)').test(k))) return ck;
    }
    return null;
  }

  let currentPlaceholders = [];   // 当前模板扫描出的占位符
  let currentTplKind = 'docx';
  let uploadedImage = null;        // 文档页上传的产品图（dataURL）

  // ---- 工具 ----
  function bufToB64(buf) {
    let bin = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function b64ToBuf(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  async function fetchBuf(url) {
    const r = await fetch(url);
    return r.arrayBuffer();
  }

  // 扫描 docx / xlsx 中的 {{...}} 占位符
  async function scanPlaceholders(buf, kind) {
    const zip = new PizZip(buf);
    const names = Object.keys(zip.files);
    const set = new Set();
    const re = /\{\{\s*([\w]+)\s*\}\}/g;
    if (kind === 'xlsx') {
      names.filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n) || n === 'xl/sharedStrings.xml').forEach(n => {
        const txt = zip.files[n].asText();
        let m; while ((m = re.exec(txt))) set.add(m[1]);
      });
    } else {
      ['word/document.xml', 'word/header1.xml', 'word/footer1.xml'].forEach(n => {
        if (zip.files[n]) { const txt = zip.files[n].asText(); let m; while ((m = re.exec(txt))) set.add(m[1]); }
      });
    }
    return [...set];
  }

  // ---- 字段UI ----
  function buildFieldUI(placeholders, canonical) {
    const box = document.getElementById('docFields');
    box.innerHTML = '<div class="section-title">文档字段 (' + placeholders.length + ' 个占位符)</div>';
    if (!placeholders.length) {
      box.innerHTML += '<div class="muted">未检测到占位符，将按规范字段自动填充（适用于内置模板）。可直接点生成。</div>';
      return;
    }
    placeholders.forEach(name => {
      const key = resolveCanon(name) || name.toLowerCase();
      const label = CANON[key] || name;
      const val = canonical && canonical[key] != null ? canonical[key] : '';
      const f = document.createElement('div');
      f.className = 'field';
      f.innerHTML = '<label>' + label + ' <span class="hint">' + (CANON[key] ? '' : '{{' + name + '}}') + '</span></label>' +
        '<input id="fld_' + name + '" value="' + escapeAttr(val) + '" placeholder="' + label + '" />';
      box.appendChild(f);
    });
  }

  function escapeAttr(s) { return String(s == null ? '' : s).replace(/"/g, '&quot;'); }

  // 收集字段数据（合并规范值 + 用户手动输入）
  function gatherData() {
    const d = {};
    currentPlaceholders.forEach(name => {
      const el = document.getElementById('fld_' + name);
      d[name] = el ? el.value.trim() : '';
    });
    return d;
  }

  // ---- 模板选择 ----
  async function refreshTemplates() {
    const sel = document.getElementById('doc_template');
    const uploaded = await WB.DB.listTemplates();
    sel.innerHTML = '';
    BUILTIN.forEach(t => { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name; sel.appendChild(o); });
    uploaded.forEach(t => { const o = document.createElement('option'); o.value = 'up_' + t.id; o.textContent = '我的：' + t.name; sel.appendChild(o); });
    refreshTplManage(uploaded);
    await onTemplateChange();
  }

  async function refreshTplManage(uploaded) {
    const box = document.getElementById('tplManage');
    if (!uploaded.length) { box.className = 'muted'; box.textContent = '暂无上传模板'; return; }
    box.className = '';
    box.innerHTML = '';
    uploaded.forEach(t => {
      const row = document.createElement('div');
      row.className = 'flex-between'; row.style.padding = '8px 0'; row.style.borderBottom = '1px dashed var(--line)';
      row.innerHTML = '<span>' + escapeAttr(t.name) + ' <span class="pill">' + (t.kind || '?') + '</span></span>';
      const del = document.createElement('button');
      del.className = 'btn danger sm'; del.textContent = '删除';
      del.onclick = async () => { await WB.DB.deleteTemplate(t.id); WB.toast('已删除模板'); refreshTemplates(); };
      row.appendChild(del); box.appendChild(row);
    });
  }

  async function getSelectedTemplateBuf() {
    const id = document.getElementById('doc_template').value;
    if (id.startsWith('up_')) {
      const t = await WB.DB.getTemplate(id.slice(3));
      return t.data; // ArrayBuffer
    }
    const bt = BUILTIN.find(x => x.id === id);
    return await fetchBuf(bt.url);
  }

  async function onTemplateChange() {
    const id = document.getElementById('doc_template').value;
    let kind = 'docx';
    if (id.startsWith('up_')) {
      const t = await WB.DB.getTemplate(id.slice(3));
      kind = (t && t.kind) || 'docx';
    }
    currentTplKind = kind;
    const buf = await getSelectedTemplateBuf();
    const ph = await scanPlaceholders(buf, currentTplKind);
    currentPlaceholders = ph;
    document.getElementById('tplInfo').textContent = ph.length
      ? '检测到占位符：' + ph.map(p => '{{' + p + '}}').join('、')
      : '未检测到占位符（内置模板按规范字段填充）。';
    buildFieldUI(ph, buildCanonical());
  }

  // 由产品库当前选择构建规范数据
  function buildCanonical() {
    const pid = document.getElementById('doc_product').value;
    const p = WB.Products && WB.Products.getCached(pid);
    const base = WB.Docs._lastCalc || {};
    const c = {};
    if (p) {
      c.product_name = p.name || '';
      c.material = p.material || '';
      c.packing = [p.sizeL, p.sizeW, p.sizeH].filter(Boolean).join('×') + ' cm';
      c.moq = p.moq || '';
      if (p.imageUrl) c.product_image = p.imageUrl;   // 产品库图片自动带入
    }
    if (base.unitPrice != null) c.unit_price = '$' + base.unitPrice.toFixed(2);
    c.incoterm = base.incoterm || 'FOB';
    c.price_term = (base.incoterm || 'FOB') + ' Jinjiang';
    c.fob_price = base.fobUsd != null ? '$' + base.fobUsd.toFixed(2) : '';
    c.exw_price = base.exwUsd != null ? '$' + base.exwUsd.toFixed(2) : '';
    c.freight = base.freight ? '$' + base.freight.toFixed(2) + '/pair' : '—';
    c.insurance = base.insurance ? '$' + base.insurance.toFixed(2) + '/pair' : '—';
    c.date = new Date().toISOString().slice(0, 10);
    c.company = WB._company || 'Your Company Name';
    c.customer = '';
    c.payment = 'T/T 30% deposit, 70% before shipment';
    c.no = '1';
    c.qty = c.moq || '1000';
    c.amount = '';
    c.total = '';
    return c;
  }

  // 把任意图片来源（dataURL / blob URL / http URL）统一成 dataURL
  async function toDataUrl(src) {
    if (!src) return null;
    if (typeof src === 'string' && src.indexOf('data:') === 0) return src;
    try {
      const r = await fetch(src, { mode: 'cors' });
      if (!r.ok) return null;
      const ab = await r.arrayBuffer();
      const ct = r.headers.get('content-type') || 'image/png';
      return 'data:' + ct + ';base64,' + bufToB64(ab);
    } catch (e) { return null; }
  }

  // 把图片直接手写注入 docx（绕过版本错配的 image-module）
  // 找到 {%product_image%} 所在 run，替换为内嵌图片 drawing
  function injectImageIntoDocx(ab, dataUrl, sizePx) {
    const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
    if (!m) return ab;
    const mime = m[1];
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const ext = mime.indexOf('png') >= 0 ? 'png' : (mime.indexOf('jpeg') >= 0 ? 'jpeg' : 'png');
    const ct = mime.indexOf('png') >= 0 ? 'image/png' : (mime.indexOf('jpeg') >= 0 ? 'image/jpeg' : 'image/png');
    const emu = Math.round((sizePx || 160) * 9525); // px -> EMU
    const zip = new PizZip(ab);
    const NS = {
      wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingml',
      a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
      pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
      r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
    };
    // 唯一 media 文件名
    const existing = Object.keys(zip.files).filter(n => /^word\/media\//.test(n));
    let idx = 1, mediaName;
    do { mediaName = 'productImage' + idx + '.' + ext; idx++; } while (existing.indexOf('word/media/' + mediaName) >= 0);
    // 定位占位 run（最内层、内部不再嵌套其他 <w:r>）
    let xml = zip.file('word/document.xml').asText();
    const re = /<w:r\b[^>]*>(?:[^<]|<(?!\/?w:r[ >]))*\{%product_image%\}(?:[^<]|<(?!\/?w:r[ >]))*<\/w:r>/;
    const runMatch = xml.match(re);
    if (!runMatch) {
      // 未匹配到（占位可能被 Word 拆分到多个 run），安全剥离避免残留
      xml = xml.replace(/\{%product_image%\}/g, '');
      zip.file('word/document.xml', xml);
      return zip.generate({ type: 'arraybuffer' });
    }
    const rId = 'rIdIMG' + Date.now().toString().slice(-6);
    const run =
      '<w:r xmlns:wp="' + NS.wp + '" xmlns:a="' + NS.a + '" xmlns:pic="' + NS.pic + '" xmlns:r="' + NS.r + '">' +
        '<w:rPr><w:noProof/></w:rPr>' +
        '<w:drawing>' +
          '<wp:inline distT="0" distB="0" distL="0" distR="0">' +
            '<wp:extent cx="' + emu + '" cy="' + emu + '"/>' +
            '<wp:effectExtent l="0" t="0" r="0" b="0"/>' +
            '<wp:docPr id="100" name="ProductImage"/>' +
            '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="' + NS.a + '" noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
            '<a:graphic xmlns:a="' + NS.a + '"><a:graphicData uri="' + NS.pic + '">' +
              '<pic:pic xmlns:pic="' + NS.pic + '">' +
                '<pic:nvPicPr><pic:cNvPr id="0" name="productImage"/><pic:cNvPicPr/></pic:nvPicPr>' +
                '<pic:blipFill><a:blip r:embed="' + rId + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
                '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + emu + '" cy="' + emu + '"/></a:xfrm>' +
                '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
              '</pic:pic>' +
            '</a:graphicData></a:graphic>' +
          '</wp:inline>' +
        '</w:drawing>' +
      '</w:r>';
    xml = xml.replace(re, run);
    zip.file('word/document.xml', xml);
    zip.file('word/media/' + mediaName, bytes, { binary: true });
    // 关系
    const relsPath = 'word/_rels/document.xml.rels';
    let rels = zip.file(relsPath).asText();
    rels = rels.replace(/<\/Relationships>/,
      '<Relationship Id="' + rId + '" Type="' + NS.r + '/image" Target="media/' + mediaName + '"/></Relationships>');
    zip.file(relsPath, rels);
    // 内容类型
    let ctXml = zip.file('[Content_Types].xml').asText();
    if (!new RegExp('Extension="' + ext + '"').test(ctXml)) {
      ctXml = ctXml.replace(/<\/Types>/,
        '<Default Extension="' + ext + '" ContentType="' + ct + '"/></Types>');
      zip.file('[Content_Types].xml', ctXml);
    }
    return zip.generate({ type: 'arraybuffer' });
  }

  // ---- 渲染 docx ----
  async function renderDocx(buf, data, wantImage) {
    let imgDataUrl = null;
    if (wantImage) { try { imgDataUrl = await toDataUrl(data.product_image); } catch (e) { imgDataUrl = null; } }
    // 无图时先剥离 {%product_image%} 占位（在 docxtemplater 解析前处理，避免残留）
    let zip = new PizZip(buf);
    const docXmlFile = zip.files['word/document.xml'];
    if (docXmlFile) {
      let xml = docXmlFile.asText();
      if (!imgDataUrl) xml = xml.replace(/\{%product_image%\}/g, '');
      zip.file('word/document.xml', xml);
      buf = zip.generate({ type: 'arraybuffer' });
    }
    const zip2 = new PizZip(buf);
    const doc = new docxtemplater(zip2, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' }
    });
    doc.render(data);
    let out = doc.getZip().generate({
      type: 'arraybuffer',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    if (imgDataUrl) out = injectImageIntoDocx(out, imgDataUrl, 160);
    return new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
  }

  // ---- 渲染 xlsx ----
  async function renderXlsx(buf, data) {
    const wb = XLSX.read(buf, { type: 'array' });
    const re = /\{\{\s*([\w]+)\s*\}\}/g;
    wb.SheetNames.forEach(sn => {
      const ws = wb.Sheets[sn];
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          const cell = ws[addr];
          if (cell && typeof cell.v === 'string') {
            let m; let out = cell.v; let changed = false;
            while ((m = re.exec(cell.v))) {
              const key = m[1].toLowerCase();
              const rep = (data[key] != null && data[key] !== '') ? data[key] : '';
              out = out.replace(m[0], rep); changed = true;
            }
            if (changed) { cell.v = out; cell.t = 's'; if (cell.w) delete cell.w; }
          }
        }
      }
    });
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  // ---- 生成 ----
  async function generate(type) {
    const msg = document.getElementById('docMsg');
    msg.textContent = '生成中…';
    try {
      const buf = await getSelectedTemplateBuf();
      const data = gatherData();
      // 图片来源：文档页手动上传优先，其次产品库图片
      const canon = buildCanonical();
      if (uploadedImage) data.product_image = uploadedImage;
      else if (canon.product_image) data.product_image = canon.product_image;
      // 金额/总价兜底计算
      if (data.qty && data.unit_price) {
        const up = parseFloat(String(data.unit_price).replace(/[^0-9.]/g, ''));
        const q = parseFloat(data.qty);
        if (!isNaN(up) && !isNaN(q)) { data.amount = '$' + (up * q).toFixed(2); }
      }
      if (data.amount) data.total = data.amount;
      if (type === 'pi') data.pi_no = data.pi_no || ('PI' + Date.now().toString().slice(-6));
      else data.quote_no = data.quote_no || ('Q' + Date.now().toString().slice(-6));

      let blob, fname;
      if (currentTplKind === 'xlsx') {
        blob = await renderXlsx(buf, data);
        fname = (type === 'pi' ? 'PI' : 'Quotation') + '_' + Date.now() + '.xlsx';
      } else {
        blob = await renderDocx(buf, data, !!data.product_image);
        fname = (type === 'pi' ? 'PI' : 'Quotation') + '_' + Date.now() + '.docx';
      }
      saveAs(blob, fname);
      msg.textContent = '✅ 已生成并下载：' + fname;
      WB.toast('文档已生成');
    } catch (e) {
      console.error(e);
      msg.textContent = '❌ 生成失败：' + (e.message || e);
      WB.toast('生成失败，查看控制台');
    }
  }

  async function init() {
    document.getElementById('uploadTplBtn').onclick = () => document.getElementById('tplFile').click();
    document.getElementById('refreshTplBtn').onclick = refreshTemplates;
    document.getElementById('tplFile').onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const buf = await file.arrayBuffer();
      const kind = file.name.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'docx';
      await WB.DB.saveTemplate({ name: file.name, kind, data: buf });
      WB.toast('模板已上传');
      await refreshTemplates();
    };
    document.getElementById('doc_template').onchange = onTemplateChange;
    document.getElementById('doc_product').onchange = () => buildFieldUI(currentPlaceholders, buildCanonical());
    document.getElementById('docFillFromProduct').onclick = () => { buildFieldUI(currentPlaceholders, buildCanonical()); WB.toast('已用产品填充'); };
    document.getElementById('genQuotation').onclick = () => generate('quotation');
    document.getElementById('genPI').onclick = () => generate('pi');
    setupImageUpload();
    await refreshTemplates();
    await WB.Products.refreshSelect('doc_product', true);
  }

  // 文档页图片上传：选图 → 预览 → 生成时插入文档
  function setupImageUpload() {
    const inp = document.getElementById('docImage');
    const prev = document.getElementById('docImgPreview');
    if (!inp) return;
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        uploadedImage = r.result;
        prev.classList.remove('hidden');
        prev.innerHTML = '<img src="' + uploadedImage + '" style="max-width:120px;max-height:120px;border-radius:10px;border:1px solid var(--line)" />';
        WB.toast('图片已就绪，将插入文档');
      };
      r.readAsDataURL(f);
    };
  }

  WB.Docs = { init, refreshTemplates, _lastCalc: null };
})(window);
