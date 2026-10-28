import { createIcons, icons } from 'https://cdn.jsdelivr.net/npm/lucide@latest/+esm';
import { CATEGORIES, CURATED, TIME_WORDS, SUGGESTIONS, DEMO } from './data.js';

const $ = (s) => document.querySelector(s);
const icon = () => createIcons({ icons });
const byId = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
const esc = (s) => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

const state = {
  inputs: { have: '', need: '', offer: '' },
  allIdeas: [], page: 0, saved: [], history: ['home'], current: []
};

/* ---------- Options on home ---------- */
const OPTIONS = [
  { key: 'have', title: 'شي عندي', sub: 'غرض، أداة، أو شي بتملكه', icon: 'package-open', color: 'bg-brand-50 text-brand-700', ph: 'مثلاً: كاميرا وخبرة بتصوير المنتجات، كتب جامعية، ماكينة خياطة...' },
  { key: 'need', title: 'شي بحتاجه', sub: 'مهارة بدك تتعلمها أو خدمة ناقصتك', icon: 'search', color: 'bg-amber2-100 text-amber2-600', ph: 'مثلاً: بدي اتعلم تصميم لوغو، بحاجة حدا يصلّحلي اللابتوب...' },
  { key: 'offer', title: 'شي بقدر أقدمه', sub: 'وقتك، مهارتك، أو خدمة', icon: 'hand-heart', color: 'bg-rose-50 text-rose-600', ph: 'مثلاً: بطبخ أكل بيتي طيب، بدرّس رياضيات، عندي ساعتين بالأسبوع...' }
];

function renderOptions() {
  $('#options').innerHTML = OPTIONS.map(o => `
    <div class="opt bg-white border border-sand-200 rounded-2xl" data-key="${o.key}">
      <button class="opt-head w-full flex items-center gap-3 p-4 text-right">
        <span class="w-12 h-12 rounded-xl ${o.color} flex items-center justify-center shrink-0"><i data-lucide="${o.icon}" class="w-6 h-6"></i></span>
        <span class="flex-1 min-w-0">
          <span class="block font-bold text-[17px] text-slate-900">${o.title}</span>
          <span class="opt-sub block text-sm text-slate-500 truncate">${o.sub}</span>
        </span>
        <span class="opt-done hidden w-6 h-6 rounded-full bg-brand-600 text-white items-center justify-center"><i data-lucide="check" class="w-4 h-4"></i></span>
        <i data-lucide="chevron-down" class="chev w-5 h-5 text-slate-400"></i>
      </button>
      <div class="opt-body"><div>
        <div class="px-4 pb-4">
          <textarea rows="3" maxlength="300" class="w-full rounded-xl border border-sand-200 bg-sand-50 p-3 text-[16px] leading-7 focus:outline-none focus:border-brand-500 focus:bg-white" placeholder="${o.ph}"></textarea>
          <div class="flex gap-2 overflow-x-auto no-scrollbar mt-2">
            ${SUGGESTIONS[o.key].map(s => `<button class="chip shrink-0 text-sm px-3 py-1.5 rounded-full bg-sand-100 text-slate-700 hover:bg-sand-200">${s}</button>`).join('')}
          </div>
        </div>
      </div></div>
    </div>`).join('');

  document.querySelectorAll('.opt').forEach(el => {
    const key = el.dataset.key;
    const ta = el.querySelector('textarea');
    el.querySelector('.opt-head').onclick = () => {
      const wasOpen = el.classList.contains('open');
      el.classList.toggle('open');
      if (!wasOpen) setTimeout(() => ta.focus(), 200);
    };
    ta.oninput = () => { state.inputs[key] = ta.value; syncOption(el); };
    el.querySelectorAll('.chip').forEach(c => c.onclick = () => {
      ta.value = ta.value.trim() ? ta.value.trim() + '، ' + c.textContent : c.textContent;
      ta.dispatchEvent(new Event('input'));
    });
  });
}

function syncOption(el) {
  const key = el.dataset.key;
  const v = state.inputs[key].trim();
  const o = OPTIONS.find(x => x.key === key);
  el.querySelector('.opt-sub').textContent = v || o.sub;
  el.querySelector('.opt-sub').classList.toggle('text-brand-700', !!v);
  const done = el.querySelector('.opt-done');
  done.classList.toggle('hidden', !v); done.classList.toggle('flex', !!v);
  el.classList.toggle('border-brand-200', !!v);
  const any = Object.values(state.inputs).some(x => x.trim());
  $('#discoverBtn').disabled = !any;
  $('#hint').classList.toggle('invisible', any);
}

