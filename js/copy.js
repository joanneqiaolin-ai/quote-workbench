/* 外贸报价AI工作台 - 商务文案模块（模板+智能填充，无需联网） */
(function (global) {
  'use strict';
  const WB = global.WB = global.WB || {};

  let type = 'reply'; // reply | dev
  let style = 'new';

  function $(id) { return document.getElementById(id); }

  function init() {
    document.querySelectorAll('#copyType .chip').forEach(c => {
      c.onclick = () => {
        document.querySelectorAll('#copyType .chip').forEach(x => x.classList.remove('sel'));
        c.classList.add('sel');
        type = c.dataset.type;
        $('devStyle').parentElement.style.display = type === 'dev' ? '' : 'none';
      };
    });
    $('devStyle').parentElement.style.display = 'none';
    $('devStyle').onchange = () => style = $('devStyle').value;
    $('genCopy').onclick = gen;
    $('copyCopy').onclick = () => {
      const txt = $('copyText').innerText;
      navigator.clipboard.writeText(txt).then(() => WB.toast('已复制')).catch(() => WB.toast('复制失败，请手动选择'));
    };
  }

  function inputs() {
    return {
      cust: $('cp_cust').value.trim(),
      prod: $('cp_prod').value.trim(),
      price: $('cp_price').value.trim(),
      moq: $('cp_moq').value.trim(),
      ctx: $('cp_ctx').value.trim(),
      tone: $('cp_tone').value
    };
  }

  const OPEN = {
    pro: ['Thank you for your inquiry.', 'We appreciate your interest in our products.'],
    warm: ['Great to hear from you!', 'It’s a pleasure to connect with you.'],
    firm: ['Thanks for reaching out.', 'We have received your message.']
  };
  const CLOSE = {
    pro: 'We look forward to the possibility of working together.',
    warm: 'Hope to build a long-term friendship and business with you!',
    firm: 'Please let us know your decision at your convenience.'
  };

  function gen() {
    const i = inputs();
    if (type === 'reply') {
      if (!i.ctx) { WB.toast('请填写客户问题/背景'); return; }
      $('copyText').innerText = buildReply(i);
    } else {
      $('copyText').innerText = buildDev(i);
    }
    $('copyResult').classList.remove('hidden');
    WB.toast('文案已生成');
  }

  function buildReply(i) {
    const open = pick(OPEN[i.tone]);
    const cust = i.cust ? i.cust + ', ' : '';
    let body = '';
    const ctx = i.ctx.toLowerCase();
    const points = [];
    if (ctx.includes('moq') || ctx.includes('起订') || ctx.includes('最小')) {
      points.push('• MOQ: ' + (i.moq || '500 pairs') + ' per style/color. Negotiable for trial orders.');
    }
    if (ctx.includes('price') || ctx.includes('报价') || ctx.includes('价') || ctx.includes('quote')) {
      points.push('• Price: FOB Jinjiang ' + (i.price || 'XX USD/pair') + ' (based on your quantity, tiered pricing available).');
    }
    if (ctx.includes('sample') || ctx.includes('样')) {
      points.push('• Samples: available; sample cost can be deducted from the first official order.');
    }
    if (ctx.includes('deliver') || ctx.includes('lead') || ctx.includes('交期') || ctx.includes('发货') || ctx.includes('ship')) {
      points.push('• Lead time: 45–60 days after deposit confirmation.');
    }
    if (ctx.includes('certif') || ctx.includes('ce') || ctx.includes('safety') || ctx.includes('认证') || ctx.includes('钢头')) {
      points.push('• Certification: CE / EN ISO 20345 available for safety shoes upon request.');
    }
    if (!points.length) {
      points.push('• Product: ' + (i.prod || 'as discussed'));
      points.push('• FOB Jinjiang price: ' + (i.price || 'XX USD/pair') + (i.moq ? '  |  MOQ: ' + i.moq : ''));
      points.push('• Lead time: 45–60 days after deposit.');
    }
    body = 'Dear ' + cust + '\n\n' + open + '\n\nRegarding your message:\n' + points.join('\n') + '\n\n' +
      'We are a professional manufacturer based in Jinjiang, the shoe capital of China, specializing in safety shoes and steel-toe footwear. ' +
      'We support OEM/ODM and can provide photos, specs and test reports for your evaluation.\n\n' +
      CLOSE[i.tone] + '\n\nBest regards,\n' + (WB._company || 'Your Name') + '\nSales Manager';
    return body;
  }

  function buildDev(i) {
    const open = pick(OPEN[i.tone]);
    const cust = i.cust ? i.cust + ', ' : '';
    let lead = '';
    if (style === 'new') {
      lead = 'We are excited to introduce our latest ' + (i.prod || 'safety shoe series') +
        ', engineered for comfort and certified protection. FOB Jinjiang ' + (i.price || 'competitive pricing') +
        (i.moq ? ', MOQ ' + i.moq : '') + '.';
    } else if (style === 'renew') {
      lead = 'It has been a while since we last connected. We’d love to revive our cooperation with an exclusive offer on our ' +
        (i.prod || 'best-selling models') + ' at FOB Jinjiang ' + (i.price || 'updated pricing') + '.';
    } else {
      lead = 'Thank you for visiting our booth / meeting us at the fair. As promised, here is our ' +
        (i.prod || 'catalog highlight') + ' — FOB Jinjiang ' + (i.price || 'factory price') +
        (i.moq ? ', MOQ ' + i.moq : '') + '.';
    }
    return 'Dear ' + cust + '\n\n' + open + '\n\n' + lead + '\n\n' +
      'Why choose us:\n' +
      '• 15+ years manufacturing in Jinjiang, full production control\n' +
      '• Steel-toe / composite-toe, CE certified, OEM & ODM supported\n' +
      '• Fast sampling and stable lead time (45–60 days)\n\n' +
      'I’m attaching our catalog for your review. Would you like a quote based on your target specs?\n\n' +
      CLOSE[i.tone] + '\n\nBest regards,\n' + (WB._company || 'Your Name') + '\nSales Manager';
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  WB.Copy = { init };
})(window);
