import { createState, transition } from './state.js';
import { greetingText, osagoText } from './phrases.js';

const root = document.querySelector('#app');
let content;
let objections;
let client;
let state;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function readMode() {
  try { return localStorage.getItem('alternativa-assistant-mode'); } catch { return null; }
}

function saveMode(mode) {
  try { localStorage.setItem('alternativa-assistant-mode', mode); } catch { /* Storage may be unavailable in an embedded context. */ }
}

function stageText(stage, brief) {
  if (stage.id === 'greeting') return brief ? content.greeting.brief : greetingText(content, client);
  if (stage.id === 'osago') return osagoText(content, client, brief);
  return brief ? stage.brief : stage.full;
}

function miniDetails() {
  const ui = content.ui;
  const mini = client.miniKasko;
  if (!mini?.confirmed) return `<p class="detail-empty">${escapeHtml(ui.miniNoDetails)}</p>`;
  const fields = [
    [ui.insurer, mini.insurer],
    [ui.price, Number.isFinite(mini.price) && mini.price > 0 ? `${new Intl.NumberFormat('ru-RU').format(mini.price)} ${ui.rubles}` : null],
    [ui.risks, Array.isArray(mini.risks) ? mini.risks.join(', ') : null],
    [ui.limit, mini.limit],
    [ui.exclusions, mini.exclusions]
  ].filter(([, value]) => value);
  if (!fields.length) return `<p class="detail-empty">${escapeHtml(ui.miniNoDetails)}</p>`;
  return `<div class="detail-list"><h3>${escapeHtml(ui.miniDetails)}</h3>${fields.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</div>`;
}

function renderObjections() {
  const ui = content.ui;
  if (!state.objectionOpen) return '';
  const selected = objections.items.find(item => item.id === state.selectedObjection) || objections.items[0];
  return `<section class="objection-panel" aria-label="${escapeHtml(ui.objectionTitle)}">
    <div class="objection-head"><div><span class="eyebrow">${escapeHtml(ui.objectionTitle)}</span><h2>${escapeHtml(selected.label)}</h2></div><button type="button" class="close-button" data-action="closeObjections">${escapeHtml(ui.close)}</button></div>
    <p class="objection-answer">${escapeHtml(selected.answer)}</p>
    ${selected.status === 'draft' ? `<p class="draft-note">${escapeHtml(ui.objectionDraft)}</p>` : ''}
    <div class="objection-choices">${objections.items.map(item => `<button type="button" data-action="selectObjection" data-value="${escapeHtml(item.id)}" class="objection-chip ${item.id === selected.id ? 'selected' : ''}" aria-pressed="${item.id === selected.id}">${escapeHtml(item.label)}</button>`).join('')}</div>
  </section>`;
}