function fillInputs(data, open = true) {
  document.querySelectorAll('.opt').forEach(el => {
    const ta = el.querySelector('textarea');
    ta.value = data[el.dataset.key] || '';
    state.inputs[el.dataset.key] = ta.value;
    el.classList.toggle('open', open && !!ta.value);
    syncOption(el);
  });
}

/* ---------- Matching engine (local, no API) ---------- */
const norm = (t) => t.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[ًٌٍَُِّْ]/g, '');

function detect(text) {
  const t = norm(text);
  if (!t.trim()) return [];
  const scores = CATEGORIES.map(c => ({ id: c.id, s: c.kw.reduce((a, k) => a + (t.includes(norm(k)) ? 1 : 0), 0) }))
    .filter(x => x.s > 0).sort((a, b) => b.s - a.s);
  return scores.map(x => x.id);
}

const hasTime = (text) => TIME_WORDS.some(w => norm(text).includes(norm(w)));
const uniq = (a) => [...new Set(a)];
const snippet = (t) => { t = t.trim().split(/[،,.\n]/)[0].trim(); return t.length > 40 ? t.slice(0, 40) + '…' : t; };

function directIdea(g, n, score) {
  const G = byId[g], N = byId[n];
  const cur = CURATED[`${g}>${n}`];
  const hours = Math.max(G.hours, N.hours);
  if (cur) return { type: 'direct', key: `d-${g}-${n}`, ...cur, partner: N.partner, icons: [G.icon, N.icon], score, hours };
  return {
    type: 'direct', key: `d-${g}-${n}`,
    title: `${G.short} مقابل ${N.learn}`,
    summary: `في ناس عندهم خبرة ب${N.name} وبيحتاجوا ${G.give}. بتعطيهم من وقتك ومهارتك، وبياخدوا بإيدك ب${N.name}.`,
    give: `${G.give} (حوالي ${G.hours} ساعات)`,
    get: `${N.learn} (حوالي ${hours} ساعات)`,
    story: `${N.partner.name} من ${N.partner.area.split('،')[0]} عندها/عنده خبرة ب${N.name} وعم يدوّر على حدا بيعرف ب${G.name}.`,
    partner: N.partner, icons: [G.icon, N.icon], score, hours
  };
}

function circleIdea(g, n, mid, score) {
  const G = byId[g], N = byId[n], M = byId[mid];
  return {
    type: 'circle', key: `c-${g}-${mid}-${n}`,
    title: `تبادل دائري: ${G.short} ← ${M.short} ← ${N.short}`,
    summary: `ما في شرط الشخص اللي بتساعده يساعدك هو نفسه. بتقدّم ${G.give} ل${M.partner.name}، و${M.partner.name} بتساعد ${N.partner.name}، و${N.partner.name} بتعطيك ${N.learn}.`,
    give: `${G.give} ل${M.partner.name}`,
    get: `${N.learn} من ${N.partner.name}`,
    story: `الدائرة: إنت ← ${M.partner.name} (${M.name}) ← ${N.partner.name} (${N.name}) ← إنت. كل واحد بيعطي شي وبياخد شي.`,
    partner: N.partner, chain: [M.partner, N.partner], icons: [G.icon, M.icon, N.icon], score, hours: N.hours
  };
}

function timeBankIdea(g, n, score) {
  const G = g ? byId[g] : null, N = n ? byId[n] : null;
  return {
    type: 'bank', key: `b-${g}-${n}`,
    title: 'بنك الوقت بالحارة',
    summary: `كل ساعة بتقدّمها لأي حدا بالمجموعة بتنحسبلك ساعة رصيد، وبتصرفها على أي خدمة بتحتاجها${N ? ` متل ${N.learn}` : ''}.`,
    give: G ? `ساعة ${G.give}` : 'ساعة من وقتك بأي مساعدة',
    get: N ? `ساعة ${N.learn} من أي عضو` : 'ساعة من أي خدمة بالمجموعة',
    story: 'بنك وقت فيه 40 جار بالمزة: الأستاذ بيدرّس، الطبّاخة بتطبخ، والشب بيصلّح. ساعة الكل إلها نفس القيمة.',
    partner: { name: 'مجموعة جيران المنطقة', area: '40 عضو قريب منك', note: 'مجموعة تبادل محلية' },
    icons: ['hourglass', G ? G.icon : 'clock', N ? N.icon : 'users'], score, hours: 1
  };
}

