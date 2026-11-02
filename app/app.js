'use strict';

// ===== Cấu hình =====
const INTERVALS = [0, 1, 3, 7, 14, 30]; // box -> số ngày tới lần ôn sau
const STORE_KEY = 'n2app.v1';
const DEFAULT_EXAM = '2026-12-06';
const UNITS = { 1: '名詞A', 2: '動詞A', 3: '形容詞A', 4: '名詞B ・ 複合動詞', 5: 'カタカナA', 6: '副詞A ・ 接続詞', 7: '名詞C ・ 同じ漢字を含む名詞',
  8: '動詞B', 9: 'カタカナB', 10: '形容詞B', 11: '名詞D', 12: '動詞C', 13: '副詞B ・ 連体詞' };
const UNIT_VI = { 1: 'Danh từ A', 2: 'Động từ A', 3: 'Tính từ A', 4: 'Danh từ B + động từ ghép', 5: 'Katakana A', 6: 'Phó từ A + liên từ',
  7: 'Danh từ C + từ cùng chữ Hán', 8: 'Động từ B', 9: 'Katakana B', 10: 'Tính từ B', 11: 'Danh từ D', 12: 'Động từ C', 13: 'Phó từ B + liên thể từ' };

// ===== Tiện ích =====
const pad = n => String(n).padStart(2, '0');
const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayStr = () => fmt(new Date());
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return fmt(d); };
const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const isKanji = c => /[一-鿿々]/.test(c);
const fold = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
const nl2br = html => html.replace(/\n/g, '<br>');
const fmtTime = s => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
// {漢字|よみ} -> ruby; [x] -> từ đang học (mark) hoặc chỗ trống
const furi = s => esc(s).replace(/\{([^{}|]*)\|([^{}|]*)\}/g, '<ruby>$1<rt>$2</rt></ruby>');
const noFuri = s => esc(s).replace(/\{([^{}|]*)\|[^{}|]*\}/g, '$1');
const exHtml = (jp, blank) => furi(jp).replace(/\[(.*?)\]/, blank ? '<span class="blank">（　？　）</span>' : '<mark>$1</mark>');
const sayText = s => String(s).replace(/\{[^{}|]*\|([^{}|]*)\}/g, '$1').replace(/[[\]]/g, '');

// ===== Dữ liệu =====
const WORDS = (typeof VOCAB === 'undefined' ? [] : VOCAB).slice().sort((a, b) => a.no - b.no)
  .map(w => ({ ...w, id: 'V|' + w.no, kind: 'v', label: w.kanji || w.kana }));
WORDS.forEach(w => { w.search = fold([w.kana, w.kanji, w.head, w.vi, w.hv].join(' ')); });
const GRAMS = (typeof GRAMMAR === 'undefined' ? [] : GRAMMAR).slice().sort((a, b) => (a.lv < b.lv ? 1 : a.lv > b.lv ? -1 : a.no - b.no))
  .map(g => ({ ...g, id: `G|${g.lv}|${g.no}`, kind: 'g' }));
GRAMS.forEach(g => { g.search = fold([g.pattern, g.form, g.mean].join(' ')); });
const gramsOf = lv => GRAMS.filter(g => g.lv === lv);

// ===== Lưu trữ =====
let state = load();
function load() {
  let s;
  try { s = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { s = null; }
  s ||= {};
  s.cards ||= {};
  s.settings ||= {};
  s.settings.exam ||= DEFAULT_EXAM;
  s.settings.front ||= 'kanji';
  s.settings.batch ||= '20';
  return s;
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
const card = w => state.cards[w.id];
const ensureCard = w => (state.cards[w.id] ||= { box: 0, due: null, right: 0, wrong: 0, learned: false });
const isLearned = w => !!card(w)?.learned;
const isWeak = w => { const c = card(w); return !!c && c.wrong > 0 && c.box < 4; };
const isDue = w => { const c = card(w); return !!c && c.learned && c.due && c.due <= todayStr(); };
function recordAnswer(w, ok) {
  const c = ensureCard(w);
  if (ok) c.right++;
  else { c.wrong++; if (c.learned) { c.box = 1; c.due = todayStr(); } }
}

// ===== Phát âm =====
let jaVoice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  jaVoice = vs.find(v => v.lang === 'ja-JP') || vs.find(v => v.lang.startsWith('ja')) || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function speakText(text) {
  if (!('speechSynthesis' in window)) return toast('Trình duyệt không hỗ trợ đọc phát âm');
  const u = new SpeechSynthesisUtterance(sayText(text));
  u.lang = 'ja-JP';
  if (jaVoice) u.voice = jaVoice;
  u.rate = 0.9;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-say]');
  if (!b) return;
  e.stopPropagation();
  speakText(b.dataset.say);
}, true);
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add('hidden'), 2200);
}

// ===== Điều hướng =====
let currentView = 'home';
function showView(name) {
  currentView = name;
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  $('view-' + name).classList.remove('hidden');
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'home') renderHome();
  if (name === 'vocab') renderVocab();
  if (name === 'gram') renderGram();
  if (name === 'exam') resetExam();
  if (name === 'list') renderList();
  if (name === 'settings') renderSettings();
  window.scrollTo(0, 0);
}
document.querySelectorAll('nav button').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
$('homeLink').addEventListener('click', () => showView('home'));

// ===== Hôm nay =====
const batch = () => Number(state.settings.batch) || 20;
const nextNewWords = () => WORDS.filter(w => !isLearned(w)).slice(0, batch());
const nextNewGrams = lv => gramsOf(lv).filter(g => !isLearned(g)).slice(0, 5);
function renderHome() {
  const vl = WORDS.filter(isLearned).length, n2 = gramsOf('N2'), gl = n2.filter(isLearned).length;
  const due = [...WORDS, ...GRAMS].filter(isDue).length;
  $('statVocab').textContent = vl;
  $('statVocabTotal').textContent = WORDS.length;
  $('statGram').textContent = gl;
  $('statGramTotal').textContent = n2.length;
  $('statDue').textContent = due;
  $('progressBar').style.width = (WORDS.length + n2.length ? (vl + gl) / (WORDS.length + n2.length) * 100 : 0) + '%';
  const left = diffDays(todayStr(), state.settings.exam);
  $('countdown').textContent = left > 0 ? `Còn ${left} ngày nữa là thi N2 — 頑張って！` : left === 0 ? 'Hôm nay thi rồi! 落ち着いて、頑張って 💪' : 'Đã qua ngày thi — cập nhật ngày thi trong ⚙︎ nếu cần.';
  const items = [];
  const nw = nextNewWords();
  if (nw.length) items.push(todoItem(`📗 Từ mới: ${nw[0].no}–${nw[nw.length - 1].no}`, `Unit ${nw[0].unit} · ${UNIT_VI[nw[0].unit] || ''} · ${nw.length} từ`, 'Học', () => studyWords(nw, 'Từ mới')));
  items.push(todoItem('🔁 Ôn thẻ', due ? `${due} thẻ (từ vựng + ngữ pháp) đến hạn ôn` : 'Không có thẻ nào cần ôn — tốt lắm!', 'Ôn', startReview, !due));
  const ng = nextNewGrams('N2');
  if (ng.length) items.push(todoItem(`📘 Ngữ pháp mới: ${ng.map(g => g.pattern).join('、')}`, '5 mẫu Shinkanzen N2', 'Học', () => studyGrams(ng, 'Ngữ pháp mới')));
  const dueQ = ALL_ITEMS.filter(it => isQDue(it.qid)).length;
  items.push(todoItem('🎯 Luyện đề', dueQ ? `${dueQ} câu đề làm sai cần ôn lại` : 'Làm một đề thật hoặc đề trộn tổng hợp', dueQ ? 'Ôn' : 'Làm',
    () => { showView('exam'); if (dueQ) $('reviewWrong').click(); }));
  $('todoBox').innerHTML = '';
  items.forEach(i => $('todoBox').appendChild(i));
}
function todoItem(title, desc, btnText, onClick, disabled) {
  const el = document.createElement('div');
  el.className = 'todo-item';
  el.innerHTML = `<div><b>${title}</b><p class="muted">${desc}</p></div>`;
  const b = document.createElement('button');
  b.className = 'btn primary';
  b.textContent = btnText;
  b.disabled = !!disabled;
  b.addEventListener('click', onClick);
  el.appendChild(b);
  return el;
}
function statusBadge(w) {
  const c = card(w);
  if (isWeak(w)) return '<span class="badge b1">Hay sai</span>';
  if (!c || !c.learned) return '<span class="badge b0">Chưa học</span>';
  return c.box >= 3 ? '<span class="badge b3">Thuộc</span>' : '<span class="badge b2">Đang học</span>';
}

