'use strict';
// ===== Đọc hiểu 読解 N2 (問題10 短文 · 11 中文 · 12 統合理解 · 13 主張理解 · 14 情報検索) =====
// Dữ liệu READING (reading/*.jsonl -> data.js). Markup trong văn bản:
//   {漢字|よみ} furigana in sẵn trong đề · [漢字|よみ] furigana hỗ trợ (bật/tắt) · __x__ gạch chân
//   dòng "# " tiêu đề · "> " căn phải · "|a|b|" hàng bảng
const RD = (typeof READING === 'undefined' ? [] : READING).slice()
  .sort((a, b) => (a.exam < b.exam ? 1 : a.exam > b.exam ? -1 : 0) || a.part - b.part || a.set - b.set);
const RD_PART = {
  10: { name: '問題10 短文', vi: 'Đoạn ngắn', mins: 3,
        desc: '5 đoạn ngắn (~200 chữ: thông báo, email, đoạn bình luận), mỗi đoạn 1 câu hỏi. Mục tiêu ~2–3 phút/đoạn.',
        instr: '問題10　次の(1)から(5)の文章を読んで、後の問いに対する答えとして最もよいものを、１・２・３・４から一つ選びなさい。' },
  11: { name: '問題11 中文', vi: 'Đoạn trung bình', mins: 6,
        desc: '2–3 bài ~500 chữ (bình luận, giải thích, tuỳ bút), mỗi bài 2–3 câu hỏi theo thứ tự đoạn văn. Mục tiêu ~5–6 phút/bài.',
        instr: '問題11　次の(1)から(3)の文章を読んで、後の問いに対する答えとして最もよいものを、１・２・３・４から一つ選びなさい。' },
  12: { name: '問題12 統合理解', vi: 'Đọc so sánh A–B', mins: 6,
        desc: '2 văn bản A và B cùng một chủ đề, 2 câu hỏi so sánh quan điểm. Mục tiêu ~6 phút.',
        instr: '問題12　次のAとBの文章を読んで、後の問いに対する答えとして最もよいものを、１・２・３・４から一つ選びなさい。' },
  13: { name: '問題13 主張理解', vi: 'Đoạn dài (lập luận)', mins: 10,
        desc: '1 bài dài ~900 chữ nêu quan điểm của tác giả, 3 câu hỏi. Mục tiêu ~10 phút.',
        instr: '問題13　次の文章を読んで、後の問いに対する答えとして最もよいものを、１・２・３・４から一つ選びなさい。' },
  14: { name: '問題14 情報検索', vi: 'Tìm thông tin', mins: 7,
        desc: 'Tờ thông báo / hướng dẫn / bảng, 2 câu hỏi tìm thông tin theo điều kiện. Mục tiêu ~6–7 phút.',
        instr: '問題14　右のページは、ある案内である。下の問いに対する答えとして最もよいものを、１・２・３・４から一つ選びなさい。' },
};
const KIND_INFO = {
  detail: ['Hỏi chi tiết', 'Tìm từ khoá của câu hỏi trong bài rồi đọc kỹ câu chứa nó. So từng lựa chọn với đúng câu đó, không đoán theo cảm giác.'],
  reason: ['Hỏi lý do (どうして・なぜ)', 'Tìm 〜から・〜ので・〜ため・〜て gần chỗ được hỏi. Lý do có khi nằm ở câu ngay TRƯỚC hoặc ngay SAU.'],
  reference: ['Từ chỉ thị (それ・この・そこ…)', 'それ/この/そう… gần như luôn chỉ điều vừa nói ở câu NGAY TRƯỚC. Thử đặt đáp án vào chỗ đó xem câu có hợp nghĩa không.'],
  underline: ['Phần gạch chân', 'Đọc câu trước và câu sau phần gạch chân — bài thường giải thích lại ý đó bằng từ khác ngay bên cạnh.'],
  main: ['Ý chính / người viết muốn nói gì', 'Xem đoạn CUỐI và các câu có 〜と思います・〜たいです・〜ほうがいい・〜が大切です. Ý quan trọng hay đứng sau でも・しかし.'],
  search: ['Tìm thông tin', 'Gạch điều kiện trong câu hỏi (ngày, giờ, giá, ai, mấy người…), chỉ dò hàng/cột liên quan, và đọc kỹ dòng ※ chú thích.'],
  action: ['Phải làm gì', 'Tìm 〜てください・〜てくれませんか・〜なければなりません・〜ましょう — thường ở cuối thư/thông báo. Chú ý AI là người phải làm.'],
  truefalse: ['Chọn câu đúng với nội dung', 'Kiểm tra lần lượt từng lựa chọn với bài; câu sai thường chỉ lệch một chi tiết nhỏ (thời gian, người, số lượng).'],
  compare: ['So sánh A và B', 'Trước khi đọc, xem câu hỏi hỏi điểm CHUNG hay điểm KHÁC. Đọc A, tóm ý chính 1 dòng; đọc B, tóm 1 dòng; rồi so từng lựa chọn với cả hai.'],
};
const GUIDE_HTML = `
<h3>🧭 Cách làm bài đọc hiểu N2</h3>
<details open><summary><b>1. Phần đọc N2 gồm gì? Phân bổ thời gian ra sao?</b></summary>
<ul>
  <li>言語知識（文字・語彙・文法）・読解 làm chung <b>105 phút</b>. Làm phần từ vựng – ngữ pháp thật nhanh (~30–35 phút, câu nào không biết thì chọn luôn) để dành <b>~60 phút</b> cho đọc hiểu.</li>
  <li><b>問題10 短文</b> — 5 đoạn ngắn, mỗi đoạn 1 câu: <b>~2–3 phút/đoạn</b>.</li>
  <li><b>問題11 中文</b> — 2–3 bài vừa, 2–3 câu/bài: <b>~5–6 phút/bài</b>.</li>
  <li><b>問題12 統合理解</b> — 2 bài A, B cùng chủ đề, 2 câu: <b>~6 phút</b>.</li>
  <li><b>問題13 主張理解</b> — 1 bài dài nêu quan điểm, 3 câu: <b>~10 phút</b>.</li>
  <li><b>問題14 情報検索</b> — thông báo/bảng, 2 câu: <b>~6–7 phút</b>. Phần này dễ lấy điểm nhất — có thể làm TRƯỚC.</li>
</ul></details>
<details open><summary><b>2. Quy trình 4 bước cho mọi bài</b></summary>
<ol>
  <li><b>Đọc câu hỏi trước</b> (và các lựa chọn thật lướt). Gạch từ khoá: 筆者の考え? 理由? 「それ」とは?</li>
  <li><b>Đọc lướt toàn bài</b> nắm cấu trúc: vấn đề → ví dụ → <b>ý kiến người viết</b>. Ý kiến thường ở đoạn cuối và trong câu có 〜のではないか・〜べきだ・〜と思う・〜必要がある.</li>
  <li><b>Quay lại chỗ có từ khoá</b>, đọc kỹ câu đó + câu trước/sau. Với câu gạch chân: đáp án thường được diễn đạt lại ngay sau chỗ gạch chân.</li>
  <li><b>Loại trừ</b>: lựa chọn sai thường “đúng một nửa”, nói quá (いつも・必ず・全く), đảo nhân quả, hoặc là ý kiến của người khác chứ không phải của tác giả.</li>
</ol></details>
<details><summary><b>3. Mẹo riêng cho từng dạng</b></summary>
<ul>
  <li><b>短文</b>: câu hỏi hay là 筆者の言いたいことは? → câu cuối hoặc câu sau しかし・つまり. Email/thông báo → hỏi “cần làm gì”, đọc kỹ 〜てください・〜までに.</li>
  <li><b>中文</b>: câu hỏi đi theo thứ tự đoạn văn. Câu cuối thường hỏi ý chính cả bài.</li>
  <li><b>統合理解</b>: đọc A rồi tóm 1 dòng, đọc B rồi tóm 1 dòng (ủng hộ/phản đối? lý do?). Câu hỏi “AとBで共通して述べられていること” = điểm cả hai cùng nói.</li>
  <li><b>主張理解</b>: tìm câu luận điểm (thường lặp lại ở đầu và cuối). Đừng nhầm ví dụ / ý kiến phản bác mà tác giả trích dẫn với ý kiến của chính tác giả.</li>
  <li><b>情報検索</b>: KHÔNG đọc hết. Gạch điều kiện trong câu hỏi (ngày, giờ, đối tượng, phí, hạn chót), dò đúng mục, đọc kỹ ※ chú thích, 〜以上・〜未満・〜まで・ただし.</li>
</ul></details>
<details><summary><b>4. Từ “tín hiệu” quan trọng ở N2</b></summary>
<table class="sig-table">
  <tr><td class="jp">しかし・だが・ところが・とはいえ</td><td>Ý chính nằm SAU từ này.</td></tr>
  <tr><td class="jp">つまり・要するに・すなわち</td><td>Tóm lại — câu sau thường là đáp án ý chính.</td></tr>
  <tr><td class="jp">〜のではないか・〜べきだ・〜ねばならない</td><td>Ý kiến / chủ trương của tác giả.</td></tr>
  <tr><td class="jp">〜からだ・〜ためだ・というのは</td><td>Lý do → câu hỏi なぜ・どうして.</td></tr>
  <tr><td class="jp">確かに〜。しかし…</td><td>Thừa nhận ý ngược lại rồi phản bác — ý tác giả ở sau しかし.</td></tr>
  <tr><td class="jp">〜とは限らない・〜わけではない</td><td>Phủ định một phần — bẫy với lựa chọn nói tuyệt đối.</td></tr>
  <tr><td class="jp">それ・このような・こうした</td><td>Chỉ nội dung vừa nói ngay trước.</td></tr>
</table></details>
<details><summary><b>5. Cách luyện với app này (mỗi ngày 1–2 bài)</b></summary>
<ol>
  <li><b>Lần 1 — như thi thật:</b> tắt furigana hỗ trợ, canh đồng hồ theo mục tiêu.</li>
  <li><b>Xem chữa:</b> chỗ <mark>tô vàng</mark> là căn cứ đáp án — tự hỏi “vì sao mình bỏ sót?”. Đọc giải thích từng lựa chọn sai để nhận ra kiểu bẫy.</li>
  <li><b>Lần 2 — đọc kỹ:</b> xem bản dịch, học “Từ vựng của bài”, nghe 🔊 và đọc nhẩm theo.</li>
  <li>Vài ngày sau bấm “🔁 Làm lại bài sai”.</li>
</ol></details>`;

