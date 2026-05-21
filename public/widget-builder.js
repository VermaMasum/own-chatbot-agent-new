// ═══════════════════════════════════════════════════════════════════════════════
//  BotForge Widget Builder — Drag-and-Drop Chatbot Widget Designer
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Block catalog ────────────────────────────────────────────────────────────

const CATALOG = [
  {
    type: 'header',
    label: 'Chat Header',
    desc: 'Bot name, avatar & status',
    icon: `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
    singleton: true,
    required: false,
    defaultProps: () => ({
      botName: 'AI Assistant',
      showAvatar: true,
      showStatus: true,
      bgColor: '#4f46e5',
      textColor: '#ffffff',
    }),
  },
  {
    type: 'welcome',
    label: 'Welcome Message',
    desc: 'Opening greeting bubble',
    icon: `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="13" cy="10" r="1" fill="currentColor"/>`,
    singleton: false,
    required: false,
    defaultProps: () => ({
      text: 'Hi! How can I help you today? 👋',
    }),
  },
  {
    type: 'quick-replies',
    label: 'Quick Replies',
    desc: 'Pre-set suggestion buttons',
    icon: `<rect x="3" y="4" width="18" height="4" rx="2"/><rect x="3" y="11" width="11" height="4" rx="2"/><rect x="3" y="18" width="14" height="4" rx="2"/>`,
    singleton: false,
    required: false,
    defaultProps: () => ({
      buttons: ['What services do you offer?', 'How to get started?', 'Contact support'],
      outlineMode: true,
    }),
  },
  {
    type: 'chat-area',
    label: 'Chat Area',
    desc: 'Scrollable message history',
    icon: `<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>`,
    singleton: true,
    required: true,
    defaultProps: () => ({
      bgColor: '#f8fafc',
      height: 160,
    }),
  },
  {
    type: 'input-bar',
    label: 'Input Bar',
    desc: 'Text input & send button',
    icon: `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="10" x2="15" y2="10"/>`,
    singleton: true,
    required: true,
    defaultProps: () => ({
      placeholder: 'Type a message...',
      borderRadius: 8,
    }),
  },
  {
    type: 'powered-by',
    label: 'Powered By Badge',
    desc: 'Footer attribution text',
    icon: `<path d="M13 2L4.5 13.5H11L10 22L19.5 10H13L13 2Z"/>`,
    singleton: true,
    required: false,
    defaultProps: () => ({
      text: 'Powered by BotForge',
      link: '',
    }),
  },
];

// ─── State ────────────────────────────────────────────────────────────────────

let _uid = 0;
const uid = () => `b${++_uid}`;

const DEFAULT_COLOR = '#4f46e5';

function makeBlock(type) {
  const cat = CATALOG.find(c => c.type === type);
  const props = cat.defaultProps();
  if (type === 'header') props.bgColor = state.primaryColor;
  return { id: uid(), type, props };
}

const state = {
  blocks: [],
  selectedId: null,
  primaryColor: DEFAULT_COLOR,
  botId: '',
  exportTab: 'script',
  drag: null, // { source:'palette'|'canvas', blockType?, blockId? }
};

// Build initial default layout
function buildDefault() {
  state.blocks = [];
  state.selectedId = null;
  ['header', 'welcome', 'quick-replies', 'chat-area', 'input-bar', 'powered-by'].forEach(t => {
    state.blocks.push(makeBlock(t));
  });
}

buildDefault();

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const paletteList   = document.getElementById('paletteList');
const widgetCanvas  = document.getElementById('widgetCanvas');
const propsPanel    = document.getElementById('propsPanel');
const globalColor   = document.getElementById('globalColor');
const globalBotId   = document.getElementById('globalBotId');
const exportCode    = document.getElementById('exportCode');
const exportCopyBtn = document.getElementById('exportCopyBtn');
const resetBtn      = document.getElementById('resetBtn');

// ─── Bootstrap ────────────────────────────────────────────────────────────────

// Auto-fill botId from URL param (e.g. /widget-builder?botId=abc123)
const _urlBotId = new URLSearchParams(window.location.search).get('botId');
if (_urlBotId) {
  state.botId = _urlBotId;
  globalBotId.value = _urlBotId;
}

renderAll();

// ─── Global controls ─────────────────────────────────────────────────────────

globalColor.addEventListener('input', () => {
  state.primaryColor = globalColor.value;
  const hdr = state.blocks.find(b => b.type === 'header');
  if (hdr) hdr.props.bgColor = state.primaryColor;
  renderCanvas();
  renderProps();
  renderExport();
});

globalBotId.addEventListener('input', () => {
  state.botId = globalBotId.value.trim();
  renderExport();
});

resetBtn.addEventListener('click', () => {
  if (!confirm('Reset widget to defaults? All customizations will be lost.')) return;
  buildDefault();
  globalColor.value = DEFAULT_COLOR;
  state.primaryColor = DEFAULT_COLOR;
  state.botId = '';
  state.exportTab = 'script';
  globalBotId.value = '';
  document.querySelectorAll('.wb-etab').forEach(b => b.classList.toggle('et-active', b.dataset.tab === 'script'));
  renderAll();
});

document.querySelectorAll('.wb-etab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.wb-etab').forEach(b => b.classList.remove('et-active'));
    btn.classList.add('et-active');
    state.exportTab = btn.dataset.tab;
    renderExport();
  });
});

exportCopyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(exportCode.value);
  } catch {
    exportCode.select();
    document.execCommand('copy');
  }
  exportCopyBtn.textContent = 'Copied!';
  exportCopyBtn.classList.add('wc-copied');
  setTimeout(() => {
    exportCopyBtn.textContent = 'Copy';
    exportCopyBtn.classList.remove('wc-copied');
  }, 2200);
});

// ─── Main render orchestrator ─────────────────────────────────────────────────

function renderAll() {
  renderPalette();
  renderCanvas();
  renderProps();
  renderExport();
}

// ─── Palette ─────────────────────────────────────────────────────────────────

function renderPalette() {
  const usedSingletons = new Set(
    state.blocks.filter(b => CATALOG.find(c => c.type === b.type)?.singleton).map(b => b.type)
  );

  paletteList.innerHTML = CATALOG.map(cat => {
    const used = cat.singleton && usedSingletons.has(cat.type);
    const badge = used
      ? `<span class="pb-badge pb-badge-done">Added</span>`
      : cat.required
        ? `<span class="pb-badge pb-badge-req">Required</span>`
        : '';
    return `
      <div class="wb-palette-block ${used ? 'pb-used' : ''}"
           data-ptype="${cat.type}"
           draggable="${!used}"
           title="${used ? cat.label + ' already added' : 'Drag to add ' + cat.label}">
        <div class="pb-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${cat.icon}</svg>
        </div>
        <div class="pb-info">
          <div class="pb-name">${cat.label}</div>
          <div class="pb-desc">${cat.desc}</div>
        </div>
        ${badge}
      </div>`;
  }).join('');

  // Palette drag events
  paletteList.querySelectorAll('.wb-palette-block[draggable="true"]').forEach(el => {
    el.addEventListener('dragstart', e => {
      state.drag = { source: 'palette', blockType: el.dataset.ptype };
      e.dataTransfer.effectAllowed = 'copy';
      el.classList.add('pb-dragging');
    });
    el.addEventListener('dragend', () => {
      state.drag = null;
      el.classList.remove('pb-dragging');
    });
  });
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

function renderCanvas() {
  if (state.blocks.length === 0) {
    widgetCanvas.innerHTML = `
      <div class="wb-empty">
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        <p>Drag blocks from the left<br>panel to build your widget</p>
      </div>`;
    wireEmptyDrop();
    return;
  }

  const parts = [dropZone(0)];
  state.blocks.forEach((block, i) => {
    parts.push(blockHtml(block));
    parts.push(dropZone(i + 1));
  });
  widgetCanvas.innerHTML = parts.join('');

  // Wire canvas blocks
  widgetCanvas.querySelectorAll('.wb-cblock').forEach(el => {
    const bid = el.dataset.bid;

    el.addEventListener('click', e => {
      if (e.target.closest('.wb-cbtn')) return;
      state.selectedId = state.selectedId === bid ? null : bid;
      widgetCanvas.querySelectorAll('.wb-cblock').forEach(b =>
        b.classList.toggle('cb-selected', b.dataset.bid === state.selectedId));
      renderProps();
    });

    el.addEventListener('dragstart', e => {
      e.stopPropagation();
      state.drag = { source: 'canvas', blockId: bid };
      e.dataTransfer.effectAllowed = 'move';
      el.classList.add('cb-dragging');
    });

    el.addEventListener('dragend', () => {
      state.drag = null;
      el.classList.remove('cb-dragging');
    });

    const delBtn = el.querySelector('.cb-del');
    if (delBtn) {
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        const idx = state.blocks.findIndex(b => b.id === bid);
        if (idx !== -1) state.blocks.splice(idx, 1);
        if (state.selectedId === bid) state.selectedId = null;
        renderAll();
      });
    }
  });

  // Wire drop zones
  widgetCanvas.querySelectorAll('.wb-dz').forEach(el => {
    const insertAt = parseInt(el.dataset.idx);

    el.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = state.drag?.source === 'canvas' ? 'move' : 'copy';
      el.classList.add('dz-active');
    });

    el.addEventListener('dragleave', () => el.classList.remove('dz-active'));

    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('dz-active');
      handleDrop(insertAt);
    });
  });
}

function dropZone(idx) {
  return `<div class="wb-dz" data-idx="${idx}"></div>`;
}

function wireEmptyDrop() {
  widgetCanvas.addEventListener('dragover', e => {
    e.preventDefault();
    widgetCanvas.style.outline = '2px dashed var(--primary)';
  });
  widgetCanvas.addEventListener('dragleave', () => {
    widgetCanvas.style.outline = '';
  });
  widgetCanvas.addEventListener('drop', e => {
    e.preventDefault();
    widgetCanvas.style.outline = '';
    handleDrop(0);
  }, { once: true });
}

function handleDrop(insertAt) {
  if (!state.drag) return;

  if (state.drag.source === 'palette') {
    const cat = CATALOG.find(c => c.type === state.drag.blockType);
    if (!cat) return;
    if (cat.singleton && state.blocks.some(b => b.type === cat.type)) return;
    const newBlock = makeBlock(cat.type);
    state.blocks.splice(insertAt, 0, newBlock);
    state.selectedId = newBlock.id;
  } else if (state.drag.source === 'canvas') {
    const fromIdx = state.blocks.findIndex(b => b.id === state.drag.blockId);
    if (fromIdx === -1) return;
    const [block] = state.blocks.splice(fromIdx, 1);
    const adjusted = insertAt > fromIdx ? insertAt - 1 : insertAt;
    state.blocks.splice(adjusted, 0, block);
  }

  state.drag = null;
  renderAll();
}

// ─── Block HTML generators ────────────────────────────────────────────────────

function blockHtml(block) {
  const cat = CATALOG.find(c => c.type === block.type);
  const isReq = cat?.required;
  const isSel = state.selectedId === block.id;
  const pc    = state.primaryColor;

  const inner = {
    'header':        headerHtml(block.props, pc),
    'welcome':       welcomeHtml(block.props, pc),
    'quick-replies': qrHtml(block.props, pc),
    'chat-area':     chatAreaHtml(block.props, pc),
    'input-bar':     inputBarHtml(block.props, pc),
    'powered-by':    poweredByHtml(block.props),
  }[block.type] || '';

  const delBtn = isReq
    ? ''
    : `<button class="wb-cbtn cb-del" title="Remove block" type="button">
         <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
       </button>`;

  return `
    <div class="wb-cblock ${isSel ? 'cb-selected' : ''}" data-bid="${block.id}" draggable="true">
      ${inner}
      <div class="wb-ctrls">
        <button class="wb-cbtn cb-drag" title="Drag to reorder" type="button">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="9"  cy="4" r="1.2" fill="currentColor" stroke="none"/>
            <circle cx="15" cy="4" r="1.2" fill="currentColor" stroke="none"/>
            <circle cx="9"  cy="12" r="1.2" fill="currentColor" stroke="none"/>
            <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none"/>
            <circle cx="9"  cy="20" r="1.2" fill="currentColor" stroke="none"/>
            <circle cx="15" cy="20" r="1.2" fill="currentColor" stroke="none"/>
          </svg>
        </button>
        ${delBtn}
      </div>
    </div>`;
}

function headerHtml(p, pc) {
  const bg   = p.bgColor  || pc;
  const tc   = p.textColor || '#fff';
  const init = (p.botName || 'A')[0].toUpperCase();
  return `
    <div class="bv-header" style="background:${bg};color:${tc}">
      ${p.showAvatar !== false ? `<div class="bv-avatar">${esc(init)}</div>` : ''}
      <div class="bv-hinfo">
        <div class="bv-hname">${esc(p.botName || 'AI Assistant')}</div>
        ${p.showStatus !== false ? '<div class="bv-hstatus">Online</div>' : ''}
      </div>
      <div class="bv-hclose">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${tc}" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </div>
    </div>`;
}

function welcomeHtml(p, pc) {
  return `
    <div class="bv-welcome">
      <div class="bv-wmsg">
        <div class="bv-msav" style="background:${pc}">A</div>
        <div class="bv-bubble">${esc(p.text || '')}</div>
      </div>
    </div>`;
}

function qrHtml(p, pc) {
  const btns = (p.buttons || []).map(b => {
    const style = p.outlineMode !== false
      ? `color:${pc};border-color:${pc};background:transparent`
      : `background:${pc};color:#fff;border-color:${pc}`;
    return `<button class="bv-qr-btn" style="${style}">${esc(b)}</button>`;
  }).join('');
  return `<div class="bv-qr">${btns || '<span style="font-size:.72rem;color:#94a3b8">No buttons yet — add in properties panel</span>'}</div>`;
}