// ===== Từ vựng =====
let openUnit = null;
function renderVocab() {
  $('vocabHome').classList.toggle('hidden', !!openUnit);
  $('vocabUnit').classList.toggle('hidden', !openUnit);
  if (openUnit) return renderUnit();
  const vl = WORDS.filter(isLearned).length, due = WORDS.filter(isDue).length;
  $('vocabStats').textContent = `Đã học ${vl}/${WORDS.length} từ · ${due} từ cần ôn · ${WORDS.filter(isWeak).length} từ hay sai`;
  const nw = nextNewWords();
  $('vocabNextInfo').textContent = nw.length ? `Từ số ${nw[0].no}–${nw[nw.length - 1].no}` : 'Đã học hết 🎉';
  $('vocabReviewInfo').textContent = due ? `${due} từ đến hạn` : 'Chưa có từ cần ôn';
  $('unitGrid').innerHTML = Object.keys(UNITS).map(Number).map(u => {
    const ws = WORDS.filter(w => w.unit === u);
    if (!ws.length) return '';
    const done = ws.filter(isLearned).length;
    return `<button class="lesson-tile" data-u="${u}"><b>Unit ${pad(u)}</b><span class="jp">${esc(UNITS[u])}</span>
      <span class="muted">${esc(UNIT_VI[u])} · ${ws[0].no}–${ws[ws.length - 1].no}</span>
      <div class="muted">${done}/${ws.length} từ</div><div class="bar"><div style="width:${done / ws.length * 100}%"></div></div></button>`;
  }).join('') || '<p class="muted">Chưa có dữ liệu từ vựng.</p>';
}
$('unitGrid').addEventListener('click', e => { const b = e.target.closest('[data-u]'); if (b) { openUnit = Number(b.dataset.u); renderVocab(); window.scrollTo(0, 0); } });
$('unitBack').addEventListener('click', () => { openUnit = null; renderVocab(); });
const unitWords = () => WORDS.filter(w => w.unit === openUnit);
function renderUnit() {
  const ws = unitWords();
  $('unitTitle').innerHTML = `Unit ${pad(openUnit)} <span class="jp">${esc(UNITS[openUnit])}</span>`;
  $('unitSub').textContent = `${UNIT_VI[openUnit]} · đã học ${ws.filter(isLearned).length}/${ws.length} từ`;
  $('unitList').innerHTML = ws.map(w => `<tr><td class="jp">${esc(w.kanji || w.kana)}<small>${w.kanji ? esc(w.kana) : ''}</small></td>
    <td>${esc(w.vi)}<br><span class="hvs">${esc(w.hv)}</span></td><td>${statusBadge(w)}</td>
    <td><button data-say="${esc(w.kana)}">🔊</button></td></tr>`).join('');
}
$('unitStudy').addEventListener('click', () => {
  const fresh = unitWords().filter(w => !isLearned(w)).slice(0, batch());
  studyWords(fresh.length ? fresh : unitWords().slice(0, batch()), `Unit ${openUnit}${fresh.length ? '' : ' — học lại'}`);
});
$('unitReview').addEventListener('click', () => studyWords(shuffle(unitWords().filter(isLearned)), `Ôn unit ${openUnit}`));
$('unitQuiz').addEventListener('click', () => vocabQuiz(unitWords().filter(isLearned).length >= 8 ? unitWords().filter(isLearned) : unitWords(), 20, () => showView('vocab')));
$('vocabNext').addEventListener('click', () => { const nw = nextNewWords(); if (!nw.length) return toast('Bạn đã học hết 1160 từ 🎉'); studyWords(nw, 'Từ mới'); });
$('vocabReview').addEventListener('click', () => { const ws = shuffle(WORDS.filter(isDue)); if (!ws.length) return toast('Chưa có từ nào cần ôn'); studyWords(ws, 'Ôn từ vựng'); });
$('vocabQuizAll').addEventListener('click', () => {
  const ws = WORDS.filter(isLearned);
  if (ws.length < 8) return toast('Hãy học ít nhất 8 từ trước khi làm quiz');
  vocabQuiz(ws, 20, () => showView('vocab'));
});

// ===== Ngữ pháp =====
let gramLv = 'N2', gramOpen = null;
function renderGram() {
  document.querySelectorAll('#gramTabs button').forEach(b => b.classList.toggle('active', b.dataset.lv === gramLv));
  const gs = gramsOf(gramLv), learned = gs.filter(isLearned).length, due = gs.filter(isDue).length;
  $('gramStats').textContent = gs.length ? `${gs.length} mẫu · đã học ${learned} · cần ôn ${due}` : 'Chưa có dữ liệu ngữ pháp.';
  const ng = nextNewGrams(gramLv);
  $('gramNextInfo').textContent = ng.length ? ng.map(g => g.pattern).join('、') : 'Đã học hết 🎉';
  $('gramReviewInfo').textContent = due ? `${due} mẫu đến hạn` : 'Chưa có mẫu cần ôn';
  const q = fold($('gramSearch').value.trim());
  $('gramList').innerHTML = gs.filter(g => !q || g.search.includes(q)).map(g => `<div class="gram-row${gramOpen === g.id ? ' open' : ''}" data-g="${esc(g.id)}">
      <div class="gram-head"><span class="gram-no">${g.no}</span><b class="jp">${esc(g.pattern)}</b> <span class="muted">— ${esc(g.mean)}</span> ${statusBadge(g)}</div>
      ${gramOpen === g.id ? gramDetail(g) : ''}</div>`).join('');
}
function gramDetail(g) {
  return `<div class="gram-body"><div class="gram-form jp">接続：${esc(g.form)}</div>
    <div class="gram-note">${nl2br(esc(g.note))}</div>
    ${(g.ex || []).map(e => `<div class="example small"><div class="ex-jp">${exHtml(e.jp)} <button class="speak-ex" data-say="${esc(e.jp)}">🔊</button></div><div class="ex-vi">${esc(e.vi)}</div></div>`).join('')}</div>`;
}
$('gramTabs').addEventListener('click', e => { const b = e.target.closest('[data-lv]'); if (b) { gramLv = b.dataset.lv; gramOpen = null; renderGram(); } });
$('gramSearch').addEventListener('input', renderGram);
$('gramList').addEventListener('click', e => {
  if (e.target.closest('button')) return;
  const r = e.target.closest('[data-g]');
  if (!r) return;
  gramOpen = gramOpen === r.dataset.g ? null : r.dataset.g;
  renderGram();
});
$('gramNext').addEventListener('click', () => { const ng = nextNewGrams(gramLv); if (!ng.length) return toast('Đã học hết các mẫu 🎉'); studyGrams(ng, `Ngữ pháp ${gramLv}`); });
$('gramReview').addEventListener('click', () => { const gs = shuffle(gramsOf(gramLv).filter(isDue)); if (!gs.length) return toast('Chưa có mẫu nào cần ôn'); studyGrams(gs, `Ôn ngữ pháp ${gramLv}`); });
$('gramQuiz').addEventListener('click', () => {
  const learned = gramsOf(gramLv).filter(isLearned);
  const pool = learned.length >= 5 ? learned : gramsOf(gramLv);
  gramQuiz(pool, 20, () => showView('gram'));
});