function goodsIdea(score, haveText) {
  return {
    type: 'swap', key: 'g-swap',
    title: 'بازار مقايضة بالحي',
    summary: 'جيب الأغراض اللي ما عم تستعملها لبازار مقايضة شهري، وبدّلها بأغراض بتحتاجها. بلا مصاري، بس قيمة مقابل قيمة.',
    give: haveText ? snippet(haveText) : 'أغراض ما عم تستعملها',
    get: 'أغراض بتحتاجها من الجيران',
    story: 'جود بدّلت كتبها الجامعية القديمة ببسكليت، وصاحبة البسكليت أخدت الكتب لبنتها.',
    partner: byId.goods.partner, icons: ['package', 'repeat', 'shopping-bag'], score, hours: 2
  };
}

function generate({ have, need, offer }) {
  let give = uniq([...detect(have), ...detect(offer)]);
  if (hasTime(offer) || hasTime(have)) give = uniq([...give, 'childcare']);
  let needs = detect(need);
  const ideas = [];

  const giveFallback = give.length === 0 && (have.trim() || offer.trim());
  if (give.length === 0) give = (have.trim() || offer.trim()) ? ['childcare'] : [];
  if (needs.length === 0 && need.trim()) needs = ['tutoring'];

  give.forEach((g, gi) => {
    const targets = needs.length ? needs : byId[g].pairs;
    targets.forEach((n, ni) => {
      if (n === g && g !== 'goods') return;
      ideas.push(directIdea(g, n, 96 - gi * 5 - ni * 4 - (needs.length ? 0 : 6) - (giveFallback ? 10 : 0)));
    });
  });

  if (!give.length && needs.length) {
    needs.forEach((n, ni) => ['cooking', 'childcare', 'goods'].forEach((g, gi) => ideas.push(directIdea(g, n, 88 - ni * 5 - gi * 4))));
  }

  const g0 = give[0] || 'childcare';
  const nList = needs.length ? needs : byId[g0].pairs.slice(0, 2);
  nList.forEach((n, ni) => {
    const mids = byId[g0].pairs.filter(m => m !== n && m !== g0);
    mids.slice(0, 2).forEach((m, mi) => ideas.push(circleIdea(g0, n, m, 84 - ni * 4 - mi * 5)));
  });

  ideas.push(timeBankIdea(give[0], needs[0], 80));
  if (give.includes('goods') || detect(have).length === 0 && have.trim()) ideas.push(goodsIdea(78, have));

  const seen = new Set();
  const list = ideas.filter(i => !seen.has(i.key) && seen.add(i.key)).sort((a, b) => b.score - a.score);
  const pick = (t) => list.filter(i => i.type === t);
  const direct = pick('direct'), circle = pick('circle'), other = list.filter(i => i.type === 'bank' || i.type === 'swap');
  const ordered = [];
  const max = Math.max(direct.length, circle.length, other.length);
  for (let i = 0; i < max; i++) {
    if (direct[i * 2]) ordered.push(direct[i * 2]);
    if (direct[i * 2 + 1]) ordered.push(direct[i * 2 + 1]);
    if (circle[i]) ordered.push(circle[i]);
    if (other[i]) ordered.push(other[i]);
  }
  const firstOther = ordered.findIndex(i => i.type !== 'direct' && i.type !== 'circle');
  if (firstOther > 2) { const [o] = ordered.splice(firstOther, 1); ordered.splice(2, 0, o); }
  return { ideas: ordered, give, needs };
}

/* ---------- Rendering results ---------- */
const TYPE = {
  direct: { label: 'تبادل مباشر', cls: 'bg-brand-50 text-brand-700', icon: 'arrow-left-right' },
  circle: { label: 'تبادل دائري', cls: 'bg-violet-50 text-violet-700', icon: 'refresh-ccw' },
  bank: { label: 'بنك وقت', cls: 'bg-amber2-100 text-amber2-600', icon: 'hourglass' },
  swap: { label: 'مقايضة أغراض', cls: 'bg-rose-50 text-rose-700', icon: 'repeat' }
};