function render() {
  const ui = content.ui;
  const stage = content.stages[state.stageIndex];
  const expert = state.mode === 'expert';
  const intro = stageText(stage, expert);
  let notice = '';
  if (state.notice === 'callback' || state.notice === 'difference') notice = ui[state.notice];
  if (state.notice === 'miniNo') notice = ui.miniDeclined;
  if (state.notice === 'miniYes') notice = ui.miniInterested;
  const actions = stage.actions.map(action => `<button type="button" class="action ${action.kind}" data-action="${escapeHtml(action.id)}">${escapeHtml(action.label)}</button>`).join('');

  root.innerHTML = `<div class="widget">
    <header class="masthead">
      <div><div class="brand">${escapeHtml(ui.brand)}<span class="brand-rule"></span>${escapeHtml(ui.appName)}</div><p class="demo-label">${escapeHtml(ui.demo)}</p></div>
      <div class="mode-control" role="group" aria-label="${escapeHtml(ui.mode)}"><span>${escapeHtml(ui.mode)}</span><button type="button" data-action="mode" data-value="novice" aria-pressed="${!expert}" class="mode-button ${!expert ? 'active' : ''}">${escapeHtml(ui.novice)}</button><button type="button" data-action="mode" data-value="expert" aria-pressed="${expert}" class="mode-button ${expert ? 'active' : ''}">${escapeHtml(ui.expert)}</button></div>
    </header>
    <section class="client-strip" aria-label="${escapeHtml(ui.demo)}">
      ${[[ui.client, client.clientName], [ui.vehicle, client.vehicle], [ui.expiry, client.expiryDate]].map(([label, value]) => `<div class="client-cell"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || ui.unknown)}</strong></div>`).join('')}
    </section>
    <nav class="stage-nav" aria-label="${escapeHtml(ui.stage)}">${content.stages.map((item, index) => `<button type="button" data-action="stage" data-value="${index}" ${index > state.maxReached ? 'disabled' : ''} class="stage-link ${index === state.stageIndex ? 'current' : ''}"><span>${String(index + 1).padStart(2, '0')}</span><span>${escapeHtml(item.title)}</span></button>`).join('')}</nav>
    <div class="main-grid">
      <section class="script-panel" aria-labelledby="stage-heading">
        <div class="stage-heading"><span class="stage-number">${String(state.stageIndex + 1).padStart(2, '0')}</span><div><span class="eyebrow">${escapeHtml(ui.stage)} ${state.stageIndex + 1} / ${content.stages.length}</span><h1 id="stage-heading">${escapeHtml(stage.title)}</h1></div></div>
        ${!expert ? `<div class="goal"><span class="eyebrow">${escapeHtml(ui.goal)}</span><p>${escapeHtml(stage.goal)}</p></div>` : ''}
        <blockquote class="script-text">${escapeHtml(intro)}</blockquote>
        ${state.stageIndex === 2 && state.need ? `<p class="context-hint">${escapeHtml(content.needHints[state.need])}</p>` : ''}
        ${notice ? `<div class="notice" role="status">${escapeHtml(notice)}</div>` : ''}
        ${state.stageIndex === 3 && state.detailsOpen ? `<div class="mini-details">${miniDetails()}</div>` : ''}
        ${state.stageIndex === 4 && state.outcome ? `<div class="outcome" role="status"><span class="eyebrow">${escapeHtml(ui.finished)}</span><p>${escapeHtml(content.outcomes[state.outcome])}</p></div>` : ''}
        <div class="actions">${actions}${state.stageIndex === 3 ? `<button type="button" class="action forward" data-action="toFinish">${escapeHtml(ui.continue)}</button>` : ''}${state.stageIndex === 4 && state.outcome ? `<button type="button" class="action restart" data-action="restart">${escapeHtml(ui.restart)}</button>` : ''}</div>
        ${!expert ? `<div class="coaching"><div><span class="eyebrow">${escapeHtml(ui.possibleAnswers)}</span><p>${escapeHtml(stage.possibleAnswers)}</p></div><div><span class="eyebrow">${escapeHtml(ui.nextStep)}</span><p>${escapeHtml(stage.guidance)}</p></div></div>` : ''}
        <div class="panel-footer">${state.stageIndex > 0 ? `<button type="button" class="back-button" data-action="back">${escapeHtml(ui.back)}</button>` : '<span></span>'}<button type="button" class="objections-button" data-action="objections" aria-expanded="${state.objectionOpen}">${escapeHtml(ui.objections)}<span class="button-count">${objections.items.length}</span></button></div>
      </section>
      ${renderObjections()}
    </div>
    <footer class="app-note">${escapeHtml(ui.demoNote)}</footer>
  </div>`;
}

root.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button || button.disabled) return;
  state = transition(state, button.dataset.action, button.dataset.value);
  if (button.dataset.action === 'mode') saveMode(state.mode);
  render();
});

try {
  const [scriptResponse, objectionResponse, clientResponse] = await Promise.all([
    fetch('./src/scripts/osago.json'),
    fetch('./src/scripts/objections.json'),
    fetch('./src/scripts/demo-client.json')
  ]);
  if (![scriptResponse, objectionResponse, clientResponse].every(response => response.ok)) throw new Error('Ошибка загрузки JSON');
  [content, objections, client] = await Promise.all([scriptResponse.json(), objectionResponse.json(), clientResponse.json()]);
  state = createState(readMode());
  render();
} catch {
  root.innerHTML = '<p class="load-error">Не удалось загрузить сценарий. Запустите локальный сервер по инструкции в README.md.</p>';
}