// ===== Thẻ học (dùng chung từ vựng + ngữ pháp) =====
let session = null;
const studyWords = (ws, title) => startSession(ws, title, 'vocab');
const studyGrams = (gs, title) => startSession(gs, title, 'gram');
function startReview() {
  const items = shuffle([...WORDS, ...GRAMS].filter(isDue));
  if (!items.length) return toast('Không có thẻ nào cần ôn hôm nay');
  startSession(items, 'Ôn tập', 'home');
}
function startSession(items, title, back) {
  if (!items.length) return toast('Không có thẻ nào');
  session = { queue: items.slice(), total: items.length, done: 0, failed: new Set(), title, back, history: [], view: null };
  showView('study');
  showCard();
}
function fillCard(w) {
  session.shown = w;
  if (w.kind === 'g') {
    $('cardCat').textContent = `Ngữ pháp ${w.lv} · mẫu ${w.no}`;
    $('cardWord').className = 'jp-big jp-gram';
    $('cardWord').textContent = w.pattern;
    $('cardSub').textContent = w.form;
    $('cardBack').innerHTML = `<div class="meaning">${esc(w.mean)}</div><div class="note gram-note">${nl2br(esc(w.note))}</div>
      ${(w.ex || []).map(e => `<div class="example"><div class="ex-jp">${exHtml(e.jp)} <button class="speak-ex" data-say="${esc(e.jp)}">🔊</button></div><div class="ex-vi">${esc(e.vi)}</div></div>`).join('')}`;
    return;
  }
  const kanjiFront = state.settings.front !== 'kana' && w.kanji;
  $('cardCat').textContent = `Unit ${w.unit} · ${UNIT_VI[w.unit] || ''} · số ${w.no}${w.suru ? ' · する' : ''}`;
  $('cardWord').className = 'jp-big';
  $('cardWord').textContent = kanjiFront ? w.kanji : w.kana;
  $('cardSub').textContent = '';
  $('cardBack').innerHTML = `<div class="jp-kana">${esc(kanjiFront ? w.kana : w.kanji)}${w.head && w.head !== w.kanji && w.head !== w.kana ? ` <small>(${esc(w.head)})</small>` : ''}</div>
    <div class="meaning">${esc(w.vi)}</div>${w.hv ? `<div class="hv">Hán Việt: ${esc(w.hv)}</div>` : ''}
    ${(w.ex || []).slice(0, 3).map(e => `<div class="example"><div class="ex-jp">${exHtml(e.jp)} <button class="speak-ex" data-say="${esc(e.jp)}">🔊</button></div><div class="ex-vi">${esc(e.vi)}</div></div>`).join('')}
    ${w.rel && w.rel.length ? `<div class="related">${w.rel.map(r => `<div class="jp">${esc(r)}</div>`).join('')}</div>` : ''}`;
}
function updateStudyHead() {
  $('studyTitle').textContent = session.title;
  $('studyCount').textContent = `${session.done}/${session.total} · còn ${session.queue.length} thẻ`;
  $('studyBar').style.width = (session.done / session.total * 100) + '%';
  $('prevBtn').disabled = session.view === 0 || !session.history.length;
  $('nextBtn').textContent = session.view === null ? 'Bỏ qua ▶' : 'Sau ▶';
  $('nextBtn').disabled = session.view === null && session.queue.length < 2;
  $('reviewBanner').classList.toggle('hidden', session.view === null);
}
function showCard() {
  const w = session.queue[0];
  if (!w) return finishSession();
  session.view = null;
  session.flipped = false;
  fillCard(w);
  $('cardBack').classList.add('hidden');
  $('flipActions').classList.remove('hidden');
  $('gradeActions').classList.add('hidden');
  updateStudyHead();
}
function showHistoryCard() {
  fillCard(session.history[session.view]);
  $('cardBack').classList.remove('hidden');
  $('flipActions').classList.add('hidden');
  $('gradeActions').classList.add('hidden');
  updateStudyHead();
}
function prevCard() {
  if (!session || !session.history.length) return;
  if (session.view === null) session.view = session.history.length - 1;
  else if (session.view > 0) session.view--;
  else return;
  showHistoryCard();
}
function nextCard() {
  if (!session) return;
  if (session.view !== null) {
    session.view++;
    return session.view >= session.history.length ? showCard() : showHistoryCard();
  }
  if (session.queue.length < 2) return;
  session.queue.push(session.queue.shift());
  toast('Đã bỏ qua — thẻ này sẽ quay lại cuối lượt');
  showCard();
}
const speakItem = w => speakText(w.kind === 'g' ? (w.ex?.[0]?.jp || w.pattern) : w.kana);
function flip() {
  if (!session || session.view !== null || session.flipped) return;
  session.flipped = true;
  $('cardBack').classList.remove('hidden');
  $('flipActions').classList.add('hidden');
  $('gradeActions').classList.remove('hidden');
  if (state.settings.autoSpeak) speakItem(session.queue[0]);
}
function grade(ok) {
  if (!session || session.view !== null || !session.flipped) return;
  const w = session.queue.shift();
  const c = ensureCard(w);
  if (ok) {
    c.box = session.failed.has(w.id) || !c.learned ? 1 : Math.min(c.box + 1, INTERVALS.length - 1);
    c.learned = true;
    c.due = addDays(todayStr(), INTERVALS[c.box]);
    c.right++;
    session.done++;
  } else {
    c.wrong++;
    session.failed.add(w.id);
    session.queue.splice(Math.min(4, session.queue.length), 0, w);
  }
  session.history.push(w);
  save();
  showCard();
}
function finishSession() {
  toast(`Xong ${session.total} thẻ! ${session.failed.size ? session.failed.size + ' thẻ phải lặp lại — tối nay ôn lại nhé.' : 'Không sai thẻ nào 🎉'}`);
  const back = session.back;
  session = null;
  showView(back);
}
$('flipBtn').addEventListener('click', flip);
$('card').addEventListener('click', e => { if (!e.target.closest('button')) flip(); });
$('againBtn').addEventListener('click', () => grade(false));
$('goodBtn').addEventListener('click', () => grade(true));
$('prevBtn').addEventListener('click', prevCard);
$('nextBtn').addEventListener('click', nextCard);
$('speakBtn').addEventListener('click', () => session && speakItem(session.shown));