function card(idea, i) {
  const t = TYPE[idea.type];
  const isSaved = state.saved.some(s => s.key === idea.key);
  return `
  <article class="bg-white border border-sand-200 rounded-3xl overflow-hidden" data-key="${idea.key}">
    <div class="p-5">
      <div class="flex items-center justify-between mb-3">
        <span class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${t.cls}"><i data-lucide="${t.icon}" class="w-3.5 h-3.5"></i>${t.label}</span>
        <span class="text-xs font-semibold text-slate-500 flex items-center gap-1"><i data-lucide="target" class="w-3.5 h-3.5"></i>توافق ${idea.score}%</span>
      </div>
      <div class="flex items-center gap-1.5 mb-3">
        ${idea.icons.map((ic, k) => `${k ? '<i data-lucide="arrow-left" class="w-3.5 h-3.5 text-slate-300"></i>' : ''}<span class="w-9 h-9 rounded-xl bg-sand-100 text-slate-700 flex items-center justify-center"><i data-lucide="${ic}" style="width:18px;height:18px"></i></span>`).join('')}
      </div>
      <h3 class="font-bold text-[18px] text-slate-900 leading-8">${i != null ? `<span class="text-amber2-500">${i + 1}.</span> ` : ''}${esc(idea.title)}</h3>
      <p class="text-[15px] leading-7 text-slate-600 mt-1">${esc(idea.summary)}</p>

      <div class="grid grid-cols-2 gap-2 mt-4">
        <div class="rounded-2xl bg-sand-50 border border-sand-200 p-3">
          <p class="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1"><i data-lucide="arrow-up-left" class="w-3.5 h-3.5"></i>إنت بتقدّم</p>
          <p class="text-sm font-semibold text-slate-800 leading-6">${esc(idea.give)}</p>
        </div>
        <div class="rounded-2xl bg-brand-50 border border-brand-100 p-3">
          <p class="text-xs font-semibold text-brand-700 mb-1 flex items-center gap-1"><i data-lucide="arrow-down-right" class="w-3.5 h-3.5"></i>بتاخد بالمقابل</p>
          <p class="text-sm font-semibold text-brand-900 leading-6">${esc(idea.get)}</p>
        </div>
      </div>

      <div class="mt-4 rounded-2xl border border-dashed border-sand-200 p-3 flex gap-2">
        <i data-lucide="lightbulb" class="w-4 h-4 text-amber2-500 mt-1 shrink-0"></i>
        <p class="text-sm leading-6 text-slate-600"><span class="font-semibold text-slate-700">مثال واقعي: </span>${esc(idea.story)}</p>
      </div>

      <div class="flex items-center gap-3 mt-4">
        <span class="w-10 h-10 rounded-full bg-brand-700 text-white font-bold flex items-center justify-center shrink-0">${esc(idea.partner.name.charAt(0))}</span>
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-slate-900 text-sm truncate">${esc(idea.partner.name)}</p>
          <p class="text-xs text-slate-500 truncate flex items-center gap-1"><i data-lucide="map-pin" class="w-3 h-3"></i>${esc(idea.partner.area)}</p>
        </div>
        <span class="text-xs text-slate-500 flex items-center gap-1 shrink-0"><i data-lucide="clock" class="w-3.5 h-3.5"></i>${idea.hours} ساعات تقريباً</span>
      </div>
    </div>
    <div class="grid grid-cols-[1fr_auto_auto] gap-2 px-5 pb-5">
      <button class="act-contact h-12 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-semibold flex items-center justify-center gap-2"><i data-lucide="message-circle" class="w-4 h-4"></i>تواصل واقترح التبادل</button>
      <button class="act-save w-12 h-12 rounded-xl border ${isSaved ? 'border-amber2-500 bg-amber2-100 text-amber2-600' : 'border-sand-200 text-slate-600'} flex items-center justify-center" aria-label="حفظ"><i data-lucide="${isSaved ? 'bookmark-check' : 'bookmark'}" class="w-5 h-5"></i></button>
      <button class="act-share w-12 h-12 rounded-xl border border-sand-200 text-slate-600 flex items-center justify-center" aria-label="مشاركة"><i data-lucide="share-2" class="w-5 h-5"></i></button>
    </div>
  </article>`;
}

function bindCards(container, list) {
  container.querySelectorAll('article').forEach(el => {
    const idea = list.find(i => i.key === el.dataset.key) || state.saved.find(i => i.key === el.dataset.key);
    el.querySelector('.act-contact').onclick = () => openContact(idea);
    el.querySelector('.act-save').onclick = () => toggleSave(idea);
    el.querySelector('.act-share').onclick = () => share(idea);
  });
}