function chatAreaHtml(p, pc) {
  return `
    <div class="bv-chatarea" style="height:${p.height || 160}px;background:${p.bgColor || '#f8fafc'}">
      <div class="bv-bmsg">
        <div class="bv-msav" style="background:${pc};width:24px;height:24px;font-size:.62rem">A</div>
        <div class="bv-bubble" style="font-size:.76rem">Sure! I'd be happy to help you with that.</div>
      </div>
      <div class="bv-umsg">
        <div class="bv-ububble" style="background:${pc};font-size:.76rem">What are your opening hours?</div>
      </div>
      <div class="bv-bmsg">
        <div class="bv-msav" style="background:${pc};width:24px;height:24px;font-size:.62rem">A</div>
        <div class="bv-bubble" style="font-size:.76rem">We're available 24/7 through this chatbot!</div>
      </div>
    </div>`;
}

function inputBarHtml(p, pc) {
  const r = p.borderRadius ?? 8;
  return `
    <div class="bv-inputbar">
      <div class="bv-inputfield" style="border-radius:${r}px">${esc(p.placeholder || 'Type a message...')}</div>
      <button class="bv-sendbtn" style="background:${pc};border-radius:${r}px">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2" fill="#fff" stroke="none"/>
        </svg>
      </button>
    </div>`;
}