// ===== Quiz (câu hỏi dạng chung) =====
// q: { ask, body(html), opts(html[]), ai, cls, explain(html), onResult(ok), wrongHtml }
let quiz = null;
function runQuiz(qs, back) {
  qs = qs.filter(Boolean);
  if (!qs.length) return toast('Không tạo được câu hỏi');
  quiz = { qs, i: 0, score: 0, wrong: [], back };
  showView('quiz');
  $('quizDone').classList.add('hidden');
  showQuestion();
}
function showQuestion() {
  const q = quiz.qs[quiz.i];
  quiz.answered = false;
  ['quizAsk', 'quizQ', 'quizChoices'].forEach(id => $(id).classList.remove('hidden'));
  $('quizProgress').textContent = `Câu ${quiz.i + 1}/${quiz.qs.length}`;
  $('quizScore').textContent = `Đúng ${quiz.score}`;
  $('quizBar').style.width = (quiz.i / quiz.qs.length * 100) + '%';
  $('quizAsk').textContent = q.ask;
  $('quizQ').innerHTML = q.body;
  $('quizChoices').className = 'choices' + (q.vertical ? ' vertical' : '');
  $('quizChoices').innerHTML = q.opts.map((o, i) => `<button class="choice ${q.cls || ''}" data-i="${i}">${i + 1}. ${o}</button>`).join('');
  $('quizExplain').classList.add('hidden');
  $('quizNext').classList.add('hidden');
}
$('quizChoices').addEventListener('click', e => { const b = e.target.closest('.choice'); if (b) quizAnswer(Number(b.dataset.i)); });
function quizAnswer(i) {
  if (!quiz || quiz.answered) return;
  const q = quiz.qs[quiz.i];
  if (!q || i >= q.opts.length) return;
  quiz.answered = true;
  const ok = i === q.ai;
  [...$('quizChoices').children].forEach((b, j) => { if (j === q.ai) b.classList.add('correct'); else if (j === i) b.classList.add('wrong'); });
  if (ok) quiz.score++; else quiz.wrong.push(q);
  q.onResult?.(ok);
  save();
  $('quizExplain').innerHTML = (ok ? '✅ Chính xác! ' : '❌ Chưa đúng. ') + q.explain;
  $('quizExplain').classList.remove('hidden');
  $('quizNext').classList.remove('hidden');
  $('quizScore').textContent = `Đúng ${quiz.score}`;
}
function quizNextQ() {
  if (!quiz || !quiz.answered) return;
  quiz.i++;
  if (quiz.i < quiz.qs.length) return showQuestion();
  ['quizAsk', 'quizQ', 'quizChoices', 'quizExplain', 'quizNext'].forEach(id => $(id).classList.add('hidden'));
  const pct = Math.round(quiz.score / quiz.qs.length * 100), wrong = quiz.wrong, back = quiz.back;
  $('quizDone').innerHTML = `<div class="result-big">${quiz.score}/${quiz.qs.length} (${pct}%)</div>
    <p style="text-align:center">${pct >= 90 ? 'Xuất sắc! 🎉' : pct >= 70 ? 'Khá tốt, cố thêm chút nữa! 💪' : 'Ôn lại các câu sai rồi làm lại nhé!'}</p>
    ${wrong.length ? '<h3>Các câu làm sai</h3><div class="wrong-list">' + wrong.map(q => `<div>${q.wrongHtml || ''}</div>`).join('') + '</div>' : ''}
    <div class="actions">${wrong.length ? '<button class="btn bad" id="quizRetry">Làm lại câu sai</button>' : ''}<button class="btn primary" id="quizBack">Quay lại</button></div>`;
  $('quizDone').classList.remove('hidden');
  $('quizBack').addEventListener('click', () => (back ? back() : showView('home')));
  if (wrong.length) $('quizRetry').addEventListener('click', () => runQuiz(shuffle(wrong.slice()), back));
}
$('quizNext').addEventListener('click', quizNextQ);