const rdQid = (p, q) => `R|${p.exam}|${p.part}|${p.set}|${q.no}`;
const rdLabel = p => `${examLabel(p.exam)} · ${RD_PART[p.part].name}${RD.some(o => o !== p && o.exam === p.exam && o.part === p.part) ? ` (${p.set})` : ''}`;
function rdStatus(p) {
  const st = p.qs.map(q => qstat(rdQid(p, q)));
  if (st.every(s => !s)) return 'new';
  if (p.qs.some(q => isQDue(rdQid(p, q)))) return 'due';
  return st.every(s => s && s.box > 0) ? 'done' : 'due';
}

// ----- Hiển thị văn bản có markup -----
const RUBY_RE = /\{([^{}|]*)\|([^{}|]*)\}|\[([^\[\]|]*)\|([^\[\]|]*)\]|__/g;
function rdTokens(str) {
  const out = [];
  let ul = false, last = 0, m;
  const plainChars = s => [...s].forEach(ch => out.push({ plain: ch, say: ch, html: esc(ch), ul }));
  RUBY_RE.lastIndex = 0;
  while ((m = RUBY_RE.exec(str))) {
    plainChars(str.slice(last, m.index));
    last = RUBY_RE.lastIndex;
    if (m[0] === '__') { ul = !ul; continue; }
    const aid = m[1] === undefined;
    const base = aid ? m[3] : m[1], read = aid ? m[4] : m[2];
    out.push({ plain: base, say: read, ul, html: `<ruby${aid ? ' class="aid"' : ''}>${esc(base)}<rt>${esc(read)}</rt></ruby>` });
  }
  plainChars(str.slice(last));
  return out;
}
// Tách ô bảng theo "|" nằm ngoài {..|..} và [..|..]
function rdCells(line) {
  const cells = [];
  let cur = '', depth = 0;
  for (const ch of line.replace(/^\||\|$/g, '')) {
    if (ch === '{' || ch === '[') depth++;
    if (ch === '}' || ch === ']') depth--;
    if (ch === '|' && depth === 0) { cells.push(cur); cur = ''; } else cur += ch;
  }
  cells.push(cur);
  return cells;
}
// Trả về { html, plain, say } — ranges: [{s, e}] vị trí (theo văn bản thuần) cần tô vàng
function rdRender(text, ranges = []) {
  let off = 0, plain = '', say = '', html = '', table = null;
  const span = toks => toks.map(t => {
    const s = off, e = off + t.plain.length;
    off = e; plain += t.plain; say += t.say;
    let h = t.html;
    if (ranges.some(r => r.s < e && r.e > s)) h = `<mark class="ev">${h}</mark>`;
    return t.ul ? `<u class="ul">${h}</u>` : h;
  }).join('');
  const flush = () => { if (table) { html += `<table class="rd-table">${table}</table>`; table = null; } };
  text.split('\n').forEach((line, i) => {
    if (i) { off++; plain += '\n'; say += '\n'; }
    if (line.startsWith('|')) {
      const first = !table;
      table ||= '';
      table += '<tr>' + rdCells(line).map(c => `<${first ? 'th' : 'td'}>${span(rdTokens(c))}</${first ? 'th' : 'td'}>`).join('') + '</tr>';
      return;
    }
    flush();
    if (line.startsWith('# ')) html += `<div class="rd-h">${span(rdTokens(line.slice(2)))}</div>`;
    else if (line.startsWith('> ')) html += `<div class="rd-right">${span(rdTokens(line.slice(2)))}</div>`;
    else html += `<p>${span(rdTokens(line)) || '&nbsp;'}</p>`;
  });
  flush();
  return { html, plain, say };
}
const rdInline = s => rdRender(s || '').html.replace(/^<p>|<\/p>$/g, '').replace(/<\/p><p>/g, '<br>');
function rdRanges(p, qs) {
  const plain = rdRender(p.passage).plain;
  const out = [];
  qs.forEach(q => (q.ev || []).forEach(e => { const s = plain.indexOf(e); if (s >= 0) out.push({ s, e: s + e.length }); }));
  return out;
}