function renderResults() {
  const start = (state.page * 3) % Math.max(state.allIdeas.length, 1);
  let page = state.allIdeas.slice(start, start + 3);
  if (page.length < 3) page = page.concat(state.allIdeas.slice(0, 3 - page.length));
  page = page.filter((v, i, a) => a.findIndex(x => x.key === v.key) === i);
  state.current = page;
  $('#resCount').textContent = page.length;
  $('#results').innerHTML = page.map((x, i) => card(x, i)).join('');
  bindCards($('#results'), page);

  const labels = { have: 'عندي', need: 'بحتاج', offer: 'بقدّم' };
  $('#inputSummary').innerHTML = Object.entries(state.inputs).filter(([, v]) => v.trim()).map(([k, v]) =>
    `<span class="text-sm bg-white border border-sand-200 rounded-full px-3 py-1.5 max-w-full truncate"><span class="font-semibold text-brand-700">${labels[k]}:</span> ${esc(snippet(v))}</span>`).join('');
  $('#moreBtn').classList.toggle('opacity-40', state.allIdeas.length <= 3);
  icon();
}

function renderSaved() {
  const n = state.saved.length;
  $('#savedBadge').textContent = n;
  $('#savedBadge').classList.toggle('hidden', !n);
  $('#savedList').innerHTML = n ? state.saved.map(x => card(x)).join('') : `
    <div class="text-center py-16">
      <div class="w-16 h-16 rounded-2xl bg-sand-100 text-slate-400 flex items-center justify-center mx-auto mb-4"><i data-lucide="bookmark" class="w-7 h-7"></i></div>
      <p class="font-bold text-slate-800">لسا ما حفظت شي</p>
      <p class="text-sm text-slate-500 mt-1 mb-5">اكبس على علامة الحفظ بأي فكرة عجبتك</p>
      <button class="go-home h-12 px-6 rounded-2xl bg-brand-700 text-white font-semibold">اكتشف فرص</button>
    </div>`;
  const gh = $('#savedList .go-home'); if (gh) gh.onclick = () => go('home');
  bindCards($('#savedList'), state.saved);
  icon();
}

function toggleSave(idea) {
  const i = state.saved.findIndex(s => s.key === idea.key);
  if (i >= 0) { state.saved.splice(i, 1); toast('انشالت من المحفوظات'); }
  else { state.saved.unshift(idea); toast('انحفظت الفكرة'); }
  renderSaved();
  if (currentScreen() === 'results') renderResults();
}

/* ---------- Contact sheet ---------- */
function openContact(idea) {
  const first = idea.partner.name;
  const msg = `مرحبا ${first}! شفت إنو ممكن نتبادل عن طريق «لو عندك». أنا فيني قدّم: ${idea.give}، ومقابلها بحتاج: ${idea.get}. شو رأيك نحكي ونتفق على التفاصيل؟`;
  $('#sheetContent').innerHTML = `
    <div class="flex items-center gap-3 mb-4">
      <span class="w-12 h-12 rounded-full bg-brand-700 text-white font-bold text-lg flex items-center justify-center">${esc(first.charAt(0))}</span>
      <div><p class="font-bold text-slate-900">${esc(first)}</p><p class="text-sm text-slate-500">${esc(idea.partner.note)}</p></div>
    </div>
    <label class="text-sm font-semibold text-slate-700">رسالتك المقترحة</label>
    <textarea id="msgBox" rows="5" class="mt-2 w-full rounded-xl border border-sand-200 bg-sand-50 p-3 text-[15px] leading-7 focus:outline-none focus:border-brand-500">${esc(msg)}</textarea>
    <p class="text-xs text-slate-500 mt-2 flex items-center gap-1"><i data-lucide="info" class="w-3.5 h-3.5"></i>هاد شخص تجريبي. بالنسخة الجاية رح تقدر تبعت الرسالة مباشرة.</p>
    <div class="grid grid-cols-2 gap-3 mt-4">
      <button id="sendMsg" class="h-12 rounded-xl bg-brand-700 text-white font-semibold flex items-center justify-center gap-2"><i data-lucide="send" class="w-4 h-4"></i>ابعت الطلب</button>
      <button id="copyMsg" class="h-12 rounded-xl border border-sand-200 text-slate-700 font-semibold flex items-center justify-center gap-2"><i data-lucide="copy" class="w-4 h-4"></i>انسخ الرسالة</button>
    </div>`;
  icon();
  $('#sheet').classList.add('show'); $('#backdrop').classList.add('show');
  $('#sendMsg').onclick = () => { closeSheet(); toast(`انبعت طلب التبادل ل${first}`); };
  $('#copyMsg').onclick = async () => {
    try { await navigator.clipboard.writeText($('#msgBox').value); toast('انتسخت الرسالة'); }
    catch { $('#msgBox').select(); toast('حدّد النص وانسخه'); }
  };
}
function closeSheet() { $('#sheet').classList.remove('show'); $('#backdrop').classList.remove('show'); }

