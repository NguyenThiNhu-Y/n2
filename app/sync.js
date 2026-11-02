'use strict';
// ===== Đồng bộ tiến độ giữa các máy bằng username (Firestore REST, không cần mật khẩu) =====
// Cấu hình Firebase nằm ở sync-config.js (projectId + apiKey).
const SYNC_USER_KEY = 'n2app.user';
const DOC_SUFFIX = '.n2';   // users/{username}.n2 — tách khỏi tiến độ app N4
const syncReady = () => typeof SYNC_CONFIG !== 'undefined' && !!SYNC_CONFIG.projectId && !!SYNC_CONFIG.apiKey;
const syncUrl = u => `https://firestore.googleapis.com/v1/projects/${SYNC_CONFIG.projectId}` +
  `/databases/(default)/documents/users/${encodeURIComponent(u + DOC_SUFFIX)}?key=${SYNC_CONFIG.apiKey}`;
const validUser = u => /^[a-z0-9_.-]{3,27}$/.test(u);
let syncUser = localStorage.getItem(SYNC_USER_KEY) || '';
let syncTimer = null, syncBusy = false, syncAgain = false;

// Gộp 2 bản tiến độ: mỗi từ / câu đề giữ bản đã luyện nhiều hơn, nên không bao giờ mất dữ liệu
function mergeStates(remote, local) {
  const pickMore = (x, y, n) => (!x ? y : !y ? x : n(y) > n(x) ? y : x);
  const mergeMap = (a = {}, b = {}, n) => {
    const out = {};
    new Set([...Object.keys(a), ...Object.keys(b)]).forEach(k => { out[k] = pickMore(a[k], b[k], n); });
    return out;
  };
  const out = { ...remote, ...local };
  out.cards = mergeMap(remote.cards, local.cards, c => (c.right || 0) + (c.wrong || 0) + (c.learned ? 0.5 : 0));
  out.qstats = mergeMap(remote.qstats, local.qstats, s => (s.r || 0) + (s.w || 0));
  out.bookBest = mergeMap(remote.bookBest, local.bookBest, b => b.score);
  const seen = new Set();
  out.examLog = [...(remote.examLog || []), ...(local.examLog || [])]
    .filter(r => { const k = JSON.stringify(r); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).slice(-30);
  // Cài đặt: lấy bản được lưu gần nhất; máy mới (chưa từng bấm Lưu) dùng cài đặt trên mạng
  out.settings = (local.settings?.savedAt || 0) > (remote.settings?.savedAt || 0) ? local.settings : remote.settings;
  return out;
}

async function syncPull() {
  const r = await fetch(syncUrl(syncUser));
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  return JSON.parse(j.fields?.data?.stringValue || 'null');
}
async function syncPush(data) {
  const body = { fields: { data: { stringValue: JSON.stringify(data) }, updated: { timestampValue: new Date().toISOString() } } };
  const r = await fetch(syncUrl(syncUser), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
}
function setSyncStatus(msg) {
  const el = document.getElementById('syncStatus');
  if (el) el.textContent = msg;
}
function renderUserChip() {
  const chip = document.getElementById('userChip');
  chip.textContent = syncUser ? '👤 ' + syncUser : '👤 Chưa đồng bộ';
  chip.classList.toggle('off', !syncUser);
}
// Lấy tiến độ trên mạng về, gộp với máy này, rồi đẩy bản gộp lên
async function syncNow(showToast) {
  if (!syncUser || !syncReady()) return;
  if (syncBusy) { syncAgain = true; return; }
  syncBusy = true;
  setSyncStatus('Đang đồng bộ…');
  try {
    const remote = await syncPull();
    if (remote) {
      state = mergeStates(remote, state);
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    }
    await syncPush(state);
    const t = new Date();
    setSyncStatus(`✅ Đã đồng bộ lúc ${pad(t.getHours())}:${pad(t.getMinutes())}`);
    if (showToast) toast('Đã đồng bộ tiến độ');
    // Cập nhật màn hình (không làm gián đoạn lúc đang học thẻ / làm bài)
    if (['home', 'vocab', 'gram', 'list', 'settings'].includes(currentView)) showView(currentView);
    if (currentView === 'exam' && !exam) resetExam();
  } catch (e) {
    setSyncStatus(`⚠️ Chưa đồng bộ được (${e.message}). Tiến độ vẫn lưu trên máy này, app sẽ thử lại.`);
  }
  syncBusy = false;
  if (syncAgain) { syncAgain = false; scheduleSync(); }
}
function scheduleSync() {
  if (!syncUser || !syncReady()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNow(false), 4000);
}

// Mỗi lần app lưu tiến độ thì hẹn đồng bộ sau vài giây
const saveLocal = save;
save = function () { saveLocal(); scheduleSync(); };

function renderSyncSettings() {
  document.getElementById('syncUser').value = syncUser;
  document.getElementById('syncNote').innerHTML = syncReady()
    ? 'Nhập cùng một <b>username</b> trên mọi máy để dùng chung tiến độ. Không cần mật khẩu — chọn tên khó đoán một chút (vd <i>nhuy-n2-2026</i>) vì ai biết tên cũng xem được tiến độ.'
    : '⚠️ Chưa cấu hình máy chủ đồng bộ (file <code>sync-config.js</code>).';
  document.getElementById('syncLogout').classList.toggle('hidden', !syncUser);
}
document.getElementById('syncLogin').addEventListener('click', async () => {
  const u = document.getElementById('syncUser').value.trim().toLowerCase();
  if (!validUser(u)) return toast('Username 3–27 ký tự: chữ thường không dấu, số, dấu - _ .');
  if (!syncReady()) return toast('Chưa cấu hình máy chủ đồng bộ');
  syncUser = u;
  localStorage.setItem(SYNC_USER_KEY, u);
  renderUserChip();
  renderSyncSettings();
  await syncNow(true);
});
document.getElementById('syncLogout').addEventListener('click', () => {
  if (!confirm('Thoát đồng bộ trên máy này? Tiến độ trên mạng vẫn giữ nguyên.')) return;
  syncUser = '';
  localStorage.removeItem(SYNC_USER_KEY);
  renderUserChip();
  renderSyncSettings();
  setSyncStatus('');
});
document.getElementById('userChip').addEventListener('click', () => showView('settings'));

// Ghi nhận thời điểm lưu cài đặt (để biết bản cài đặt nào mới hơn khi gộp)
document.getElementById('saveSettings').addEventListener('click', () => {
  state.settings.savedAt = Date.now();
  save();
}, true);

// Mở lại tab / quay lại app thì lấy tiến độ mới nhất từ máy khác
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(false); });

const _showView = showView;
showView = function (name) { _showView(name); if (name === 'settings') renderSyncSettings(); };
renderUserChip();
renderSyncSettings();
syncNow(false);