// ----- Trang danh sách -----
let rdTab = 0;
function renderReadHome() {
  $('readRun').classList.add('hidden');
  $('readHome').classList.remove('hidden');
  const nq = RD.reduce((n, p) => n + p.qs.length, 0);
  const st = RD.map(rdStatus);
  const doneQ = RD.reduce((n, p) => n + p.qs.filter(q => qstat(rdQid(p, q))).length, 0);
  const rightQ = RD.reduce((n, p) => n + p.qs.filter(q => (qstat(rdQid(p, q))?.box || 0) > 0).length, 0);
  $('readStats').textContent = RD.length
    ? `${RD.length} bài · ${nq} câu từ ${new Set(RD.map(p => p.exam)).size} đề · đã làm ${st.filter(s => s !== 'new').length} bài` +
      (doneQ ? ` · lần gần nhất đúng ${rightQ}/${doneQ} câu` : '')
    : 'Chưa có dữ liệu bài đọc.';
  const next = rdNextList()[0];
  $('readNextInfo').textContent = next ? rdLabel(next) : 'Đã làm hết — làm lại bài sai nhé';
  const due = RD.filter((p, i) => st[i] === 'due');
  $('readRetryInfo').textContent = due.length ? `${due.length} bài cần làm lại` : 'Chưa có bài nào cần làm lại';
  document.querySelectorAll('#readTabs button').forEach(b => b.classList.toggle('active', Number(b.dataset.p) === rdTab));
  $('readTabDesc').textContent = rdTab ? RD_PART[rdTab].desc : 'Bấm vào một bài để làm. Xanh = lần gần nhất đúng hết · Cam = có câu sai, nên làm lại · Viền nét đứt = chưa làm.';
  const exams = [...new Set(RD.map(p => p.exam))];
  $('readList').innerHTML = exams.map(ex => {
    const ps = RD.filter(p => p.exam === ex && (!rdTab || p.part === rdTab));
    if (!ps.length) return '';
    return `<div class="rd-exam"><div class="rd-exam-head"><b>${esc(examLabel(ex))}</b>
        <button class="btn small" data-rexam="${esc(ex)}">Làm cả ${rdTab ? RD_PART[rdTab].name : 'phần đọc'}</button></div>
      <div class="book-grid">${ps.map(p => {
        const s = rdStatus(p);
        return `<button class="book-test rd-${s}${s === 'done' ? ' done' : s === 'due' ? ' tried' : ''}" data-ri="${RD.indexOf(p)}">
          <b>${esc(RD_PART[p.part].name.split(' ')[0])}${ps.filter(o => o.part === p.part).length > 1 ? ` (${p.set})` : ''}</b>
          <span>${esc(RD_PART[p.part].vi)} · ${p.qs.length} câu</span></button>`;
      }).join('')}</div></div>`;
  }).join('');
}
function rdNextList() {
  const fresh = RD.filter(p => rdStatus(p) === 'new');
  return rdTab ? fresh.filter(p => p.part === rdTab) : fresh;
}
$('readTabs').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) { rdTab = Number(b.dataset.p); renderReadHome(); } });
$('readGuideBtn').addEventListener('click', () => {
  $('readGuide').innerHTML = GUIDE_HTML;
  $('readGuide').classList.toggle('hidden');
});
$('readNext').addEventListener('click', () => {
  const list = rdNextList();
  if (!list.length) return toast('Bạn đã làm hết các bài ở mục này 🎉');
  startRead([list[0]], 'next');
});
$('readRetry').addEventListener('click', () => {
  const list = shuffle(RD.filter(p => rdStatus(p) === 'due'));
  if (!list.length) return toast('Chưa có bài nào cần làm lại');
  startRead(list);
});
$('readList').addEventListener('click', e => {
  const ex = e.target.closest('[data-rexam]');
  if (ex) return startRead(RD.filter(p => p.exam === ex.dataset.rexam && (!rdTab || p.part === rdTab)));
  const b = e.target.closest('[data-ri]');
  if (b) startRead([RD[b.dataset.ri]]);
});