function poweredByHtml(p) {
  return `<div class="bv-poweredby">${esc(p.text || 'Powered by BotForge')}</div>`;
}

// ─── Properties panel ─────────────────────────────────────────────────────────

function renderProps() {
  const block = state.blocks.find(b => b.id === state.selectedId);

  if (!block) {
    propsPanel.innerHTML = `
      <div class="wp-empty">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
        </svg>
        <p>Click a block to<br>edit its properties</p>
      </div>`;
    return;
  }

  const cat = CATALOG.find(c => c.type === block.type);

  let fields = '';
  switch (block.type) {
    case 'header':
      fields = `
        ${fText('botName',    'Bot Name',      block.props.botName)}
        ${fColor('bgColor',   'Header Color',  block.props.bgColor  || state.primaryColor)}
        ${fColor('textColor', 'Text Color',    block.props.textColor || '#ffffff')}
        ${fDivider()}
        ${fToggle('showAvatar', 'Show Avatar',        block.props.showAvatar !== false)}
        ${fToggle('showStatus', 'Show Online Status',  block.props.showStatus !== false)}`;
      break;

    case 'welcome':
      fields = fTextarea('text', 'Message Text', block.props.text);
      break;

    case 'quick-replies':
      fields = `
        ${fQR(block.props.buttons || [])}
        ${fDivider()}
        ${fToggle('outlineMode', 'Outline style (vs filled)', block.props.outlineMode !== false)}`;
      break;

    case 'chat-area':
      fields = `
        ${fColor('bgColor', 'Background Color', block.props.bgColor || '#f8fafc')}
        ${fRange('height', 'Height (px)', block.props.height ?? 160, 80, 320)}`;
      break;

    case 'input-bar':
      fields = `
        ${fText('placeholder', 'Placeholder Text', block.props.placeholder)}
        ${fRange('borderRadius', 'Border Radius', block.props.borderRadius ?? 8, 0, 24)}`;
      break;

    case 'powered-by':
      fields = `
        ${fText('text', 'Badge Text', block.props.text)}
        ${fText('link', 'Link URL (optional)', block.props.link || '')}`;
      break;
  }

  propsPanel.innerHTML = `
    <div class="wp-blk-label">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${cat.icon}</svg>
      ${cat.label}
    </div>
    ${fields}`;

  // ── Wire up all prop inputs ──

  propsPanel.querySelectorAll('[data-prop]').forEach(el => {
    const prop = el.dataset.prop;

    const update = () => {
      let val = el.value;
      if (el.type === 'range') val = parseInt(val, 10);
      block.props[prop] = val;

      // Sync color swatch ↔ hex text
      if (el.dataset.pairHex)   document.getElementById(el.dataset.pairHex).value   = val;
      if (el.dataset.pairColor) document.getElementById(el.dataset.pairColor).value = val;

      renderCanvas();
      renderExport();
    };

    el.addEventListener('input', update);
    if (el.type === 'color') el.addEventListener('change', update);
  });

  // ── Toggle buttons ──
  propsPanel.querySelectorAll('.wp-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const prop = btn.dataset.prop;
      block.props[prop] = !block.props[prop];
      btn.classList.toggle('t-on', !!block.props[prop]);
      renderCanvas();
      renderExport();
    });
  });

  // ── Quick reply management ──
  const qrInput = propsPanel.querySelector('#qrNewInput');
  const qrAddBtn = propsPanel.querySelector('#qrAddBtn');

  if (qrInput && qrAddBtn) {
    const addQR = () => {
      const val = qrInput.value.trim();
      if (!val) return;
      if (!Array.isArray(block.props.buttons)) block.props.buttons = [];
      block.props.buttons.push(val);
      qrInput.value = '';
      renderCanvas();
      renderProps();
      renderExport();
    };
    qrAddBtn.addEventListener('click', addQR);
    qrInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addQR(); } });
  }

  propsPanel.querySelectorAll('.qr-rm').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      block.props.buttons.splice(idx, 1);
      renderCanvas();
      renderProps();
      renderExport();
    });
  });
}

