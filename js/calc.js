/* 外贸报价AI工作台 - 报价计算模块 */
(function (global) {
  'use strict';
  const WB = global.WB = global.WB || {};

  let tiers = []; // {minQty, discount}

  function $(id) { return document.getElementById(id); }

  function num(id, def) { const v = parseFloat($(id).value); return isNaN(v) ? def : v; }

  function renderTiers() {
    const box = $('tierList');
    box.innerHTML = '';
    tiers.forEach((t, i) => {
      const row = document.createElement('div');
      row.className = 'tier';
      row.innerHTML =
        '<input id="t_min_' + i + '" type="number" inputmode="numeric" placeholder="起订量(双)" value="' + (t.minQty || '') + '" />' +
        '<input id="t_dis_' + i + '" type="number" inputmode="decimal" placeholder="让利%" value="' + (t.discount || '') + '" />' +
        '<span class="out" id="t_out_' + i + '">—</span>' +
        '<button class="btn danger sm" style="width:auto;padding:8px 10px" data-del="' + i + '">✕</button>';
      box.appendChild(row);
      $('t_min_' + i).oninput = calcLive;
      $('t_dis_' + i).oninput = calcLive;
      row.querySelector('[data-del]').onclick = () => { tiers.splice(i, 1); renderTiers(); };
    });
  }

  function addTier() { tiers.push({ minQty: '', discount: '' }); renderTiers(); }

  function readInputs() {
    return {
      name: $('c_name').value.trim(),
      material: $('c_material').value.trim(),
      L: num('c_l', 0), W: num('c_w', 0), H: num('c_h', 0),
      ppc: num('c_ppc', 0),
      cost: num('c_cost', 0),
      dom: num('c_dom', 0),
      moq: num('c_moq', 0),
      rate: num('c_rate', 7.2),
      profit: num('c_profit', 0),
      incoterm: $('c_incoterm') ? $('c_incoterm').value : 'FOB',
      freight: num('c_freight', 0),
      insRate: num('c_ins', 0.8)
    };
  }

  // 计算 EXW / FOB / CIF 单价（USD/双）
  function computePrice(v) {
    const cost = v.cost, dom = v.dom, profit = v.profit, rate = v.rate;
    const exwRmb = cost * (1 + profit / 100);
    const exwUsd = exwRmb / rate;
    const fobRmb = (cost + dom) * (1 + profit / 100);
    const fobUsd = fobRmb / rate;
    let unitPrice = fobUsd, freight = 0, insurance = 0;
    if (v.incoterm === 'EXW') {
      unitPrice = exwUsd;
    } else if (v.incoterm === 'CIF') {
      freight = v.freight || 0;
      const r = (v.insRate || 0) / 100;          // 如 0.8 表示 0.8%
      const cif = (fobUsd + freight) / (1 - 1.1 * r); // 保险费按 CIF 金额110%计
      insurance = cif - (fobUsd + freight);
      unitPrice = cif;
    }
    return { cost, dom, profit, rate, incoterm: v.incoterm, exwRmb, exwUsd, fobRmb, fobUsd, freight, insurance, unitPrice };
  }

  function calcLive() {
    // 同步 tier 输入
    tiers.forEach((t, i) => {
      t.minQty = $('t_min_' + i) ? $('t_min_' + i).value : t.minQty;
      t.discount = $('t_dis_' + i) ? $('t_dis_' + i).value : t.discount;
    });
    const v = readInputs();
    if (v.cost <= 0 || v.rate <= 0) return;
    const { unitPrice } = computePrice(v);
    // 阶梯实时价
    tiers.forEach((t, i) => {
      const out = $('t_out_' + i);
      if (!out) return;
      const d = parseFloat(t.discount);
      out.textContent = isNaN(d) ? '—' : '$' + (unitPrice * (1 - d / 100)).toFixed(2);
    });
  }

  function onIncotermChange() {
    const t = $('c_incoterm').value;
    $('cifBox').classList.toggle('hidden', t !== 'CIF');
    // EXW 时灰显国内费用提示
    calcLive();
  }

  function doCalc() {
    const v = readInputs();
    if (v.cost <= 0) { WB.toast('请填写人民币成本'); return; }
    if (v.rate <= 0) { WB.toast('请填写汇率'); return; }
    const r = computePrice(v);
    const termLabel = { EXW: 'EXW 出厂价', FOB: 'FOB 基础价', CIF: 'CIF 到岸价' }[v.incoterm];

    // 结果卡
    $('r_base').innerHTML = '$' + r.unitPrice.toFixed(2) + ' <small>/双 (' + termLabel + ')</small>';
    $('r_rate').textContent = '术语 ' + v.incoterm + ' ｜ 汇率 ' + v.rate.toFixed(4) + ' ｜ 利润率 ' + v.profit + '% ｜ MOQ ' + v.moq + ' 双';

    // 明细
    const b = $('r_break');
    let html = line('人民币成本', '¥' + v.cost.toFixed(2) + ' /双');
    if (v.incoterm === 'EXW') {
      html += line('EXW 仅出厂价（不含国内/海运费）', '');
      html += line('加价后 (利润率 ' + v.profit + '%)', '¥' + r.exwRmb.toFixed(2) + ' /双');
      html += line('÷ 汇率 (' + v.rate.toFixed(4) + ')', '');
      html += line('<b>EXW 美金出厂单价</b>', '<b>$' + r.unitPrice.toFixed(2) + ' /双</b>');
    } else if (v.incoterm === 'FOB') {
      html += line('国内费用 (包装+内陆+港杂)', '¥' + v.dom.toFixed(2) + ' /双');
      html += line('加价后 (利润率 ' + v.profit + '%)', '¥' + r.fobRmb.toFixed(2) + ' /双');
      html += line('÷ 汇率 (' + v.rate.toFixed(4) + ')', '');
      html += line('<b>FOB 美金单价</b>', '<b>$' + r.unitPrice.toFixed(2) + ' /双</b>');
    } else {
      html += line('国内费用 (包装+内陆+港杂)', '¥' + v.dom.toFixed(2) + ' /双');
      html += line('FOB 加价后 (利润率 ' + v.profit + '%)', '¥' + r.fobRmb.toFixed(2) + ' /双');
      html += line('÷ 汇率 (' + v.rate.toFixed(4) + ')', '');
      html += line('FOB 美金单价', '$' + r.fobUsd.toFixed(2) + ' /双');
      html += line('+ 海运费', '$' + r.freight.toFixed(2) + ' /双');
      html += line('+ 保险费 (按110%×' + v.insRate + '%)', '$' + r.insurance.toFixed(2) + ' /双');
      html += line('<b>CIF 美金单价</b>', '<b>$' + r.unitPrice.toFixed(2) + ' /双</b>');
    }
    b.innerHTML = html;

    // 阶梯
    const tc = $('r_tiers_card'), tt = $('r_tiers');
    if (tiers.length && tiers.some(t => t.minQty && t.discount !== '')) {
      tc.classList.remove('hidden');
      let rows = '<tr><th>阶梯</th><th>起订量</th><th>让利</th><th>' + termLabel + '单价</th></tr>';
      tiers.forEach((t, i) => {
        const mq = parseFloat(t.minQty), d = parseFloat(t.discount);
        if (isNaN(mq) || isNaN(d)) return;
        rows += '<tr><td>' + (i + 1) + '</td><td>≥' + mq + ' 双</td><td>' + d + '%</td><td>$' + (r.unitPrice * (1 - d / 100)).toFixed(2) + '</td></tr>';
      });
      tt.innerHTML = rows;
    } else { tc.classList.add('hidden'); }

    // 装箱换算
    const pk = $('r_pack');
    if (v.L && v.W && v.H && v.ppc) {
      const cbmC = v.L * v.W * v.H / 1e6;
      const cbmP = cbmC / v.ppc;
      const cont = { '20GP': 28, '40GP': 58, '40HQ': 68 };
      let contRows = '';
      Object.keys(cont).forEach(k => {
        const cartons = Math.floor(cont[k] / cbmC);
        contRows += line(k + ' (' + cont[k] + ' CBM)', cartons + ' 箱 / ' + (cartons * v.ppc) + ' 双');
      });
      pk.innerHTML =
        line('外箱体积', cbmC.toFixed(4) + ' m³') +
        line('每双体积', cbmP.toFixed(5) + ' m³') +
        line('每箱装', v.ppc + ' 双') +
        contRows;
    } else {
      pk.innerHTML = '<div class="muted">填写完整装箱尺寸后可查看整柜装载量。</div>';
    }

    $('calcResult').classList.remove('hidden');
    WB.Docs._lastCalc = {
      unitPrice: r.unitPrice, incoterm: v.incoterm, name: v.name, material: v.material,
      freight: r.freight, insurance: r.insurance, fobUsd: r.fobUsd, exwUsd: r.exwUsd
    };
  }

  function line(k, v) { return '<div class="line"><span>' + k + '</span><b>' + v + '</b></div>'; }

  async function saveFromCalc() {
    const v = readInputs();
    const p = {
      name: v.name || ('产品' + Date.now()),
      material: v.material,
      sizeL: v.L, sizeW: v.W, sizeH: v.H, ppc: v.ppc,
      cost: v.cost, dom: v.dom, moq: v.moq, imageUrl: '', notes: ''
    };
    await WB.Products.save(p);
    WB.toast('已存入产品库');
    WB.go('products');
  }

  function gotoDocFromCalc() {
    WB.Docs._lastCalc = WB.Docs._lastCalc || {};
    WB.go('docs');
    setTimeout(() => { const b = $('docFillFromProduct'); if (b) b.click(); }, 50);
  }

  function init() {
    $('addTier').onclick = addTier;
    $('calcBtn').onclick = doCalc;
    $('saveFromCalc').onclick = saveFromCalc;
    $('gotoDocFromCalc').onclick = gotoDocFromCalc;
    $('c_incoterm').onchange = onIncotermChange;
    ['c_cost', 'c_dom', 'c_rate', 'c_profit', 'c_freight', 'c_ins'].forEach(id => $(id).addEventListener('input', calcLive));
    // 默认加一档阶梯
    tiers.push({ minQty: 1000, discount: 3 });
    tiers.push({ minQty: 3000, discount: 6 });
    renderTiers();
  }

  WB.Calc = { init };
})(window);