async function share(idea) {
  const text = `${idea.title}\n${idea.summary}\n— من تطبيق «لو عندك»`;
  try {
    if (navigator.share) await navigator.share({ title: 'لو عندك', text });
    else { await navigator.clipboard.writeText(text); toast('انتسخت الفكرة للمشاركة'); }
  } catch { /* cancelled */ }
}

let tTimer;
function toast(t) {
  $('#toastText').textContent = t;
  $('#toast').classList.remove('opacity-0');
  clearTimeout(tTimer); tTimer = setTimeout(() => $('#toast').classList.add('opacity-0'), 2000);
}

/* ---------- Navigation ---------- */
const currentScreen = () => state.history[state.history.length - 1];
function go(name, push = true) {
  if (push && currentScreen() !== name) state.history.push(name);
  if (name === 'home') state.history = ['home'];
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === `screen-${name}`));
  $('#backBtn').classList.toggle('hidden', name === 'home');
  $('#backBtn').classList.toggle('flex', name !== 'home');
  document.querySelectorAll('.nav-btn').forEach(b => {
    const on = b.dataset.nav === name || (name === 'results' && b.dataset.nav === 'home');
    b.classList.toggle('text-brand-700', on); b.classList.toggle('text-slate-400', !on);
  });
  if (name === 'saved') renderSaved();
  window.scrollTo({ top: 0 });
}

function discover() {
  const r = generate(state.inputs);
  state.allIdeas = r.ideas; state.page = 0;
  go('loading');
  const steps = ['عم نقارن اللي عندك مع اللي بيحتاجه غيرك', 'عم ندوّر على ناس قريبين منك', 'عم نرتّب أحسن 3 أفكار إلك'];
  let s = 0; $('#loadingText').textContent = steps[0];
  const iv = setInterval(() => { s++; if (steps[s]) $('#loadingText').textContent = steps[s]; }, 450);
  setTimeout(() => { clearInterval(iv); state.history = ['home']; go('results'); renderResults(); }, 1400);
}

/* ---------- Home feed ---------- */
function renderFeed() {
  const items = [
    { a: 'ريم', b: 'سامر', g: 'صور منتجات', t: 'دروس تصميم', ic: 'camera' },
    { a: 'أم خالد', b: 'لين', g: 'طبخة شامية', t: 'محادثة إنكليزي', ic: 'chef-hat' },
    { a: 'باسل', b: 'أستاذ مازن', g: 'تصليح لابتوب', t: 'دروس رياضيات', ic: 'laptop' },
    { a: 'سلمى', b: 'دانة', g: 'تطريز يدوي', t: 'إدارة صفحة', ic: 'scissors' }
  ];
  $('#feed').innerHTML = items.map(x => `
    <div class="shrink-0 w-60 bg-white border border-sand-200 rounded-2xl p-4">
      <div class="flex items-center gap-2 mb-3">
        <span class="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center"><i data-lucide="${x.ic}" class="w-4 h-4"></i></span>
        <p class="text-sm font-semibold text-slate-800">${x.a} و ${x.b}</p>
      </div>
      <p class="text-sm text-slate-600 leading-6"><span class="font-semibold text-slate-800">${x.g}</span> <i data-lucide="arrow-left-right" class="inline w-3.5 h-3.5 text-amber2-500"></i> <span class="font-semibold text-slate-800">${x.t}</span></p>
    </div>`).join('');
}

function renderHow() {
  const steps = [
    ['pencil-line', 'احكي عن حالك', 'اكتب شو عندك، شو بتحتاج، وشو فيك تقدّم. حتى لو خيار واحد بس.'],
    ['sparkles', 'اكتشف الفرص', 'منقترحلك أفكار تبادل مباشر، دائري، أو بنك وقت حسب أجوبتك.'],
    ['message-circle', 'تواصل واتفق', 'ابعت رسالة جاهزة للشخص المناسب واتفقوا على التفاصيل.'],
    ['handshake', 'بادل بلا مصاري', 'كل واحد بياخد اللي بيحتاجه، والكل بيربح.']
  ];
  $('#howList').innerHTML = steps.map(([ic, t, d], i) => `
    <li class="bg-white border border-sand-200 rounded-2xl p-4 flex gap-3">
      <span class="w-11 h-11 rounded-xl bg-brand-700 text-white flex items-center justify-center shrink-0"><i data-lucide="${ic}" class="w-5 h-5"></i></span>
      <div><p class="font-bold text-slate-900">${i + 1}. ${t}</p><p class="text-sm text-slate-600 leading-6 mt-0.5">${d}</p></div>
    </li>`).join('');
}