// ─── Property field builders ──────────────────────────────────────────────────

function fText(prop, label, value = '') {
  return `
    <div class="wp-field">
      <label class="wp-label">${label}</label>
      <input class="wp-input" type="text" data-prop="${prop}" value="${esc(String(value))}" />
    </div>`;
}

function fTextarea(prop, label, value = '') {
  return `
    <div class="wp-field">
      <label class="wp-label">${label}</label>
      <textarea class="wp-textarea" data-prop="${prop}">${esc(String(value))}</textarea>
    </div>`;
}

function fColor(prop, label, value = '#000000') {
  const swId  = `sw-${prop}`;
  const hexId = `hx-${prop}`;
  return `
    <div class="wp-field">
      <label class="wp-label">${label}</label>
      <div class="wp-color-row">
        <input type="color" class="wp-cswatch" id="${swId}"
               data-prop="${prop}" data-pair-hex="${hexId}" value="${value}" />
        <input type="text" class="wp-input" id="${hexId}"
               data-prop="${prop}" data-pair-color="${swId}" value="${value}" maxlength="7"
               style="font-family:monospace" />
      </div>
    </div>`;
}

function fRange(prop, label, value, min, max) {
  const valId = `rv-${prop}`;
  return `
    <div class="wp-field">
      <div class="wp-range-label">
        <label class="wp-label" style="margin:0">${label}</label>
        <span class="wp-label wp-range-val" id="${valId}">${value}</span>
      </div>
      <input type="range" class="wp-range" data-prop="${prop}"
             min="${min}" max="${max}" value="${value}"
             oninput="document.getElementById('${valId}').textContent=this.value" />
    </div>`;
}

