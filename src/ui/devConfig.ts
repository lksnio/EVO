import {
  changedCount, exportTuning, GROUPS, importTuning, isChanged, resetAll, resetParam, setParam, SPECIES_ROWS, type Param,
} from '../data/tuning';

// Die Entwickler-Einstellung als Seite über dem Spiel (HTML statt Canvas: viele Zahlenfelder, Suchen, Kopieren). Tasten, die
// hier getippt werden, erreichen das Spiel nicht.

const CSS = `
.evo-dev { position: fixed; inset: 0; z-index: 1000; display: flex; justify-content: center; background: rgba(4,4,3,0.88);
  font-family: "Alegreya Sans", "Trebuchet MS", sans-serif; color: #e6dcc4; touch-action: pan-y; }
.evo-dev * { box-sizing: border-box; }
.evo-dev .sheet { width: min(980px, 100%); height: 100%; display: flex; flex-direction: column; background: #0f0d0b;
  border-left: 1px solid rgba(200,145,60,0.25); border-right: 1px solid rgba(200,145,60,0.25); }
.evo-dev header { padding: 18px 22px 12px; border-bottom: 1px solid rgba(200,145,60,0.25); }
.evo-dev h1 { margin: 0; font: 400 22px Cinzel, Georgia, serif; letter-spacing: 4px; color: #e6dcc4; }
.evo-dev .sub { margin: 4px 0 12px; font-size: 14px; color: #a89c84; }
.evo-dev .bar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.evo-dev input[type=search] { flex: 1 1 200px; min-width: 0; padding: 7px 10px; background: #1a1714; color: #e6dcc4;
  border: 1px solid rgba(200,145,60,0.35); border-radius: 6px; font: inherit; font-size: 15px; }
.evo-dev button { padding: 7px 12px; background: #2a2622; color: #e6dcc4; border: 1px solid rgba(200,145,60,0.35);
  border-radius: 6px; font: inherit; font-size: 14px; cursor: pointer; }
.evo-dev button:hover { background: #3a332b; }
.evo-dev button.close { margin-left: auto; }
.evo-dev .count { font-size: 13px; color: #c8913c; }
.evo-dev main { flex: 1; overflow-y: auto; padding: 6px 22px 40px; -webkit-overflow-scrolling: touch; }
.evo-dev details { margin-top: 14px; border-top: 1px solid rgba(200,145,60,0.18); padding-top: 8px; }
.evo-dev summary { cursor: pointer; font: 700 13px Cinzel, Georgia, serif; letter-spacing: 3px; color: #c8913c; padding: 4px 0; }
.evo-dev summary .n { font: 400 13px "Alegreya Sans", sans-serif; letter-spacing: 0; color: #e8c07a; margin-left: 8px; }
.evo-dev .note { font-size: 13px; color: #a89c84; margin: 2px 0 6px; }
.evo-dev .row { display: grid; grid-template-columns: 1fr 110px 96px 28px; gap: 10px; align-items: center; padding: 3px 0; }
.evo-dev .row .lab { font-size: 15px; color: #cfc4ab; }
.evo-dev .row .lab small { display: block; font-size: 12px; color: #8a8070; }
.evo-dev input[type=number] { width: 100%; padding: 4px 6px; background: #1a1714; color: #e6dcc4; text-align: right;
  border: 1px solid rgba(230,220,196,0.15); border-radius: 4px; font: inherit; font-size: 15px; }
.evo-dev .changed input[type=number] { border-color: #c8913c; color: #f0c878; }
.evo-dev .def { font-size: 12px; color: #8a8070; text-align: right; white-space: nowrap; }
.evo-dev .undo { visibility: hidden; padding: 0; width: 26px; height: 26px; font-size: 14px; line-height: 1; }
.evo-dev .changed .undo { visibility: visible; }
.evo-dev table { width: 100%; border-collapse: collapse; font-size: 14px; }
.evo-dev th { font-weight: 500; color: #a89c84; text-align: right; padding: 4px 4px; position: sticky; top: -6px; background: #0f0d0b; }
.evo-dev th:first-child, .evo-dev td:first-child { text-align: left; }
.evo-dev td { padding: 2px 4px; }
.evo-dev td.ep { color: #8a8070; font-size: 12px; }
.evo-dev td input[type=number] { min-width: 64px; font-size: 14px; }
.evo-dev td.changed input[type=number] { border-color: #c8913c; color: #f0c878; }
.evo-dev .modal { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.6); }
.evo-dev .modal div { width: min(620px, 92%); background: #14110e; border: 1px solid rgba(200,145,60,0.4); border-radius: 8px; padding: 16px; }
.evo-dev textarea { width: 100%; height: 280px; background: #0b0a08; color: #e6dcc4; border: 1px solid rgba(230,220,196,0.2);
  border-radius: 4px; font: 13px ui-monospace, Menlo, monospace; padding: 8px; }
.evo-dev .modal p { margin: 0 0 8px; font-size: 14px; color: #a89c84; }
.evo-dev .modal .bar { margin-top: 10px; justify-content: flex-end; }
.evo-dev .hide { display: none; }
`;

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000)).replace('.', ',');
const parse = (s: string) => Number(s.trim().replace(/\s/g, '').replace(',', '.'));