// ----- Làm bài -----
let rd = null;
function startRead(list, mode) {
  rd = { list, i: 0, mode };
  $('readHome').classList.add('hidden');
  $('readRun').classList.remove('hidden');
  $('readFuri').checked = state.settings.readFuri !== false;
  showPassage();
}
function showPassage() {
  const p = rd.list[rd.i];
  if (rd.timer) clearInterval(rd.timer);
  Object.assign(rd, { p, picks: p.qs.map(() => null), graded: false, start: Date.now(), showVi: false });
  $('readName').textContent = rdLabel(p) + (rd.list.length > 1 ? ` · bài ${rd.i + 1}/${rd.list.length}` : '');
  $('readInstr').textContent = RD_PART[p.part].instr;
  $('readTip').classList.add('hidden');
  $('readTip').innerHTML = `💡 ${esc(p.tip)}`;
  $('readSubmit').classList.remove('hidden');
  $('readAfter').classList.add('hidden');
  renderRead();
  const tick = () => {
    const s = Math.floor((Date.now() - rd.start) / 1000), lim = RD_PART[p.part].mins * 60;
    $('readTimer').textContent = `${fmtTime(s)} / ${RD_PART[p.part].mins}:00`;
    $('readTimer').classList.toggle('over', s > lim);
  };
  tick();
  rd.timer = setInterval(tick, 1000);
  window.scrollTo(0, 0);
}
function applyFuri() {
  ['readBody', 'readQs'].forEach(id => $(id).classList.toggle('aid-off', !$('readFuri').checked));
}
function renderRead() {
  const p = rd.p, g = rd.graded;
  const ranges = g ? rdRanges(p, p.qs) : [];
  $('readBody').innerHTML = `${p.intro ? `<p class="rd-intro">${rdInline(p.intro)}</p>` : ''}
    <div class="rd-passage${p.part === 14 ? ' rd-info' : ''}">${rdRender(p.passage, ranges).html}</div>
    ${g && rd.showVi ? `<div class="rd-vi"><b>📘 Bản dịch</b>${p.vi.split('\n').map(l => `<p>${esc(l)}</p>`).join('')}</div>` : ''}`;
  $('readQs').innerHTML = p.qs.map((q, i) => {
    const opts = q.options.map((o, j) => {
      let cls = 'm1-opt sent';
      if (rd.picks[i] === j) cls += ' picked';
      if (g && j === q.answer - 1) cls += ' correct';
      else if (g && rd.picks[i] === j) cls += ' wrong';
      return `<button class="${cls}" data-q="${i}" data-o="${j}" ${g ? 'disabled' : ''}><b>${j + 1}</b> ${rdInline(o)}</button>`;
    }).join('');
    return `<div class="m1-q rd-q"><div class="m1-sent"><span class="m1-no">${q.no}</span>${rdInline(q.q)}</div>
      <div class="m1-opts vertical">${opts}</div>${g ? `<div class="m1-explain">${rdExplain(p, q, i)}</div>` : ''}</div>`;
  }).join('');
  applyFuri();
}
function rdExplain(p, q, i) {
  const pick = rd.picks[i];
  const res = pick === null ? '⚪ Chưa làm.' : pick === q.answer - 1 ? '✅ Đúng.' : '❌ Sai.';
  const k = KIND_INFO[q.kind];
  return `${res} Đáp án: <b>${q.answer}</b>
    ${k ? `<div class="rd-kind"><span class="badge b2">${esc(k[0])}</span> ${esc(k[1])}</div>` : ''}
    <div class="xp"><div class="xp-vi">🇻🇳 ${esc(q.xp.vi)}</div>
      <div class="rd-ev">📍 Căn cứ trong bài: ${q.ev.map(e => `<mark class="ev jp">${esc(e)}</mark>`).join(' … ')}</div>
      <div class="xp-why">💡 ${nl2br(esc(q.xp.why))}</div>
      <ul class="xp-opts">${q.xp.opts.map((o, j) => { const ok = j === q.answer - 1;
        return `<li class="${ok ? 'ok' : 'bad'}${pick === j ? ' picked' : ''}"><b>${ok ? '✓' : '✗'} ${j + 1}.</b> ${esc(o.replace(/^[✓✗]\s*/, ''))}</li>`; }).join('')}</ul></div>`;
}
$('readQs').addEventListener('click', e => {
  const b = e.target.closest('.m1-opt');
  if (!b || !rd || rd.graded) return;
  rd.picks[b.dataset.q] = Number(b.dataset.o);
  b.parentElement.querySelectorAll('.m1-opt').forEach(x => x.classList.toggle('picked', x === b));
});
$('readFuri').addEventListener('change', () => {
  state.settings.readFuri = $('readFuri').checked;
  save();
  applyFuri();
});
$('readTipBtn').addEventListener('click', () => $('readTip').classList.toggle('hidden'));
$('readSpeak').addEventListener('click', () => {
  if (!('speechSynthesis' in window)) return toast('Trình duyệt không hỗ trợ đọc phát âm');
  if (speechSynthesis.speaking) { speechSynthesis.cancel(); return; }
  const text = rdRender(rd.p.passage).say;
  // Chia theo câu để trình duyệt không cắt ngang bài dài
  text.split(/(?<=[。！？\n])/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean).forEach(s => {
    const u = new SpeechSynthesisUtterance(s);
    u.lang = 'ja-JP';
    if (jaVoice) u.voice = jaVoice;
    u.rate = 0.9;
    speechSynthesis.speak(u);
  });
});
$('readQuit').addEventListener('click', () => {
  if (rd && !rd.graded && rd.picks.some(x => x !== null) && !confirm('Thoát bài đang làm? Kết quả sẽ không được lưu.')) return;
  rdStop();
  renderReadHome();
});
function rdStop() {
  if (rd?.timer) clearInterval(rd.timer);
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  rd = null;
}
$('readSubmit').addEventListener('click', () => {
  if (!rd || rd.graded) return;
  const left = rd.picks.filter(x => x === null).length;
  if (left && !confirm(`Còn ${left} câu chưa chọn. Vẫn nộp bài?`)) return;
  clearInterval(rd.timer);
  rd.graded = true;
  const secs = Math.floor((Date.now() - rd.start) / 1000);
  const p = rd.p;
  let score = 0;
  p.qs.forEach((q, i) => {
    const ok = rd.picks[i] === q.answer - 1;
    if (ok) score++;
    recordQ({ qid: rdQid(p, q) }, ok);
  });
  (state.examLog ||= []).push({ name: `Đọc hiểu · ${rdLabel(p)}`, date: todayStr(), n: p.qs.length, score, secs });
  state.examLog = state.examLog.slice(-15);
  save();
  rd.score = score;
  rd.secs = secs;
  $('readSubmit').classList.add('hidden');
  renderRead();
  renderReadAfter();
  window.scrollTo(0, 0);
});
function renderReadAfter() {
  const p = rd.p, lim = RD_PART[p.part].mins * 60;
  const more = rd.i + 1 < rd.list.length;
  $('readAfter').innerHTML = `<div class="rd-result">${rd.score === p.qs.length ? '🎉' : rd.score ? '💪' : '📚'}
      Đúng <b>${rd.score}/${p.qs.length}</b> · ${fmtTime(rd.secs)} ${rd.secs > lim ? `<span class="bad-text">(quá mục tiêu ${RD_PART[p.part].mins} phút — luyện đọc lướt + đọc câu hỏi trước nhé)</span>` : '<span class="good-text">(trong thời gian mục tiêu)</span>'}</div>
    <p class="muted">Chỗ <mark class="ev">tô vàng</mark> trong bài là căn cứ của đáp án. Xem lại vì sao mình bỏ sót chỗ đó.</p>
    <div class="actions">
      <button class="btn" id="rdVi">${rd.showVi ? 'Ẩn bản dịch' : '📘 Xem bản dịch'}</button>
      <button class="btn" id="rdAgain">↺ Làm lại bài này</button>
      <button class="btn primary" id="rdNextBtn">${more ? 'Bài tiếp ▶' : rd.mode === 'next' ? 'Bài mới tiếp theo ▶' : 'Về danh sách'}</button>
    </div>
    ${p.vocab.length ? `<h4>📝 Từ vựng của bài</h4><table class="vocab-table rd-vocab">${p.vocab.map(v =>
      `<tr><td class="jp">${esc(v.w)}<small>${esc(v.r)}</small></td><td>${esc(v.m)}</td></tr>`).join('')}</table>` : ''}
    ${p.note ? `<p class="muted">⚠️ ${esc(p.note)}</p>` : ''}`;
  $('readAfter').classList.remove('hidden');
  $('rdVi').addEventListener('click', () => { rd.showVi = !rd.showVi; renderRead(); renderReadAfter(); });
  $('rdAgain').addEventListener('click', showPassage);
  $('rdNextBtn').addEventListener('click', () => {
    if (more) { rd.i++; return showPassage(); }
    if (rd.mode === 'next') {
      const list = rdNextList();
      if (list.length) { rd.list = [list[0]]; rd.i = 0; return showPassage(); }
    }
    rdStop();
    renderReadHome();
  });
}

// ----- Gắn vào app chính -----
const _rdShowView = showView;
showView = function (name) {
  if (currentView === 'read' && name !== 'read' && rd) rdStop();
  _rdShowView(name);
  if (name === 'read') renderReadHome();
};
const _rdRenderHome = renderHome;
renderHome = function () {
  _rdRenderHome();
  if (!RD.length) return;
  const due = RD.filter(p => rdStatus(p) === 'due').length;
  const fresh = RD.filter(p => rdStatus(p) === 'new').length;
  $('todoBox').appendChild(todoItem('📖 Đọc hiểu 読解',
    due ? `${due} bài đọc cần làm lại` : fresh ? `Mỗi ngày 1–2 bài đọc · còn ${fresh} bài chưa làm` : 'Đã làm hết các bài đọc 🎉',
    due ? 'Làm lại' : 'Đọc', () => { showView('read'); (due ? $('readRetry') : $('readNext')).click(); }));
};
if (currentView === 'home') renderHome();