function fToggle(prop, label, value) {
  return `
    <div class="wp-field">
      <div class="wp-toggle-row">
        <button class="wp-toggle ${value ? 't-on' : ''}" data-prop="${prop}" type="button"></button>
        <label class="wp-label" style="margin:0">${label}</label>
      </div>
    </div>`;
}

function fQR(buttons) {
  const tags = buttons.map((b, i) => `
    <span class="qr-tag">
      <span title="${esc(b)}">${esc(b)}</span>
      <button class="qr-rm" data-idx="${i}" type="button" title="Remove">✕</button>
    </span>`).join('');
  return `
    <div class="wp-field">
      <label class="wp-label">Quick Reply Buttons</label>
      <div class="qr-tags">
        ${tags || '<span style="font-size:.72rem;color:var(--text-muted)">No buttons yet</span>'}
      </div>
      <div class="qr-add-row">
        <input class="qr-add-input" id="qrNewInput" type="text" placeholder="Button label…" maxlength="50" />
        <button class="qr-add-btn" id="qrAddBtn" type="button">Add</button>
      </div>
    </div>`;
}

function fDivider() {
  return `<div class="wp-divider"></div>`;
}

// ─── Export code ─────────────────────────────────────────────────────────────

function renderExport() {
  const botId  = state.botId || '[BOT_ID]';
  const origin = window.location.origin;
  const pc     = state.primaryColor;

  const headerBlock   = state.blocks.find(b => b.type === 'header');
  const welcomeBlock  = state.blocks.find(b => b.type === 'welcome');

  const label    = headerBlock?.props?.botName || 'Chat with us';
  const greeting = welcomeBlock?.props?.text || '';
  const position = 'bottom-right';

  let code = '';

  if (state.exportTab === 'script') {
    const attrPairs = [
      `src="${origin}/embed/${botId}.js"`,
      `data-bot-id="${botId}"`,
      `data-color="${pc}"`,
      `data-label="${escAttr(label)}"`,
      `data-position="${position}"`,
      greeting ? `data-greeting="${escAttr(greeting)}"` : null,
      'async',
    ].filter(Boolean);
    code = `<script\n  ${attrPairs.join('\n  ')}\n><\/script>`;
  } else {
    const params = new URLSearchParams({ color: pc, label, ...(greeting ? { greeting } : {}) });
    code = `<iframe\n  src="${origin}/bot/${botId}?${params}"\n  width="400"\n  height="620"\n  frameborder="0"\n  allow="microphone"\n  style="border:none;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.15);"\n></iframe>`;
  }

  exportCode.value = code;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(s) {
  return String(s)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