/** Öffnet die Einstellung. onChange: nach jeder Änderung (z. B. für den Hinweis im Titelbild); onClose: beim Schließen. */
export function openDevConfig(onChange: () => void, onClose: () => void) {
  if (!document.getElementById('evo-dev-css')) {
    const st = document.createElement('style');
    st.id = 'evo-dev-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  const root = document.createElement('div');
  root.className = 'evo-dev';
  // Tasten bleiben hier (sonst steuern sie das Spiel bzw. schalten den Ton)
  for (const ev of ['keydown', 'keyup', 'keypress'] as const) root.addEventListener(ev, (e) => e.stopPropagation());
  root.addEventListener('pointerdown', (e) => e.stopPropagation());

  const sheet = el('div', 'sheet');
  root.appendChild(sheet);
  const header = el('header');
  header.appendChild(el('h1', '', 'ENTWICKLER-EINSTELLUNG'));
  header.appendChild(el('div', 'sub', 'Alle Zahlen für das Gleichgewicht des Spiels. Geänderte Werte merkt sich dieser Browser – sie gelten ab dem nächsten Ort bzw. Leben.'));
  const bar = el('div', 'bar');
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Suchen …';
  const count = el('span', 'count');
  const bExport = button('Exportieren', () => modal('export'));
  const bImport = button('Importieren', () => modal('import'));
  const bReset = button('Alles zurücksetzen', () => {
    if (!changedCount() || !confirm('Alle Werte auf den Standard zurücksetzen?')) return;
    resetAll();
    refreshAll();
  });
  const bClose = button('Schließen ✕', () => close());
  bClose.classList.add('close');
  bar.append(search, count, bExport, bImport, bReset, bClose);
  header.appendChild(bar);
  sheet.appendChild(header);
  const main = el('main');
  sheet.appendChild(main);

  /** jedes Eingabefeld mit seinem Wert – zum Auffrischen nach Zurücksetzen oder Übernehmen */
  const inputs: { p: Param; input: HTMLInputElement; box: HTMLElement }[] = [];
  const sections: { det: HTMLDetailsElement; n: HTMLElement; params: Param[]; rows: { box: HTMLElement; text: string }[] }[] = [];

  const numInput = (p: Param, box: HTMLElement) => {
    const input = document.createElement('input');
    input.type = 'number';
    input.step = String(p.step);
    input.min = String(p.min);
    if (p.max < 1e8) input.max = String(p.max);
    input.value = String(p.get());
    input.addEventListener('change', () => {
      const v = parse(input.value);
      if (!Number.isFinite(v)) input.value = String(p.get());
      else setParam(p, v);
      refresh(p);
    });
    inputs.push({ p, input, box });
    return input;
  };

  for (const g of GROUPS) {
    const det = document.createElement('details');
    det.open = true;
    const sum = document.createElement('summary');
    sum.textContent = g.title.toUpperCase();
    const n = el('span', 'n');
    sum.appendChild(n);
    det.appendChild(sum);
    if (g.note) det.appendChild(el('div', 'note', g.note));
    const rows: { box: HTMLElement; text: string }[] = [];
    for (const p of g.params) {
      const row = el('div', 'row');
      const lab = el('div', 'lab', p.label);
      if (p.hint) {
        lab.title = p.hint;
        lab.appendChild(el('small', '', p.hint));
      }
      const def = el('div', 'def', `Standard: ${fmt(p.def())}`);
      const undo = button('↺', () => {
        resetParam(p);
        refresh(p);
      });
      undo.classList.add('undo');
      undo.title = 'Zurück auf den Standard';
      row.append(lab, numInput(p, row), def, undo);
      det.appendChild(row);
      rows.push({ box: row, text: `${g.title} ${p.label} ${p.hint ?? ''} ${p.id}`.toLowerCase() });
    }
    main.appendChild(det);
    sections.push({ det, n, params: g.params, rows });
  }

  // die Tiere einzeln: eine Tabelle, je Art eine Zeile
  {
    const det = document.createElement('details');
    det.open = false;
    const sum = document.createElement('summary');
    sum.textContent = 'TIERE EINZELN';
    const n = el('span', 'n');
    sum.appendChild(n);
    det.appendChild(sum);
    det.appendChild(el('div', 'note', 'Nahrung: so viel gibt ein erlegtes Tier (bei Größe 1; ohne eigenen Wert nach seiner Lebenskraft). Lebenskraft, Biss, Tempo und Stärke wie im Spiel – die Faktoren für alle Tiere kommen obendrauf.'));
    const table = document.createElement('table');
    const head = document.createElement('tr');
    for (const h of ['Art', 'Zeitalter', ...SPECIES_ROWS[0].params.map((p) => p.label)]) head.appendChild(el('th', '', h));
    table.appendChild(head);
    const rows: { box: HTMLElement; text: string }[] = [];
    for (const r of SPECIES_ROWS) {
      const tr = document.createElement('tr');
      tr.appendChild(el('td', '', r.name));
      tr.appendChild(el('td', 'ep', r.epoch));
      for (const p of r.params) {
        const td = document.createElement('td');
        td.title = `Standard: ${fmt(p.def())}`;
        td.appendChild(numInput(p, td));
        td.addEventListener('dblclick', () => {
          resetParam(p);
          refresh(p);
        });
        tr.appendChild(td);
      }
      table.appendChild(tr);
      rows.push({ box: tr, text: `${r.name} ${r.id} ${r.epoch}`.toLowerCase() });
    }
    det.appendChild(table);
    det.appendChild(el('div', 'note', 'Doppelklick auf ein Feld: zurück auf den Standard.'));
    main.appendChild(det);
    sections.push({ det, n, params: SPECIES_ROWS.flatMap((r) => r.params), rows });
  }

  function refresh(p: Param) {
    for (const it of inputs) {
      // die Nahrung einer Art hängt an ihrer Lebenskraft: alle Felder ohne eigenen Wert mitziehen
      if (it.p !== p && isChanged(it.p)) continue;
      if (document.activeElement !== it.input || it.p === p) it.input.value = String(it.p.get());
      it.box.classList.toggle('changed', isChanged(it.p));
      if (it.box.tagName === 'TD') it.box.title = `Standard: ${fmt(it.p.def())}`;
    }
    counts();
  }

  function refreshAll() {
    for (const it of inputs) {
      it.input.value = String(it.p.get());
      it.box.classList.toggle('changed', isChanged(it.p));
    }
    counts();
  }

  function counts() {
    const c = changedCount();
    count.textContent = c ? `${c} geändert` : 'alles Standard';
    for (const s of sections) {
      const k = s.params.filter(isChanged).length;
      s.n.textContent = k ? `${k} geändert` : '';
    }
    onChange();
  }

  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    for (const s of sections) {
      let any = false;
      for (const r of s.rows) {
        const hit = !q || r.text.includes(q);
        r.box.classList.toggle('hide', !hit);
        any ||= hit;
      }
      s.det.classList.toggle('hide', !any);
      if (q && any) s.det.open = true;
    }
  });

  function modal(kind: 'export' | 'import') {
    const m = el('div', 'modal');
    const box = el('div');
    box.appendChild(el('p', '', kind === 'export'
      ? 'Deine geänderten Werte. Kopieren und weitergeben – oder später über „Importieren“ wieder einsetzen.'
      : 'Werte einfügen (wie beim Exportieren). Sie ersetzen alle bisher geänderten.'));
    const ta = document.createElement('textarea');
    ta.value = kind === 'export' ? exportTuning() : '';
    box.appendChild(ta);
    const mb = el('div', 'bar');
    if (kind === 'export') {
      mb.appendChild(button('Kopieren', () => {
        ta.select();
        navigator.clipboard?.writeText(ta.value).catch(() => document.execCommand('copy'));
      }));
    } else {
      mb.appendChild(button('Übernehmen', () => {
        const n = importTuning(ta.value);
        if (n < 0) return alert('Das sind keine gültigen Werte.');
        refreshAll();
        m.remove();
      }));
    }
    mb.appendChild(button('Schließen', () => m.remove()));
    box.appendChild(mb);
    m.appendChild(box);
    m.addEventListener('pointerdown', (e) => e.target === m && m.remove());
    root.appendChild(m);
    if (kind === 'export') ta.select();
    else ta.focus();
  }

  const onEsc = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    const m = root.querySelector('.modal');
    if (m) m.remove();
    else close();
  };
  root.addEventListener('keydown', onEsc);

  function close() {
    root.remove();
    onClose();
  }

  refreshAll();
  document.body.appendChild(root);
  return close;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function button(label: string, fn: () => void) {
  const b = el('button', '', label);
  b.type = 'button';
  b.addEventListener('click', fn);
  return b;
}