/* ---------- Init ---------- */
renderOptions(); renderFeed(); renderHow(); renderSaved();
$('#discoverBtn').onclick = discover;
$('#demoBtn').onclick = () => { fillInputs(DEMO); toast('تعبّى المثال، اكبس «اكتشف الفرص»'); };
$('#sampleBtn').onclick = () => { fillInputs(DEMO, false); discover(); };
$('#moreBtn').onclick = () => { if (state.allIdeas.length <= 3) return toast('هدول كل الأفكار حالياً'); state.page++; renderResults(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
$('#editBtn').onclick = () => go('home');
$('#backBtn').onclick = () => { state.history.pop(); go(state.history[state.history.length - 1] || 'home', false); };
$('#backdrop').onclick = closeSheet;
document.querySelectorAll('.nav-btn').forEach(b => b.onclick = () => go(b.dataset.nav));
go('home', false);
icon();

/* ---------- Add swap advertisement ---------- */
const SWAP_SUPABASE_URL = 'https://izkguvohogjjjxrjdsob.supabase.co';
const SWAP_SUPABASE_KEY = 'sb_publishable_EK6hrMLSNxDbbUj_cQJFrg_BUinV033';

const addSwapButton = document.createElement('button');
addSwapButton.type = 'button';
addSwapButton.textContent = '+ أضف إعلان تبادل';
addSwapButton.className =
  'mt-4 w-full h-14 rounded-2xl bg-brand-700 text-white font-bold text-lg';

const sampleButton = document.querySelector('#sampleBtn');
if (sampleButton) sampleButton.after(addSwapButton);

const swapFormLayer = document.createElement('div');
swapFormLayer.className =
  'fixed inset-0 z-[100] bg-black/50 p-4 flex items-center justify-center hidden';
swapFormLayer.innerHTML = `
  <form id="swapAdForm"
    class="bg-white w-full max-w-lg rounded-2xl p-5 space-y-3 overflow-y-auto"
    style="max-height:90vh">
    <h2 class="text-xl font-bold text-slate-900">أضف إعلان تبادل</h2>
    <p class="text-sm text-slate-500">اكتب شو عندك وشو بدك بالمقابل.</p>

    <label class="block text-sm font-semibold">عنوان الإعلان</label>
    <input name="title" required minlength="4" maxlength="100"
      placeholder="مثلاً: ببادل لابتوب بموبايل"
      class="w-full rounded-xl border p-3">

    <label class="block text-sm font-semibold">تفاصيل التبادل</label>
    <textarea name="description" required minlength="10" maxlength="1100"
      rows="4" placeholder="وصف الشي الموجود عندك والشي المطلوب بالمقابل"
      class="w-full rounded-xl border p-3"></textarea>

    <label class="block text-sm font-semibold">المدينة أو المنطقة</label>
    <input name="location" required minlength="2" maxlength="80"
      placeholder="مثلاً: دمشق"
      class="w-full rounded-xl border p-3">

    <label class="block text-sm font-semibold">وسيلة التواصل</label>
    <input name="contact" required minlength="5" maxlength="120"
      placeholder="رقم أو وسيلة تواصل مناسبة"
      class="w-full rounded-xl border p-3">

    <p class="text-xs text-slate-500">
      لا تضع كلمات مرور أو معلومات شخصية حساسة في الإعلان.
    </p>

    <button type="submit"
      class="w-full rounded-xl bg-brand-700 text-white font-bold p-3">
      نشر الإعلان
    </button>
    <button type="button" id="cancelSwapAd"
      class="w-full rounded-xl border p-3">إلغاء</button>
    <p id="swapAdStatus" class="text-sm" role="status"></p>
  </form>
`;
document.body.append(swapFormLayer);

addSwapButton.addEventListener('click', () => {
  swapFormLayer.classList.remove('hidden');
});

document.querySelector('#cancelSwapAd').addEventListener('click', () => {
  swapFormLayer.classList.add('hidden');
});

swapFormLayer.addEventListener('click', event => {
  if (event.target === swapFormLayer) {
    swapFormLayer.classList.add('hidden');
  }
});

document.querySelector('#swapAdForm').addEventListener('submit', async event => {
  event.preventDefault();

  const form = event.currentTarget;
  const status = document.querySelector('#swapAdStatus');
  const submitButton = form.querySelector('button[type="submit"]');
  const values = new FormData(form);

  const ad = {
    title: String(values.get('title')).trim(),
    description: String(values.get('description')).trim(),
    category: 'تبادل',
    location: String(values.get('location')).trim(),
    contact: String(values.get('contact')).trim()
  };

  submitButton.disabled = true;
  status.textContent = 'عم ننشر الإعلان...';

  try {
    const response = await fetch(
      `${SWAP_SUPABASE_URL}/rest/v1/ads`,
      {
        method: 'POST',
        headers: {
          apikey: SWAP_SUPABASE_KEY,
          Authorization: `Bearer ${SWAP_SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(ad)
      }
    );

    if (!response.ok) {
      const details = await response.text();
      throw new Error(details || `HTTP ${response.status}`);
    }

    status.textContent = 'تم نشر الإعلان بنجاح!';
    form.reset();

    setTimeout(() => {
      swapFormLayer.classList.add('hidden');
      status.textContent = '';
    }, 1200);
  } catch (error) {
    console.error('Swap ad error:', error);
    status.textContent =
      'ما قدرنا ننشر الإعلان. تحقق من الاتصال وإعدادات Supabase وحاول مجدداً.';
  } finally {
    submitButton.disabled = false;
  }
});

/* ---------- Load published swap ads ---------- */
async function loadPublishedSwapAds() {
  try {
    const response = await fetch(
      `${SWAP_SUPABASE_URL}/rest/v1/ads?select=id,title,description,location,created_at&category=eq.%D8%AA%D8%A8%D8%A7%D8%AF%D9%84&order=created_at.desc`,
      {
        headers: {
          apikey: SWAP_SUPABASE_KEY,
          Authorization: `Bearer ${SWAP_SUPABASE_KEY}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const ads = await response.json();

    let container = document.querySelector('#publishedSwapAds');

    if (!container) {
      container = document.createElement('section');
      container.id = 'publishedSwapAds';
      container.className = 'mx-auto w-full max-w-3xl p-4 space-y-3';

      const main = document.querySelector('main');
      if (main) {
        main.prepend(container);
      } else {
        document.body.prepend(container);
      }
    }

    container.replaceChildren();

    const heading = document.createElement('h2');
    heading.textContent = 'إعلانات التبادل المنشورة';
    heading.className = 'text-xl font-bold';
    container.appendChild(heading);

    if (ads.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'ما في إعلانات منشورة حالياً.';
      container.appendChild(empty);
      return;
    }

    ads.forEach(ad => {
      const card = document.createElement('article');
      card.className = 'rounded-2xl border p-4 space-y-2';

      const title = document.createElement('h3');
      title.className = 'font-bold text-lg';
      title.textContent = ad.title;

      const description = document.createElement('p');
      description.className = 'text-sm';
      description.textContent = ad.description || '';

      const location = document.createElement('p');
      location.className = 'text-sm text-slate-500';
      location.textContent = `الموقع: ${ad.location || 'غير محدد'}`;

      card.append(title, description, location);
      container.appendChild(card);
    });
  } catch (error) {
    console.error('Loading swap ads failed:', error);
  }
}

loadPublishedSwapAds();

/* ---------- Search and filter swap ads ---------- */
(function addSwapAdsSearch() {
  const adsContainer = document.querySelector('#publishedSwapAds');
  if (!adsContainer || document.querySelector('#swapAdsSearch')) return;

  const searchBox = document.createElement('input');
  searchBox.id = 'swapAdsSearch';
  searchBox.type = 'search';
  searchBox.placeholder = 'ابحث عن غرض أو مدينة...';
  searchBox.setAttribute('aria-label', 'البحث عن إعلانات التبادل');
  searchBox.className =
    'w-full rounded-xl border p-3 mb-3 text-base';

  const searchMessage = document.createElement('p');
  searchMessage.className = 'text-sm text-slate-500 mb-3';
  searchMessage.textContent = 'اكتب اسم الغرض أو المدينة للبحث.';

  adsContainer.insertBefore(searchMessage, adsContainer.firstChild);
  adsContainer.insertBefore(searchBox, searchMessage);

  searchBox.addEventListener('input', () => {
    const query = searchBox.value.trim().toLocaleLowerCase();
    const cards = Array.from(adsContainer.querySelectorAll('article'));
    let visibleCount = 0;

    cards.forEach(card => {
      const matches = card.textContent
        .toLocaleLowerCase()
        .includes(query);

      card.hidden = !matches;
      if (matches) visibleCount++;
    });

    searchMessage.textContent = query
      ? `عدد الإعلانات المطابقة: ${visibleCount}`
      : 'اكتب اسم الغرض أو المدينة للبحث.';
  });
})();