// ----- Quiz từ vựng -----
// Đáp án nhiễu cách đọc kiểu JLPT: dấu゛゜, âm dài, っ, ゃゅょ
const VOICE = {}, HANDAKU = {};
const VP = 'かがきぎくぐけげこごさざしじすずせぜそぞただてでとどはばひびふぶへべほぼ';
for (let i = 0; i < VP.length; i += 2) { VOICE[VP[i]] = VP[i + 1]; VOICE[VP[i + 1]] = VP[i]; }
'はぱひぴふぷへぺほぽ'.match(/../g).forEach(p => { HANDAKU[p[0]] = p[1]; HANDAKU[p[1]] = p[0]; });
const LONG_U = 'こそとのほもよろごぞどぼぽょくすつぬふむゆるぐずぶぷゅ', LONG_I = 'けせてねへめれげぜでべぺ';
const BEFORE_TSU = 'かきくけこさしすせそたちつてとぱぴぷぺぽ', I_ROW = 'きしちにひみりぎじびぴ';
const SMALL = { ゃ: 'や', ゅ: 'ゆ', ょ: 'よ', や: 'ゃ', ゆ: 'ゅ', よ: 'ょ' };
function kanaVariants(s) {
  const out = new Set();
  const put = (i, del, ins) => out.add(s.slice(0, i) + ins + s.slice(i + del));
  for (let i = 0; i < s.length; i++) {
    const c = s[i], next = s[i + 1], prev = s[i - 1];
    if (VOICE[c]) put(i, 1, VOICE[c]);
    if (HANDAKU[c]) put(i, 1, HANDAKU[c]);
    if (LONG_U.includes(c)) next === 'う' ? put(i + 1, 1, '') : put(i + 1, 0, 'う');
    if (LONG_I.includes(c)) next === 'い' ? put(i + 1, 1, '') : put(i + 1, 0, 'い');
    if (c === 'っ') put(i, 1, '');
    else if (i > 0 && BEFORE_TSU.includes(c) && !'っんうーゃゅょい'.includes(prev)) put(i, 0, 'っ');
    if (SMALL[c] && I_ROW.includes(prev)) put(i, 1, SMALL[c]);
  }
  out.delete(s);
  return [...out];
}
const mainVi = w => w.vi.split(/[;,(]/)[0].trim();
function pickOthers(w, n, get, ok = () => true) {
  const out = [], seen = new Set([get(w)]);
  for (const o of [...shuffle(WORDS.filter(x => x.unit === w.unit)), ...shuffle(WORDS.slice())]) {
    if (out.length >= n) break;
    const v = get(o);
    if (o === w || !v || seen.has(v) || !ok(o)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}
function wordExplain(w) {
  return `<span class="jp"><b>${esc(w.kanji || w.kana)}</b>${w.kanji ? ` (${esc(w.kana)})` : ''}</span> — ${esc(w.vi)}${w.hv ? ` · <span class="hvs">${esc(w.hv)}</span>` : ''}
    ${w.ex?.[0] ? `<div class="example small"><div class="ex-jp">${exHtml(w.ex[0].jp)}</div><div class="ex-vi">${esc(w.ex[0].vi)}</div></div>` : ''}`;
}
function vocabQuestion(w, type) {
  const base = { explain: wordExplain(w), onResult: ok => recordAnswer(w, ok),
    wrongHtml: `<span class="jp">${esc(w.kanji || w.kana)}</span> ${w.kanji ? esc(w.kana) : ''} — ${esc(w.vi)}` };
  const make = (right, wrongs, fmtOpt, extra) => {
    const opts = shuffle([right, ...wrongs]);
    return { ...base, ...extra, opts: opts.map(fmtOpt), ai: opts.indexOf(right) };
  };
  if (type === 'read' && w.kanji) {
    const vs = shuffle(kanaVariants(w.kana)).slice(0, 3);
    const more = pickOthers(w, 3 - vs.length, o => o.kana, o => o.kanji && Math.abs(o.kana.length - w.kana.length) <= 1);
    return make(w.kana, [...vs, ...more], esc, { ask: '漢字読み — Từ này đọc là gì?', body: `<div class="jp-big">${esc(w.kanji)}</div>`, cls: 'jp' });
  }
  if (type === 'write' && w.kanji) {
    const share = o => o.kanji && [...o.kanji].some(c => isKanji(c) && w.kanji.includes(c));
    let ds = pickOthers(w, 3, o => o.kanji, o => share(o) && o.kana !== w.kana);
    if (ds.length < 3) ds = [...ds, ...pickOthers(w, 3 - ds.length, o => o.kanji, o => o.kanji && !ds.includes(o.kanji) && o.kana !== w.kana && o.kanji.length === w.kanji.length)];
    return make(w.kanji, ds, esc, { ask: '表記 — Chọn chữ Hán đúng', body: `<div class="jp-big jp-kana-q">${esc(w.kana)}</div><div class="muted">${esc(w.vi)}</div>`, cls: 'jp' });
  }
  if (type === 'fill' && w.ex?.length) {
    const ex = w.ex.find(e => /\[.*\]/.test(e.jp));
    if (!ex) return null;
    const label = o => o.kanji || o.kana;
    const ds = pickOthers(w, 3, label, o => o.unit === w.unit && mainVi(o) !== mainVi(w));
    return make(label(w), ds, esc, { ask: '文脈規定 — Chọn từ hợp với câu', body: `<div class="jp-sent">${exHtml(ex.jp, true)}</div><div class="muted">${esc(ex.vi)}</div>`, cls: 'jp' });
  }
  if (type === 'jp') {
    const label = o => o.kanji || o.kana;
    return make(label(w), pickOthers(w, 3, label, o => mainVi(o) !== mainVi(w)), esc, { ask: 'Từ tiếng Nhật nào mang nghĩa này?', body: `<div class="meaning">${esc(w.vi)}</div>`, cls: 'jp' });
  }
  const shown = state.settings.front !== 'kana' && w.kanji ? w.kanji : w.kana;
  return make(w.vi, pickOthers(w, 3, o => o.vi, o => mainVi(o) !== mainVi(w)), esc, { ask: 'Từ này nghĩa là gì?', body: `<div class="jp-big">${esc(shown)}</div>`, cls: 'vi', vertical: true });
}
function vocabQuiz(pool, n, back) {
  const types = ['mean', 'read', 'write', 'fill', 'jp'];
  const ws = shuffle(pool.slice()).slice(0, n);
  const ok = q => q && q.opts.length === 4 && q.ai >= 0;
  runQuiz(ws.map((w, i) => { const q = vocabQuestion(w, types[i % types.length]); return ok(q) ? q : vocabQuestion(w, 'mean'); }).filter(ok), back);
}

// ----- Quiz ngữ pháp -----
function gramQuestion(g, k) {
  const z = g.quiz?.[k];
  if (!z) return null;
  const perm = shuffle([0, 1, 2, 3]);
  const opts = perm.map(j => z.options[j]);
  const filled = z.q.replace('（　）', `<mark>${esc(z.options[z.answer - 1])}</mark>`);
  return { ask: '文法形式 — Chọn ngữ pháp đúng', body: `<div class="jp-sent">${furi(z.q).replace('（　）', '<span class="blank">（　　）</span>')}</div>`,
    opts: opts.map(o => esc(o)), ai: perm.indexOf(z.answer - 1), cls: 'jp',
    explain: `<div class="jp">${filled}</div><div>${esc(z.vi)}</div><div class="muted">💡 ${esc(z.why)}</div>
      <div class="muted">📘 <b class="jp">${esc(g.pattern)}</b> — ${esc(g.mean)}</div>`,
    onResult: ok => recordAnswer(g, ok), wrongHtml: `<span class="jp">${esc(g.pattern)}</span> — ${esc(g.mean)}` };
}
function gramQuiz(pool, n, back) {
  const qs = shuffle(pool.flatMap(g => [0, 1].map(k => () => gramQuestion(g, k)))).slice(0, n).map(f => f());
  runQuiz(qs, back);
}

// ===== Luyện đề 言語知識 (問題1–9) =====
const TYPE_INFO = {
  1: { title: '問題1 漢字読み — Cách đọc chữ Hán', short: '問1 漢字読み', desc: 'Chọn cách đọc đúng của từ chữ Hán được gạch chân. Chú ý âm đục, âm dài, っ, ゃゅょ.',
       instr: '問題1　＿＿＿の言葉の読み方として最もよいものを、１・２・３・４から一つ選びなさい。' },
  2: { title: '問題2 表記 — Chọn chữ Hán', short: '問2 表記', desc: 'Chọn cách viết chữ Hán đúng cho từ hiragana gạch chân. Cẩn thận các chữ đồng âm, gần giống nhau.',
       instr: '問題2　＿＿＿の言葉を漢字で書くとき、最もよいものを、１・２・３・４から一つ選びなさい。' },
  3: { title: '問題3 語形成 — Tiền tố / hậu tố', short: '問3 語形成', desc: 'Chọn tiền tố / hậu tố (〜化, 〜的, 未〜, 不〜…) ghép đúng với từ.',
       instr: '問題3　（　　）に入れるのに最もよいものを、１・２・３・４から一つ選びなさい。' },
  4: { title: '問題4 文脈規定 — Điền từ', short: '問4 文脈規定', desc: 'Chọn từ hợp nghĩa và hợp kết hợp từ (collocation) với câu.',
       instr: '問題4　（　　）に入れるのに最もよいものを、１・２・３・４から一つ選びなさい。' },
  5: { title: '問題5 言い換え類義 — Từ gần nghĩa', short: '問5 言い換え', desc: 'Chọn từ / cụm có nghĩa gần nhất với phần gạch chân.',
       instr: '問題5　＿＿＿の言葉に意味が最も近いものを、１・２・３・４から一つ選びなさい。' },
  6: { title: '問題6 用法 — Cách dùng từ', short: '問6 用法', desc: 'Chọn câu dùng từ đúng nghĩa, đúng ngữ cảnh.',
       instr: '問題6　次の言葉の使い方として最もよいものを、１・２・３・４から一つ選びなさい。' },
  7: { title: '問題7 文法形式 — Chọn ngữ pháp', short: '問7 文法', desc: 'Chọn mẫu ngữ pháp / trợ từ đúng cho chỗ trống.',
       instr: '問題7　次の文の（　　）に入れるのに最もよいものを、１・２・３・４から一つ選びなさい。' },
  8: { title: '問題8 文の組み立て — Sắp xếp ★', short: '問8 ★', desc: 'Sắp xếp 4 cụm thành câu đúng rồi chọn cụm ở ô ★. Mẹo: ghép các cụm hiển nhiên đi liền nhau trước.',
       instr: '問題8　次の文の ★ に入る最もよいものを、１・２・３・４から一つ選びなさい。' },
  9: { title: '問題9 文章の文法 — Ngữ pháp đoạn văn', short: '問9 文章', desc: 'Đọc đoạn văn và chọn từ nối / mẫu ngữ pháp hợp mạch văn cho từng chỗ trống.',
       instr: '問題9　次の文章を読んで、文章全体の内容を考えて、それぞれの（　）の中に入る最もよいものを、１・２・３・４から一つ選びなさい。' },
};
const PAST_ALL = (typeof PAST === 'undefined' ? [] : PAST);
const EXAMS = [];
PAST_ALL.forEach(q => {
  let e = EXAMS.find(x => x.exam === q.exam);
  if (!e) EXAMS.push(e = { exam: q.exam, qs: [] });
  e.qs.push(q);
});
EXAMS.forEach(e => e.qs.sort((a, b) => a.type - b.type || a.no - b.no));
const isMock = code => /^mock/.test(code);
const realExams = () => EXAMS.filter(e => !isMock(e.exam)).sort((a, b) => (a.exam < b.exam ? 1 : -1));
const mockExams = () => EXAMS.filter(e => isMock(e.exam)).sort((a, b) => (a.exam < b.exam ? -1 : 1));
const examLabel = code => /^\d{4}-\d{2}$/.test(code) ? `JLPT ${Number(code.slice(5))}/${code.slice(0, 4)}` : isMock(code) ? `Đề thi thử ${code.slice(4)}` : code;
const ALL_ITEMS = EXAMS.flatMap(e => e.qs.map(q => ({ qid: `P|${e.exam}|${q.type}|${q.no}`, type: q.type, raw: q, src: `${examLabel(e.exam)} · câu ${q.no}` })));
const qstat = id => (state.qstats || {})[id];
const isQDue = id => { const s = qstat(id); return !!s && s.due && s.due <= todayStr(); };
function recordQ(q, ok) {
  if (!q.qid) return;
  const s = ((state.qstats ||= {})[q.qid] ||= { r: 0, w: 0, box: 0, due: null });
  if (ok) { s.r++; s.box = Math.min(s.box + 1, INTERVALS.length - 1); s.due = addDays(todayStr(), INTERVALS[s.box]); }
  else { s.w++; s.box = 0; s.due = todayStr(); }
}
function mkQ(item) {
  const r = item.raw;
  return { ...r, qid: item.qid, src: item.src, pick: null, ai: r.answer - 1 };
}
const isAns = (q, j) => j === q.ai;
function pickMix(n) {
  const due = shuffle(ALL_ITEMS.filter(it => isQDue(it.qid))).slice(0, Math.ceil(n * 0.5));
  const byT = {};
  shuffle(ALL_ITEMS.filter(it => !qstat(it.qid) && it.type !== 9)).forEach(it => (byT[it.type] ||= []).push(it));
  const picked = due.slice();
  const ts = Object.keys(byT);
  for (let i = 0; picked.length < n && ts.some(t => byT[t].length); i++) { const t = ts[i % ts.length]; if (byT[t].length) picked.push(byT[t].pop()); }
  shuffle(ALL_ITEMS.filter(it => !picked.includes(it) && it.type !== 9)).forEach(it => { if (picked.length < n) picked.push(it); });
  return picked.sort((a, b) => a.type - b.type);
}
let exam = null, examType = 1;
function resetExam() {
  if (exam?.timer) clearInterval(exam.timer);
  exam = null;
  $('examSetup').classList.remove('hidden');
  $('examPaper').classList.add('hidden');
  $('examResult').classList.add('hidden');
  const due = ALL_ITEMS.filter(it => isQDue(it.qid)).length, seen = ALL_ITEMS.filter(it => qstat(it.qid)).length;
  $('mixTodayInfo').textContent = `${ALL_ITEMS.length} câu trong kho · đã làm ${seen}`;
  $('reviewWrongInfo').textContent = due ? `${due} câu đến hạn ôn` : 'Chưa có câu nào cần ôn';
  const best = state.bookBest || {};
  const tile = (e, key, n) => {
    const b = best[key], cls = !b ? '' : b.score === n ? ' done' : ' tried';
    return `<button class="book-test${cls}" data-ex="${esc(e.exam)}"><b>${esc(examLabel(e.exam).replace('JLPT ', ''))}</b><span>${b ? `Cao nhất ${b.score}/${n}` : `${n} câu`}</span></button>`;
  };
  $('pastExams').innerHTML = realExams().map(e => tile(e, 'past:' + e.exam, e.qs.length)).join('') || '<p class="muted">Chưa có dữ liệu.</p>';
  $('mockExams').previousElementSibling.classList.toggle('hidden', !mockExams().length);
  $('mockExams').innerHTML = mockExams().map(e => tile(e, 'past:' + e.exam, e.qs.length)).join('') || '<p class="muted">Chưa có dữ liệu.</p>';
  examType = state.settings.examType || 1;
  $('typeTabs').innerHTML = Object.entries(TYPE_INFO).map(([t, x]) => `<button data-t="${t}" class="${Number(t) === examType ? 'active' : ''}">${esc(x.short)}</button>`).join('');
  $('examTitle').textContent = TYPE_INFO[examType].title;
  $('examDesc').textContent = TYPE_INFO[examType].desc;
  $('typeExams').innerHTML = [...realExams(), ...mockExams()].filter(e => e.qs.some(q => q.type === examType)).map(e => {
    const n = e.qs.filter(q => q.type === examType).length, key = `past:${e.exam}:${examType}`;
    const b = best[key], cls = !b ? '' : b.score === n ? ' done' : ' tried';
    return `<button class="book-test past${cls}" data-et="${esc(e.exam)}"><b>${esc(examLabel(e.exam).replace('JLPT ', ''))}</b><span>${b ? `Cao nhất ${b.score}/${n}` : `${n} câu`}</span></button>`;
  }).join('') || '<p class="muted">Chưa có đề cho dạng này.</p>';
  const log = state.examLog || [];
  $('examHistory').innerHTML = log.length ? '<h3>Kết quả gần đây</h3>' + log.slice().reverse().map(r =>
    `<div class="hist-row"><span>${esc(r.name || '')}</span><span>${r.date.split('-').reverse().slice(0, 2).join('/')}</span><span>${r.score}/${r.n}</span><span class="muted">${fmtTime(r.secs)}</span></div>`).join('') : '';
}
$('typeTabs').addEventListener('click', e => {
  const b = e.target.closest('[data-t]');
  if (!b) return;
  state.settings.examType = Number(b.dataset.t);
  save();
  resetExam();
});
$('pastExams').addEventListener('click', openFullExam);
$('mockExams').addEventListener('click', openFullExam);
function openFullExam(e) {
  const b = e.target.closest('[data-ex]');
  if (!b) return;
  const items = ALL_ITEMS.filter(it => it.qid.startsWith(`P|${b.dataset.ex}|`));
  startExam(items.map(mkQ), `${examLabel(b.dataset.ex)} · 言語知識`, 'past:' + b.dataset.ex);
}
$('typeExams').addEventListener('click', e => {
  const b = e.target.closest('[data-et]');
  if (!b) return;
  const items = ALL_ITEMS.filter(it => it.qid.startsWith(`P|${b.dataset.et}|${examType}|`));
  startExam(items.map(mkQ), `${examLabel(b.dataset.et)} · ${TYPE_INFO[examType].short}`, `past:${b.dataset.et}:${examType}`);
});
$('typeMixStart').addEventListener('click', () => {
  let all = ALL_ITEMS.filter(it => it.type === examType);
  if (!all.length) return;
  const n = Math.min(Number($('typeMixNum').value) || 20, all.length);
  if (examType === 9) {   // 問題9: lấy trọn từng bài văn
    const groups = shuffle([...new Set(all.map(it => it.raw.exam))]);
    all = groups.flatMap(ex => all.filter(it => it.raw.exam === ex));
    return startExam(all.slice(0, Math.max(n, 5)).map(mkQ), `${TYPE_INFO[9].short} · trộn`, null);
  }
  startExam(shuffle(all.slice()).slice(0, n).map(mkQ), `${TYPE_INFO[examType].short} · trộn đề thật`, null);
});
$('mixToday').addEventListener('click', () => startExam(pickMix(Number($('mixNum').value) || 30).map(mkQ), 'Đề trộn tổng hợp', null));
$('reviewWrong').addEventListener('click', () => {
  const items = shuffle(ALL_ITEMS.filter(it => isQDue(it.qid))).slice(0, 40).sort((a, b) => a.type - b.type);
  if (!items.length) return toast('Chưa có câu nào cần ôn — làm thêm đề nhé!');
  startExam(items.map(mkQ), 'Ôn câu sai / đến hạn', null);
});
function startExam(qs, name, bestKey) {
  if (!qs.length) return toast('Không có câu hỏi');
  exam = { qs, name, bestKey, start: Date.now() };
  $('examSetup').classList.add('hidden');
  $('examResult').classList.add('hidden');
  $('examPaper').classList.remove('hidden');
  $('examSubmit').classList.remove('hidden');
  $('examName').textContent = name;
  $('examFuri').checked = state.settings.examFuri !== false;
  renderExam(false);
  $('examTimer').textContent = '00:00';
  exam.timer = setInterval(() => { $('examTimer').textContent = fmtTime(Math.floor((Date.now() - exam.start) / 1000)); }, 1000);
  window.scrollTo(0, 0);
}
$('examFuri').addEventListener('change', () => { state.settings.examFuri = $('examFuri').checked; save(); if (exam) renderExam(!!exam.graded); });
const jpt = s => (state.settings.examFuri !== false ? furi(s) : noFuri(s));
// [x] -> gạch chân
const underline = s => jpt(s).replace(/\[(.*?)\]/g, '<u class="m1-target">$1</u>');
function sentHtml(q, graded) {
  const t = q.type, s = q.sentence || '';
  if (t === 1 || t === 2 || t === 5) return nl2br(underline(s));
  if (t === 3 || t === 4 || t === 7) {
    const fill = graded ? `<span class="blank filled">（${jpt(q.options[q.ai])}）</span>` : '<span class="blank">（　　　）</span>';
    return nl2br(jpt(s).replace('（　）', fill));
  }
  if (t === 6) return `<span class="m5-word">${jpt(q.word)}</span>`;
  if (t === 8) {
    let slot = 0;
    return nl2br(s.split(/(＿＿|★)/).map(tok => {
      if (tok !== '＿＿' && tok !== '★') return jpt(tok);
      const i = slot++;
      if (!graded) return `<span class="slot${tok === '★' ? ' star' : ''}">${tok === '★' ? '★' : ''}</span>`;
      return `<span class="slot filled${tok === '★' ? ' star' : ''}">${jpt(q.options[(q.order || [])[i] - 1] || '')}</span>`;
    }).join(''));
  }
  if (t === 9) return `<span class="muted">(Đoạn văn ở trên)</span> chỗ trống <span class="blank">（${esc(q.blank)}）</span>`;
  return jpt(s);
}
function passageHtml(q, graded) {
  let html = nl2br(jpt(q.passage));
  if (graded) {
    exam.qs.filter(o => o.type === 9 && o.passage === q.passage).forEach(o => {
      html = html.replace(`（${esc(o.blank)}）`, `<span class="blank filled">（${esc(o.blank)}: ${jpt(o.options[o.ai])}）</span>`);
    });
  }
  return `<div class="passage">${html}</div>`;
}
function explainHtml(q) {
  const res = q.pick === null ? '⚪ Chưa làm.' : isAns(q, q.pick) ? '✅ Đúng.' : '❌ Sai.';
  let html = q.type === 8
    ? `${res} Thứ tự đúng: <b>${(q.order || []).join(' → ')}</b> · ★ = <b class="jp">${jpt(q.options[q.ai])}</b>`
    : `${res} Đáp án: <b>${q.ai + 1}</b> <b class="jp">${q.type === 6 ? '' : jpt(q.options[q.ai])}</b>`;
  if (q.xp) {
    html += `<div class="xp"><div class="xp-vi">🇻🇳 ${nl2br(esc(q.xp.vi))}</div><div class="xp-why">💡 ${nl2br(esc(q.xp.why))}</div>
      <ul class="xp-opts">${q.xp.opts.map((o, j) => { const ok = isAns(q, j);
        const mark = q.type === 8 ? (ok ? '★' : '•') : ok ? '✓' : '✗';
        return `<li class="${ok ? 'ok' : q.type === 8 ? 'neutral' : 'bad'}${q.pick === j ? ' picked' : ''}"><b>${mark} ${j + 1}.</b> ${esc(o.replace(/^[✓✗]\s*/, ''))}</li>`; }).join('')}</ul></div>`;
  }
  if (q.note) html += `<div class="muted">⚠️ ${esc(q.note)}</div>`;
  if (q.src) html += `<div class="muted src-line">📍 ${esc(q.src)}</div>`;
  return html;
}
function renderExam(graded) {
  let prevT = null, prevPassage = null;
  $('examQs').innerHTML = exam.qs.map((q, i) => {
    const head = q.type !== prevT ? `<p class="exam-instr">${esc(TYPE_INFO[q.type].instr)}</p>` : '';
    prevT = q.type;
    const showPassage = q.type === 9 && q.passage !== prevPassage;
    prevPassage = q.type === 9 ? q.passage : null;
    const wide = [5, 6, 7, 8, 9].includes(q.type) && q.options.some(o => o.length > 8) || q.type === 6;
    const opts = q.options.map((o, j) => {
      let cls = 'm1-opt' + (q.type === 6 ? ' sent' : '');
      if (q.pick === j) cls += ' picked';
      if (graded && isAns(q, j)) cls += ' correct';
      else if (graded && q.pick === j) cls += ' wrong';
      return `<button class="${cls}" data-q="${i}" data-o="${j}" ${graded ? 'disabled' : ''}><b>${j + 1}</b> ${q.type === 6 ? underline(o) : jpt(o)}</button>`;
    }).join('');
    return `${head}${showPassage ? passageHtml(q, graded) : ''}<div class="m1-q">
      <div class="m1-sent"><span class="m1-no">${q.no}</span>${sentHtml(q, graded)}</div>
      <div class="m1-opts${wide ? ' vertical' : ''}">${opts}</div>
      ${graded ? `<div class="m1-explain">${explainHtml(q)}</div>` : ''}</div>`;
  }).join('');
}
$('examQs').addEventListener('click', e => {
  const b = e.target.closest('.m1-opt');
  if (!b || !exam || exam.graded) return;
  exam.qs[b.dataset.q].pick = Number(b.dataset.o);
  b.parentElement.querySelectorAll('.m1-opt').forEach(x => x.classList.toggle('picked', x === b));
});
$('examQuit').addEventListener('click', () => {
  if (exam && !exam.graded && !confirm('Thoát bài đang làm? Kết quả sẽ không được lưu.')) return;
  resetExam();
});
$('examSubmit').addEventListener('click', () => {
  if (!exam || exam.graded) return;
  const left = exam.qs.filter(q => q.pick === null).length;
  if (left && !confirm(`Còn ${left} câu chưa làm. Vẫn nộp bài?`)) return;
  clearInterval(exam.timer);
  exam.graded = true;
  const secs = Math.floor((Date.now() - exam.start) / 1000);
  let score = 0;
  const wrongQs = [];
  exam.qs.forEach(q => {
    const ok = q.pick !== null && isAns(q, q.pick);
    if (ok) score++; else wrongQs.push(q);
    recordQ(q, ok);
  });
  (state.examLog ||= []).push({ name: exam.name, date: todayStr(), n: exam.qs.length, score, secs });
  state.examLog = state.examLog.slice(-20);
  if (exam.bestKey) {
    const best = (state.bookBest ||= {});
    if (!best[exam.bestKey] || score > best[exam.bestKey].score) best[exam.bestKey] = { score, date: todayStr() };
  }
  save();
  renderExam(true);
  $('examSubmit').classList.add('hidden');
  const pct = Math.round(score / exam.qs.length * 100);
  const byT = {};
  exam.qs.forEach(q => { const x = (byT[q.type] ||= { n: 0, ok: 0 }); x.n++; if (q.pick !== null && isAns(q, q.pick)) x.ok++; });
  $('examResult').innerHTML = `<div class="result-big">${score}/${exam.qs.length} (${pct}%)</div>
    <p style="text-align:center">${esc(exam.name)} · Thời gian: ${fmtTime(secs)} · ${pct >= 80 ? 'Xuất sắc! 🎉' : pct >= 60 ? 'Khá tốt, cố thêm chút nữa! 💪' : 'Xem lại giải thích từng câu bên dưới nhé!'}</p>
    <div class="type-score">${Object.entries(byT).map(([t, x]) => `<span class="chip">${esc(TYPE_INFO[t].short)}: <b>${x.ok}/${x.n}</b></span>`).join('')}</div>
    <div class="actions">${wrongQs.length ? '<button class="btn bad" id="examRetry">Làm lại câu sai</button>' : ''}<button class="btn primary" id="examNew">Chọn đề khác</button></div>`;
  $('examResult').classList.remove('hidden');
  $('examNew').addEventListener('click', resetExam);
  if (wrongQs.length) $('examRetry').addEventListener('click', () => startExam(wrongQs.map(q => ({ ...q, pick: null })), 'Làm lại câu sai', null));
  window.scrollTo(0, 0);
});

// ===== Tra từ =====
$('listUnit').innerHTML = '<option value="">Tất cả unit</option>' + Object.entries(UNITS).map(([u, n]) => `<option value="${u}">Unit ${pad(u)} ${n}</option>`).join('');
['search', 'listUnit', 'listFilter'].forEach(id => $(id).addEventListener('input', renderList));
function renderList() {
  const q = fold($('search').value.trim()), u = $('listUnit').value, f = $('listFilter').value;
  const rows = WORDS.filter(w => (!u || w.unit === Number(u)) && (!q || w.search.includes(q)) &&
    (f === 'all' || (f === 'new' && !isLearned(w)) || (f === 'seen' && isLearned(w)) || (f === 'weak' && isWeak(w))));
  $('listCount').textContent = `${rows.length} từ`;
  $('listBody').innerHTML = rows.slice(0, 400).map(w => `<tr><td class="jp">${esc(w.kanji || w.kana)}<small>${w.kanji ? esc(w.kana) : ''}</small></td>
    <td>${esc(w.vi)}<br><span class="hvs">${esc(w.hv)}</span></td><td>${statusBadge(w)}</td><td><button data-say="${esc(w.kana)}">🔊</button></td></tr>`).join('')
    + (rows.length > 400 ? '<tr><td colspan="4" class="muted">… gõ thêm để lọc bớt</td></tr>' : '');
}

// ===== Cài đặt =====
function renderSettings() {
  $('setExam').value = state.settings.exam;
  $('setFront').value = state.settings.front;
  $('setBatch').value = state.settings.batch;
  $('setAutoSpeak').checked = !!state.settings.autoSpeak;
}
$('saveSettings').addEventListener('click', () => {
  if ($('setExam').value) state.settings.exam = $('setExam').value;
  state.settings.front = $('setFront').value;
  state.settings.batch = $('setBatch').value;
  state.settings.autoSpeak = $('setAutoSpeak').checked;
  state.settings.savedAt = Date.now();
  save();
  toast('Đã lưu cài đặt');
});
$('exportBtn').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(state)], { type: 'application/json' }));
  a.download = `tien-do-n2-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
$('importFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const s = JSON.parse(await file.text());
    if (!s.cards || !s.settings) throw new Error();
    state = typeof mergeStates === 'function' ? mergeStates(s, state) : s;
    save();
    toast('Đã gộp tiến độ từ file');
  } catch (err) { toast('File không hợp lệ'); }
  e.target.value = '';
});
$('resetBtn').addEventListener('click', () => {
  const online = typeof syncUser !== 'undefined' && syncUser;
  if (!confirm(online ? `Xoá toàn bộ tiến độ N2, cả bản đồng bộ của "${syncUser}"? Không thể hoàn tác.` : 'Xoá toàn bộ tiến độ N2? Không thể hoàn tác.')) return;
  localStorage.removeItem(STORE_KEY);
  state = load();
  if (online) syncPush(state).catch(() => toast('Không xoá được bản trên mạng'));
  save();
  showView('home');
});

// ===== Phím tắt =====
document.addEventListener('keydown', e => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (currentView === 'study' && session) {
    if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); if (session.view !== null) nextCard(); else session.flipped ? grade(true) : flip(); }
    else if (e.key === '1') grade(false);
    else if (e.key === '2') grade(true);
    else if (e.key === 'ArrowLeft') prevCard();
    else if (e.key === 'ArrowRight') nextCard();
  } else if (currentView === 'quiz' && quiz) {
    if (/^[1-4]$/.test(e.key)) quizAnswer(Number(e.key) - 1);
    else if (e.key === 'Enter' || e.code === 'Space') { e.preventDefault(); quizNextQ(); }
  }
});

save();
showView('home');
