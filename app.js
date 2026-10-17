/* 水滴喝水 · 纯前端练手版。数据只存在本机 localStorage。 */
(function () {
  'use strict';
  const KEY = 'shuidi.v1';
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const TYPES = [
    {id: 'water', name: '白开水', ic: '💧', k: 1},
    {id: 'tea', name: '茶', ic: '🍵', k: 0.9},
    {id: 'coffee', name: '咖啡', ic: '☕', k: 0.8},
    {id: 'milk', name: '牛奶', ic: '🥛', k: 0.9},
    {id: 'juice', name: '果汁', ic: '🧃', k: 0.9},
    {id: 'soda', name: '饮料', ic: '🥤', k: 0.8},
    {id: 'soup', name: '汤', ic: '🍲', k: 0.8}
  ];
  const TYPE = Object.fromEntries(TYPES.map(t => [t.id, t]));
  const CUPS = [100, 200, 300, 500];

  // ---------- 存储 ----------
  function defaults() {
    return {
      v: 1,
      settings: {
        gender: 'male', weight: 60, goal: 2100, goalCustom: false,
        goalHistory: [{from: dayKey(new Date()), goal: 2100}],
        cup: 200, customCup: 250, type: 'water',
        remind: {on: false, interval: 60, start: '08:00', end: '22:00', stopWhenDone: true, enabledAt: 0, lastAt: 0}
      },
      logs: []
    };
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const d = JSON.parse(raw), def = defaults();
      d.settings = Object.assign(def.settings, d.settings || {});
      d.settings.remind = Object.assign(def.settings.remind, d.settings.remind || {});
      d.logs = Array.isArray(d.logs) ? d.logs : [];
      return d;
    } catch (e) { return defaults(); }
  }
  let db = load();
  const save = () => localStorage.setItem(KEY, JSON.stringify(db));
  const S = () => db.settings;

  // ---------- 工具 ----------
  function pad(n) { return String(n).padStart(2, '0'); }
  function dayKey(d) { d = new Date(d); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function startOfDay(d) { d = new Date(d); d.setHours(0, 0, 0, 0); return d; }
  function addDays(d, n) { d = new Date(d); d.setDate(d.getDate() + n); return d; }
  function hm(t) { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function parseHM(s, base) { const [h, m] = s.split(':').map(Number); const d = startOfDay(base); d.setHours(h, m || 0); return d.getTime(); }
  const eff = l => Math.round(l.ml * ((TYPE[l.type] || TYPE.water).k));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

  function suggestedGoal() {
    const w = Number(S().weight) || 60;
    const per = S().gender === 'female' ? 31 : 35;
    return Math.min(4000, Math.max(1200, Math.round(w * per / 50) * 50));
  }
  function setGoal(g) {
    g = Math.round(Number(g));
    if (!(g >= 500 && g <= 6000)) return;
    S().goal = g;
    const today = dayKey(new Date()), h = S().goalHistory;
    if (h.length && h[h.length - 1].from === today) h[h.length - 1].goal = g; else h.push({from: today, goal: g});
    save();
  }
  function goalFor(key) {
    const h = S().goalHistory; let g = h.length ? h[0].goal : S().goal;
    for (const e of h) if (e.from <= key) g = e.goal;
    return g;
  }
  function logsOn(key) { return db.logs.filter(l => dayKey(l.t) === key).sort((a, b) => b.t - a.t); }
  function totalOn(key) { return logsOn(key).reduce((s, l) => s + eff(l), 0); }
  function dailyTotals() {
    const m = {};
    for (const l of db.logs) { const k = dayKey(l.t); m[k] = (m[k] || 0) + eff(l); }
    return m;
  }
  function streak() {
    const m = dailyTotals(); let d = new Date(), n = 0;
    if (!((m[dayKey(d)] || 0) >= goalFor(dayKey(d)))) d = addDays(d, -1);
    while ((m[dayKey(d)] || 0) >= goalFor(dayKey(d)) && n < 3650) { n++; d = addDays(d, -1); }
    return n;
  }

  // ---------- Toast（带撤销） ----------
  let toastTimer = null, undoFn = null;
  function toast(text, undo) {
    $('#toastText').textContent = text;
    undoFn = undo || null;
    $('#toastUndo').classList.toggle('hidden', !undo);
    $('#toast').classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('#toast').classList.add('hidden'); undoFn = null; }, 4000);
  }
  $('#toastUndo').addEventListener('click', () => {
    if (undoFn) undoFn();
    undoFn = null; $('#toast').classList.add('hidden');
  });

  // ---------- 记录 ----------
  function addLog(ml, type) {
    ml = Math.round(Number(ml));
    if (!(ml > 0 && ml <= 3000)) return;
    const before = totalOn(dayKey(new Date()));
    const log = {id: uid(), t: Date.now(), ml, type: type || S().type};
    db.logs.push(log); save();
    renderToday();
    const after = totalOn(dayKey(new Date())), g = goalFor(dayKey(new Date()));
    const msg = before < g && after >= g ? '🎉 今日目标达成！' : '已记录 ' + TYPE[log.type].name + ' ' + ml + ' ml';
    toast(msg, () => { db.logs = db.logs.filter(l => l.id !== log.id); save(); renderToday(); });
    $('#remindBanner').classList.add('hidden');
    if (navigator.vibrate) navigator.vibrate(15);
  }
  function delLog(id) {
    const l = db.logs.find(x => x.id === id); if (!l) return;
    db.logs = db.logs.filter(x => x.id !== id); save(); renderToday();
    toast('已删除一条记录', () => { db.logs.push(l); save(); renderToday(); });
  }

  // ---------- 今天页 ----------
  function renderTypes() {
    $('#types').innerHTML = TYPES.map(t =>
      `<button class="chip ${S().type === t.id ? 'on' : ''}" data-type="${t.id}">${t.ic} ${t.name}</button>`).join('');
  }
  function renderCups() {
    const sizes = [16, 19, 22, 26];
    let h = CUPS.map((c, i) =>
      `<button class="cup ${S().cup === c ? 'on' : ''}" data-cup="${c}"><span class="ic" style="font-size:${sizes[i]}px">🥛</span><b>${c}</b>ml</button>`).join('');
    const isCustom = !CUPS.includes(S().cup);
    h += `<button class="cup ${isCustom ? 'on' : ''}" data-cup="custom"><span class="ic">✏️</span><b>${isCustom ? S().cup : '自定义'}</b>${isCustom ? 'ml' : '&nbsp;'}</button>`;
    $('#cups').innerHTML = h;
    $('#drinkBtnSub').textContent = TYPE[S().type].name + ' ' + S().cup + ' ml';
  }
  function renderToday() {
    const now = new Date(), key = dayKey(now), g = goalFor(key), total = totalOn(key);
    const p = total / g;
    const hr = now.getHours();
    $('#hello').textContent = hr < 5 ? '夜深了 🌙' : hr < 11 ? '早上好 ☀️' : hr < 14 ? '中午好 🌤' : hr < 18 ? '下午好 🍃' : '晚上好 🌙';
    $('#todayDate').textContent = `${now.getMonth() + 1}月${now.getDate()}日 星期${WEEK[now.getDay()]}`;
    $('#pct').textContent = Math.round(p * 100) + '%';
    $('#drank').textContent = total;
    $('#goalText').textContent = g;
    $('#remain').textContent = total >= g ? '✅ 今日已达标，真棒！' : '还差 ' + (g - total) + ' ml';
    $('.glass-wrap').classList.toggle('done', total >= g);
    targetLevel = Math.min(1, p);
    $('#streak').textContent = '🔥 连续 ' + streak() + ' 天';
    const logs = logsOn(key);
    $('#logCount').textContent = logs.length ? `· ${logs.length} 杯` : '';
    $('#logList').innerHTML = logs.length ? logs.map(l => {
      const t = TYPE[l.type] || TYPE.water, e = eff(l);
      return `<li><span class="ic">${t.ic}</span><div class="info"><b>${l.ml} ml</b> ${t.name}<small>${hm(l.t)}${e !== l.ml ? ' · 计入 ' + e + ' ml' : ''}</small></div><button class="del" data-del="${l.id}" aria-label="删除">✕</button></li>`;
    }).join('') : '<li class="empty">今天还没喝水哦，点上面的按钮记一杯吧 💧</li>';
    renderTypes(); renderCups(); renderNext();
  }

  // 水波动画
  let level = 0, targetLevel = 0, phase = 0;
  function wavePath(y, amp, ph) {
    let d = `M 0 ${y}`;
    for (let x = 0; x <= 200; x += 5) d += ` L ${x} ${(y + Math.sin((x / 200) * Math.PI * 2 + ph) * amp).toFixed(2)}`;
    return d + ' L 200 200 L 0 200 Z';
  }
  function animate() {
    level += (targetLevel - level) * 0.08;
    phase += 0.05;
    const y = 190 - level * 184;
    const amp = level > 0.001 && level < 0.999 ? 5 : 0;
    $('#wave1').setAttribute('d', wavePath(y, amp, phase));
    $('#wave2').setAttribute('d', wavePath(y - 2, amp, phase + 2));
    requestAnimationFrame(animate);
  }

  $('#types').addEventListener('click', e => {
    const b = e.target.closest('[data-type]'); if (!b) return;
    S().type = b.dataset.type; save(); renderTypes(); renderCups();
  });
  $('#cups').addEventListener('click', e => {
    const b = e.target.closest('[data-cup]'); if (!b) return;
    if (b.dataset.cup === 'custom') { openCustom(); return; }
    S().cup = Number(b.dataset.cup); save(); renderCups();
  });
  $('#drinkBtn').addEventListener('click', () => addLog(S().cup, S().type));
  $('#logList').addEventListener('click', e => {
    const b = e.target.closest('[data-del]'); if (b) delLog(b.dataset.del);
  });
  function openCustom() {
    $('#customAmt').value = S().customCup || '';
    $('#customModal').classList.remove('hidden');
    setTimeout(() => $('#customAmt').focus(), 50);
  }
  $('#customCancel').addEventListener('click', () => $('#customModal').classList.add('hidden'));
  $('#customOk').addEventListener('click', () => {
    const v = Math.round(Number($('#customAmt').value));
    if (!(v >= 10 && v <= 3000)) { $('#customAmt').focus(); return; }
    S().customCup = v; S().cup = v; save();
    $('#customModal').classList.add('hidden');
    $('#customCup').value = v;
    addLog(v, S().type);
  });

  // ---------- 统计页 ----------
  let statMode = 'day', statOffset = 0;
  function rangeFor() {
    const today = startOfDay(new Date());
    if (statMode === 'day') {
      const d = addDays(today, statOffset);
      return {days: [d], label: statOffset === 0 ? '今天' : statOffset === -1 ? '昨天' : `${d.getMonth() + 1}月${d.getDate()}日`};
    }
    if (statMode === 'week') {
      const dow = (today.getDay() + 6) % 7; // 周一为第一天
      const mon = addDays(today, -dow + statOffset * 7);
      const days = Array.from({length: 7}, (_, i) => addDays(mon, i));
      const e = days[6];
      return {days, label: statOffset === 0 ? '本周' : `${mon.getMonth() + 1}/${mon.getDate()} - ${e.getMonth() + 1}/${e.getDate()}`};
    }
    const first = new Date(today.getFullYear(), today.getMonth() + statOffset, 1);
    const n = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    return {days: Array.from({length: n}, (_, i) => addDays(first, i)), label: `${first.getFullYear()}年${first.getMonth() + 1}月`};
  }
  function drawChart(values, labels, goal, hitFlags) {
    const W = 340, H = 220, L = 34, R = 6, T = 14, B = 22;
    const max = Math.max(goal ? goal * 1.15 : 0, ...values.map(v => v * 1.1), statMode === 'day' ? 400 : 500);
    const step = max > 3000 ? 1000 : max > 1200 ? 500 : max > 600 ? 200 : 100;
    const top = Math.ceil(max / step) * step;
    const y = v => T + (H - T - B) * (1 - v / top);
    let s = '';
    for (let v = 0; v <= top; v += step) {
      s += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>`;
      s += `<text x="${L - 4}" y="${y(v) + 3}" text-anchor="end">${v >= 1000 ? (v / 1000) + 'L' : v}</text>`;
    }
    const n = values.length, cw = (W - L - R) / n, bw = Math.max(3, Math.min(22, cw * 0.62));
    values.forEach((v, i) => {
      const x = L + cw * i + (cw - bw) / 2, h = y(0) - y(v);
      if (v > 0) s += `<rect class="bar ${hitFlags && hitFlags[i] ? 'hit' : ''}" x="${x.toFixed(1)}" y="${y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, h).toFixed(1)}" rx="${Math.min(4, bw / 2)}"><title>${labels[i]} ${v}ml</title></rect>`;
      const showLbl = n <= 7 || (n === 24 ? i % 3 === 0 : (i === 0 || (i + 1) % 5 === 0));
      if (showLbl) s += `<text x="${(L + cw * i + cw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${labels[i]}</text>`;
    });
    if (goal) s += `<line class="goal" x1="${L}" x2="${W - R}" y1="${y(goal)}" y2="${y(goal)}"/><text class="goal-label" x="${W - R}" y="${y(goal) - 4}" text-anchor="end">目标 ${goal}</text>`;
    $('#chart').innerHTML = s;
  }
  function renderStats() {
    const {days, label} = rangeFor();
    $('#rangeLabel').textContent = label;
    $('#nextRange').disabled = statOffset >= 0;
    $$('#statSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === statMode));
    const keys = days.map(dayKey);
    const keySet = new Set(keys);
    const logs = db.logs.filter(l => keySet.has(dayKey(l.t)));
    if (statMode === 'day') {
      const hours = Array(24).fill(0);
      logs.forEach(l => { hours[new Date(l.t).getHours()] += eff(l); });
      drawChart(hours, hours.map((_, i) => i + '时'), 0);
      const tot = hours.reduce((a, b) => a + b, 0), g = goalFor(keys[0]);
      $('#summary').innerHTML = `<div><b>${tot}</b><small>总计 ml</small></div><div><b>${logs.length}</b><small>杯数</small></div><div><b>${Math.round(tot / g * 100)}%</b><small>完成度</small></div>`;
    } else {
      const totals = keys.map(k => logs.filter(l => dayKey(l.t) === k).reduce((s, l) => s + eff(l), 0));
      const goals = keys.map(goalFor);
      const labels = days.map(d => statMode === 'week' ? '周' + WEEK[d.getDay()] : String(d.getDate()));
      drawChart(totals, labels, S().goal, totals.map((v, i) => v >= goals[i]));
      const todayKey = dayKey(new Date());
      const passed = keys.filter(k => k <= todayKey).length || 1;
      const sum = totals.reduce((a, b) => a + b, 0);
      const hit = totals.filter((v, i) => v >= goals[i]).length;
      $('#summary').innerHTML = `<div><b>${Math.round(sum / passed)}</b><small>日均 ml</small></div><div><b>${hit}</b><small>达标天数</small></div><div><b>${(sum / 1000).toFixed(1)}L</b><small>总量</small></div>`;
    }
    const byType = {};
    logs.forEach(l => { byType[l.type] = (byType[l.type] || 0) + eff(l); });
    const total = Object.values(byType).reduce((a, b) => a + b, 0);
    const rows = TYPES.filter(t => byType[t.id]).sort((a, b) => byType[b.id] - byType[a.id]);
    $('#typeBreakdown').innerHTML = rows.length ? rows.map(t =>
      `<div class="tb-row"><span class="name">${t.ic} ${t.name}</span><span class="barw"><i style="width:${(byType[t.id] / total * 100).toFixed(1)}%"></i></span><span class="val">${byType[t.id]} ml</span></div>`).join('')
      : '<div class="empty">这段时间还没有记录</div>';
  }
  $('#statSeg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    statMode = b.dataset.v; statOffset = 0; renderStats();
  });
  $('#prevRange').addEventListener('click', () => { statOffset--; renderStats(); });
  $('#nextRange').addEventListener('click', () => { if (statOffset < 0) { statOffset++; renderStats(); } });

  // ---------- 提醒 ----------
  function nextReminder(now) {
    const r = S().remind;
    if (!r.on) return null;
    now = now || Date.now();
    const todayKey = dayKey(now);
    if (r.stopWhenDone && totalOn(todayKey) >= goalFor(todayKey)) {
      return {t: parseHM(r.start, addDays(now, 1)), done: true};
    }
    const lastDrink = db.logs.reduce((m, l) => Math.max(m, l.t), 0);
    const base = Math.max(lastDrink, r.lastAt || 0, r.enabledAt || 0);
    let t = base + r.interval * 60000;
    const s = parseHM(r.start, now), e = parseHM(r.end, now);
    if (t < s) t = s;
    if (t > e) t = parseHM(r.start, addDays(now, 1));
    if (now < s && t > s && dayKey(t) === todayKey) t = Math.max(t, s);
    return {t, done: false};
  }
  function renderNext() {
    const n = nextReminder();
    const el = $('#nextRemind');
    if (!n) { el.textContent = '⏰ 提醒未开启（可在「设置」里打开）'; return; }
    const diff = n.t - Date.now();
    const isTomorrow = dayKey(n.t) !== dayKey(new Date());
    if (n.done) { el.textContent = `✅ 今日已达标，明天 ${S().remind.start} 再提醒`; return; }
    if (isTomorrow) { el.textContent = `🌙 今天的提醒时段已结束，明天 ${hm(n.t)} 再提醒`; return; }
    if (diff <= 0) { el.textContent = '⏰ 该喝水啦！'; return; }
    const m = Math.floor(diff / 60000), s = Math.floor(diff / 1000) % 60;
    el.textContent = `⏰ 下次提醒 ${hm(n.t)}（还有 ${m >= 60 ? Math.floor(m / 60) + ' 小时 ' + (m % 60) + ' 分' : m + ' 分 ' + pad(s) + ' 秒'}）`;
  }
  async function notify(title, body) {
    $('#remindBanner').classList.remove('hidden');
    if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    const opts = {body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'drink', renotify: true};
    try {
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      if (reg) { await reg.showNotification(title, opts); return true; }
      new Notification(title, opts); return true;
    } catch (e) { return false; }
  }
  function tick() {
    const n = nextReminder();
    if (n && !n.done && Date.now() >= n.t && dayKey(n.t) === dayKey(new Date())) {
      S().remind.lastAt = Date.now(); save();
      const left = goalFor(dayKey(new Date())) - totalOn(dayKey(new Date()));
      notify('该喝水啦 💧', left > 0 ? `今天还差 ${left} ml，来一杯吧～` : '保持好习惯，来一杯吧～');
    }
    renderNext();
  }
  function notifyStatus() {
    const el = $('#notifyStatus');
    if (!('Notification' in window)) {
      el.textContent = '当前浏览器不支持系统通知（iPhone 上请先添加到主屏幕，并从主屏幕图标打开）。仍会在页面内提醒。';
    } else {
      el.textContent = {granted: '✅ 已允许系统通知', denied: '❌ 系统通知已被拒绝，可在 iPhone「设置 → 通知 → 水滴」里重新打开', default: '尚未授权系统通知'}[Notification.permission] || '';
    }
  }

  // ---------- 设置页 ----------
  function renderSettings() {
    const s = S();
    $$('#genderSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === s.gender));
    $('#weight').value = s.weight;
    $('#suggested').textContent = suggestedGoal();
    $('#goalInput').value = s.goal;
    $('#remindOn').checked = s.remind.on;
    $('#interval').value = String(s.remind.interval);
    $('#startTime').value = s.remind.start;
    $('#endTime').value = s.remind.end;
    $('#stopWhenDone').checked = s.remind.stopWhenDone;
    $('#customCup').value = s.customCup;
    notifyStatus();
  }
  function autoGoal() { if (!S().goalCustom) setGoal(suggestedGoal()); renderSettings(); renderToday(); }
  $('#genderSeg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    S().gender = b.dataset.v; save(); autoGoal();
  });
  $('#weight').addEventListener('change', e => {
    const w = Number(e.target.value);
    if (w >= 20 && w <= 200) { S().weight = w; save(); }
    autoGoal();
  });
  $('#goalInput').addEventListener('change', e => {
    const g = Number(e.target.value);
    if (g >= 500 && g <= 6000) { S().goalCustom = true; setGoal(g); }
    renderSettings(); renderToday();
  });
  $('#useSuggested').addEventListener('click', () => { S().goalCustom = false; setGoal(suggestedGoal()); renderSettings(); renderToday(); toast('已使用建议目标 ' + S().goal + ' ml'); });
  $('#remindOn').addEventListener('change', async e => {
    S().remind.on = e.target.checked;
    if (e.target.checked) {
      S().remind.enabledAt = Date.now();
      if ('Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (_) {} }
    }
    save(); renderSettings(); renderNext();
  });
  $('#interval').addEventListener('change', e => { S().remind.interval = Number(e.target.value); save(); renderNext(); });
  $('#startTime').addEventListener('change', e => { if (e.target.value) S().remind.start = e.target.value; save(); renderNext(); });
  $('#endTime').addEventListener('change', e => { if (e.target.value) S().remind.end = e.target.value; save(); renderNext(); });
  $('#stopWhenDone').addEventListener('change', e => { S().remind.stopWhenDone = e.target.checked; save(); renderNext(); });
  $('#customCup').addEventListener('change', e => {
    const v = Math.round(Number(e.target.value));
    if (v >= 10 && v <= 3000) { if (S().cup === S().customCup) S().cup = v; S().customCup = v; save(); renderCups(); }
  });
  $('#askNotify').addEventListener('click', async () => {
    if (!('Notification' in window)) { notifyStatus(); toast('此浏览器不支持系统通知'); return; }
    try { await Notification.requestPermission(); } catch (_) {}
    notifyStatus();
  });
  $('#testNotify').addEventListener('click', async () => {
    const ok = await notify('该喝水啦 💧', '这是一条测试提醒');
    toast(ok ? '已发送测试通知' : '已在页面内提醒（系统通知未授权或不支持）');
  });

  // 导出 / 导入
  async function download(name, text, mime) {
    const blob = new Blob([text], {type: mime});
    try {
      const file = new File([blob], name, {type: mime});
      if (navigator.canShare && navigator.canShare({files: [file]}) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
        await navigator.share({files: [file], title: name}); return;
      }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  const stamp = () => dayKey(new Date()).replace(/-/g, '');
  $('#exportCsv').addEventListener('click', () => {
    const rows = [['日期', '时间', '饮品', '饮用量(ml)', '计入量(ml)']];
    db.logs.slice().sort((a, b) => a.t - b.t).forEach(l => rows.push([dayKey(l.t), hm(l.t), (TYPE[l.type] || TYPE.water).name, l.ml, eff(l)]));
    download(`水滴喝水记录_${stamp()}.csv`, '\ufeff' + rows.map(r => r.join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  });
  $('#exportJson').addEventListener('click', () => {
    download(`水滴喝水备份_${stamp()}.json`, JSON.stringify(db, null, 2), 'application/json');
  });
  $('#importJson').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!Array.isArray(d.logs)) throw new Error('bad');
      const ids = new Set(db.logs.map(l => l.id));
      let added = 0;
      d.logs.forEach(l => { if (l && l.id && l.t && l.ml && !ids.has(l.id)) { db.logs.push({id: l.id, t: l.t, ml: l.ml, type: TYPE[l.type] ? l.type : 'water'}); added++; } });
      if (d.settings) { db.settings = Object.assign(db.settings, d.settings); }
      save(); renderAll(); toast(`导入成功，新增 ${added} 条记录`);
    } catch (err) { toast('导入失败：文件格式不对'); }
    e.target.value = '';
  });
  $('#clearAll').addEventListener('click', () => {
    if (!confirm('确定清空所有喝水记录吗？此操作不能恢复（建议先导出备份）。')) return;
    const old = db.logs; db.logs = []; save(); renderAll();
    toast('已清空全部记录', () => { db.logs = old; save(); renderAll(); });
  });

  // ---------- 导航 ----------
  function show(page) {
    $$('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
    $$('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.page === page));
    if (page === 'stats') renderStats();
    if (page === 'settings') renderSettings();
    if (page === 'today') renderToday();
    window.scrollTo(0, 0);
  }
  $$('.tabbar button').forEach(b => b.addEventListener('click', () => show(b.dataset.page)));
  $('#bannerClose').addEventListener('click', () => $('#remindBanner').classList.add('hidden'));

  function renderAll() { renderToday(); renderSettings(); if ($('#page-stats').classList.contains('active')) renderStats(); }

  // 跨天自动刷新
  let lastDay = dayKey(new Date());
  setInterval(() => {
    if (dayKey(new Date()) !== lastDay) { lastDay = dayKey(new Date()); renderAll(); }
    tick();
  }, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderAll(); tick(); } });

  // 启动
  if (!localStorage.getItem(KEY)) { setGoal(suggestedGoal()); save(); }
  renderAll();
  level = targetLevel;
  requestAnimationFrame(animate);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  // 测试/调试用
  window.__shuidi = {get db() { return db; }, addLog, reload: () => { db = load(); renderAll(); }};
})();
