/* =========================================================
   ③ 主控：模式切換、對話、面板、結算
   ========================================================= */
const $ = s => document.querySelector(s);
let toastT = null;
function toast(msg, ms){ const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms || 2200); }
function updateBar(){ if (S) $('#barFill').style.width = S.bar + '%'; }
function refreshSkills(){ if (!STAGE) return; document.querySelectorAll('.sk').forEach(b => { const k = b.dataset.k, d = skillDef(k); if (!d) return; b.classList.toggle('locked', !Game.skills.has(k)); b.querySelector('.cd').style.height = (S && S.cd[k] ? S.cd[k] / d.cd * 100 : 0) + '%'; }); }
// 技能按鈕依這一章的 STAGE.skills 產生
function buildSkills(){
  const box = $('#skills');
  box.innerHTML = STAGE.skills.map((d, i) => `<button class="sk" data-k="${d.k}" style="border-color:${d.color}${d.name.length >= 5 ? ';font-size:13px' : ''}" aria-label="技能 ${i+1}：${d.name}"><i>${d.icon}</i>${d.name}<span class="cd"></span></button>`).join('');
  box.querySelectorAll('.sk').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); useSkill(b.dataset.k); }));
  refreshSkills();
}
const esc = s => String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; } return a; };

const Game = {
  mode:'title', layout:'normal', paused:false, skills:new Set(), book:false, forceVariant:null, methods:{}, stageStats:null, _dlg:null,

  /* ----- 對話 ----- */
  say(lines, done){
    const T = Town.T; if (T) T.busy = true;
    this._dlg = {lines:lines.slice(), done};
    $('#dlg').hidden = false; this._next();
  },
  _next(){
    const d = this._dlg; if (!d) return;
    if (!d.lines.length){
      $('#dlg').hidden = true; this._dlg = null;
      const T = Town.T; if (T && !$('#panel').classList.contains('on')) T.busy = false;
      if (d.done) d.done(); return;
    }
    const [who, text] = d.lines.shift();
    const n = $('#dname'), t = $('#dtext');
    n.className = who === 'in' ? 'inner' : ''; t.className = who === 'sys' ? 'sys' : '';
    n.textContent = who === 'sys' ? '' : who === 'in' ? '我的內心' : NAMES[who] || who;
    t.textContent = text;
  },

  /* ----- 面板 ----- */
  panel(title, html, btns){
    Town.T.busy = true;
    $('#pTitle').textContent = title; $('#pBody').innerHTML = html;
    const box = $('#pBtns'); box.innerHTML = '';
    btns.forEach(b => { const el = document.createElement('button'); el.className = 'pb ' + (b.cls || ''); el.innerHTML = b.t; if (b.id) el.id = b.id;
      if (b.dis) el.disabled = true; el.addEventListener('click', () => b.fn(el)); box.appendChild(el); });
    $('#panel').classList.add('on');
  },
  closePanel(){ $('#panel').classList.remove('on'); if (!this._dlg) Town.T.busy = false; },

  /* ----- 進度提示 ----- */
  objective(){
    const T = Town.T, o = $('#obj');
    const done = T.results.length;
    const txt = {intro:'聽米亞說明', shelf:'點書架，拿《情緒圖鑑》', mia:'跟米亞說話', board: done ? `已完成 ${done}/3 件。回走廊公布欄選下一步` : '到走廊看公布欄', return:CH.returnObj, stage:''}[T.step];
    if (T.step === 'case'){ const c = CASES[T.ci]; o.innerHTML = `委託 ${T.ci+1}/3：到${c.place}找${NAMES[c.npc]}<small>點他和周圍的東西找線索，找到 2 種就能判斷情緒</small>`; }
    else o.textContent = txt || '';
  },
  camBias(){ return this._dlg && this.layout !== 'tall' ? VH * .22 : 0; },
  goalTile(){
    const T = Town.T;
    if (T.step === 'shelf') return [2,1]; if (T.step === 'mia') return [7,2]; if (T.step === 'board') return [11,8];
    if (T.step === 'return') return [5,7];
    if (T.step === 'case'){ const p = CASES[T.ci].pos[T.cs.v]; return [p.x, p.y]; }
    return null;
  },
  updateLook(){
    const btn = $('#lookBtn'), T = Town.T;
    const e = this.mode === 'town' && T && !T.busy && !T.path.length ? Town.nearby() : null;
    const label = e ? (e.npc ? NAMES[e.npc] : e.name || '這裡') : '走到人或東西旁邊';
    if (btn.disabled !== !e) btn.disabled = !e;
    const n = $('#lookName'); if (n.textContent !== label) n.textContent = label;
  },
  clueCount(){ const T = Town.T; const n = T && T.cs ? Object.keys(T.cs.found).length : 0; $('#clueN').textContent = `${n}/4`; },
  bookOn(){ this.book = true; },
  learn(k){ this.skills.add(k); refreshSkills(); },

  /* ----- 公布欄、案件 ----- */
  boardPanel(go){
    const T = Town.T, done = new Set(T.results.map(r => r.idx)), n = done.size;
    const html = CASES.map((x, i) => `<p><span class="tag">委託 ${i+1}</span>${done.has(i) ? '✅ ' : ''}${esc(x.board)}</p>`).join('') +
      `<p class="hint">${n ? `已完成 ${n}/3 件。想繼續、去闖關，或今天先收工都可以。` : '想先做哪件都可以。完成一件以後，就能隨時結束今天的調查。'}</p>`;
    const btns = CASES.map((x, i) => done.has(i) ? null : {t:`接下委託 ${i+1}：${x.title}`, cls:'pri', fn:() => { this.closePanel(); go(i); }}).filter(Boolean);
    if (n && this.skills.size >= 2 && !this.stageStats) btns.push({t:CH.stageBtn, fn:() => { this.closePanel(); T.step = 'return'; this.objective(); toast(CH.returnToast, 1600); }});
    if (n) btns.push({t:'📋 結束今天的調查', fn:() => { this.closePanel(); this.settle(); }});
    btns.push({t:'先不要', fn:() => this.closePanel()});
    this.panel('公布欄・今日委託', html, btns);
  },
  casePanel(){
    const T = Town.T, c = CASES[T.ci], cs = T.cs, v = cs.v, who = NAMES[c.npc];
    const n = Object.keys(cs.found).length;
    const list = cs.clues.length ? cs.clues.map(k => `<p><span class="tag ${k.type}">${TYPE_NAME[k.type]}</span>${esc(k.text)}</p>`).join('') : '<p class="hint">還沒有線索。可以看看他，也可以調查周圍。</p>';
    const back = () => this.casePanel();
    if (cs.fit){ this.say([['sys', '這個委託已經結案了。']]); return; }
    if (cs.named){
      this.panel(`陪${who}想辦法`, `<p>${esc(who)}現在的情緒是「${esc(cs.word)}」。你會怎麼做？</p>`,
        cs.order.map(o => ({t:esc(o.t), cls:'wide', fn:() => this.choose(o)})));
      return;
    }
    const look = (type, txt, line) => () => { this.closePanel(); const fresh = Town.addClue(type, txt);
      this.say([line || ['sys', txt], ['sys', fresh ? `找到「${TYPE_NAME[type]}」線索。` : '這個線索已經記下來了。']], back); };
    const talk = c.npcClues.talk[v];
    this.panel(who, `<p class="hint">已找到 ${n}/4 種線索</p>` + list, [
      {t:'看他的表情', cls:cs.found.face ? 'got' : '', fn:look('face', c.npcClues.face[v])},
      {t:'看他的動作', cls:cs.found.body ? 'got' : '', fn:look('body', c.npcClues.body[v])},
      {t:'跟他說話', cls:cs.found.talk && talk ? 'got' : '', fn: talk ? look('talk', talk, [c.npc, talk]) : () => { this.closePanel(); this.say([['sys', c.noTalk]], back); }},
      {t:'說出他的情緒', cls:'pri', dis:n < 2, fn:() => this.namePanel()},
      {t:'先離開', fn:() => this.closePanel()},
    ]);
  },
  namePanel(){
    const T = Town.T, c = CASES[T.ci], cs = T.cs, n = Object.keys(cs.found).length, fine = n >= 3;
    let word = null, lv = null;
    const words = BASE_WORDS.concat(fine ? FINE_WORDS : []);
    const html = `<p>${esc(NAMES[c.npc])}現在是什麼情緒？有多強烈？</p>
      <div class="words">${words.map(w => `<button class="pb" data-w="${w}">${w}</button>`).join('')}</div>
      ${fine ? '' : '<p class="hint">再多找一種線索，可以選的詞會更多、更準。</p>'}
      <p style="margin-top:12px">強度：1 是一點點，5 是非常強烈</p>
      <div class="lv">${[1,2,3,4,5].map(i => `<button class="pb" data-l="${i}">${i}</button>`).join('')}</div>`;
    this.panel('說出他的情緒', html, [
      {t:'確定', cls:'pri', id:'nameOk', dis:true, fn:() => { this.closePanel(); this.judge(word, lv); }},
      {t:'回去找線索', fn:() => { this.closePanel(); this.casePanel(); }},
    ]);
    const ok = () => { $('#nameOk').disabled = !(word && lv); };
    document.querySelectorAll('#pBody [data-w]').forEach(b => b.addEventListener('click', () => { word = b.dataset.w; document.querySelectorAll('#pBody [data-w]').forEach(x => x.classList.toggle('sel', x === b)); ok(); }));
    document.querySelectorAll('#pBody [data-l]').forEach(b => b.addEventListener('click', () => { lv = +b.dataset.l; document.querySelectorAll('#pBody [data-l]').forEach(x => x.classList.toggle('sel', x === b)); ok(); }));
  },
  judge(word, lv){
    const T = Town.T, c = CASES[T.ci], cs = T.cs, v = cs.v, who = c.npc;
    cs.tries++;
    if (c.best[v].includes(word)){ cs.word = word; cs.lv = lv; this.evidencePanel(); return; }
    if (c.ok[v].includes(word)){ // 方向對但不夠細，不能結案
      const own = c.okLine && c.okLine[v];
      this.say([[who, own || `是有點${word}……可是不只是這樣。`], ['sys', `「${word}」底下還藏著別的感覺。再多找線索，換一個更準的詞。`]], () => this.casePanel());
      return;
    }
    const w = c.wrong[word], line = w && typeof w === 'object' ? w[v] : w;
    this.say([line ? [who, line] : ['sys', `${NAMES[who]}皺了皺眉：「好像不是這樣……」`], ['sys', '再回去多看看線索吧。']], () => this.casePanel());
  },
  evidencePanel(){
    const T = Town.T, c = CASES[T.ci], cs = T.cs, v = cs.v, word = cs.word;
    const has = cs.clues.some(k => c.evidence[v].includes(k.key));
    const list = cs.clues.map((k, i) => `<button class="pb wide" data-e="${i}"><span class="tag ${k.type}">${TYPE_NAME[k.type]}</span>${esc(k.text)}</button>`).join('');
    this.panel(`為什麼是「${word}」？`, `<p>從線索本挑一條最能說明「${esc(word)}」的線索。</p><div class="row">${list}</div>` +
      (has ? '' : '<p class="hint">你的線索本裡好像還沒有能證明這個情緒的線索，再去找找看。</p>'),
      [{t:'回去找線索', fn:() => { this.closePanel(); this.casePanel(); }}]);
    document.querySelectorAll('#pBody [data-e]').forEach(b => b.addEventListener('click', () => { this.closePanel(); this.checkEvidence(cs.clues[+b.dataset.e]); }));
  },
  checkEvidence(k){
    const T = Town.T, c = CASES[T.ci], cs = T.cs, v = cs.v, who = c.npc, word = cs.word;
    cs.evTries++;
    if (!c.evidence[v].includes(k.key)){
      this.say([[who, '這跟那個沒什麼關係吧……'], ['sys', `這條線索說明不了「${word}」。再挑一條，或回去多找線索。`]], () => this.evidencePanel());
      return;
    }
    cs.named = 'best'; cs.typesAtName = Object.keys(cs.found).length; cs.order = shuffle(c.options);
    const target = c.level[v], lines = [['sys', `證據：${k.text}`], [who, c.right[v]]];
    lines.push(['sys', Math.abs(cs.lv - target) <= 1 ? `強度也判斷得很準，是 ${target}。` : `強度差了一點，他看起來大概是 ${target}。`]);
    lines.push(['sys', '他聽到你說出來，看起來放鬆了一點。']);
    this.say(lines, () => this.casePanel());
  },
  choose(o){
    this.closePanel();
    const T = Town.T, c = CASES[T.ci], cs = T.cs, v = cs.v, res = o[v], card = c.best[v][0];
    cs.fit = res.fit; cs.choice = o.m;
    if (res.fit === 'great'){ (this.methods[card] = this.methods[card] || []).push(o.m); }
    const lines = [['sys', res.r], ['sys', `〔${FIT[res.fit]}〕${o.m}`]].concat(c.close);
    this.learn(c.skill);
    lines.push(['sys', `🎁 學會技能「${c.skillName}」，闖關時用得到。`]);
    if (cs.named === 'best'){ Town.T.cards.add(card); lines.push(['sys', `情緒圖鑑新增一張：「${card}」`]); }
    else lines.push(['sys', `這次的情緒還有更細的名字，圖鑑先空著。`]);
    this.say(lines, () => { Town.finishCase(); this.clueCount(); });
  },

  /* ----- 闖關 ----- */
  bump(){
    const T = Town.T; T.step = 'stage';
    this.say(TUTORIAL.bump, () => this.startStage());
  },
  startStage(){
    this.mode = 'stage'; $('#ctlTown').hidden = true; $('#ctlStage').hidden = false; $('#hud').hidden = false; $('#obj').hidden = true;
    reset(); S.running = true;
    // 沒學會的技能，對應的關卡直接打開，避免卡關
    if (LEVEL.dark && !this.skills.has(LEVEL.dark.by)){ S.lit = true; S.litR = 1; }
    S.walls.forEach(w => { if (!this.skills.has(STAGE.wallTypes[w.type].openBy)){ w.state = 'open'; w.k = 1; setWall(w, false); openDone(w); } });
    refreshSkills();
    toast(CH.stageToast, 2600);
  },
  stageWon(stats){
    this.stageStats = stats; const T = Town.T;
    // 每章自己決定通關拿哪張卡、記下哪些方法；methodsOnly 為 true 時只補方法，不送卡
    CH.win(stats.used, (card, ms, methodsOnly) => {
      if (!methodsOnly) T.cards.add(card);
      this.methods[card] = (this.methods[card] || []).concat(ms.filter(Boolean));
    });
    this.settle();
  },

  /* ----- 結算 ----- */
  cardsHtml(){
    const T = Town.T;
    // 這章的卡依序排；別章的卡（例如害怕章拿到的丟臉）接在後面，標出是哪一章的
    const extra = T ? [...T.cards].filter(w => !CARD_ORDER.includes(w)) : [];
    return '<div class="cards">' + CARD_ORDER.concat(extra).map(w => {
      if (!T || !T.cards.has(w)) return '<div class="ecard none">？</div>';
      const c = CARDS[w], ms = [...new Set(this.methods[w] || [])], from = c.ch !== CH.n ? `<span class="from">第${'一二三四五'[c.ch-1]}章的卡</span>` : '';
      return `<div class="ecard"><h3>${w}${from}</h3><dl><dt>身體會怎樣</dt><dd>${c.body}</dd><dt>常常因為</dt><dd>${c.cause}</dd><dt>試過有用的方法</dt><dd>${ms.length ? ms.join('、') : '還沒試出來'}</dd></dl></div>`;
    }).join('') + '</div>';
  },
  settle(){
    this.mode = 'settle'; $('#hud').hidden = true; $('#obj').hidden = true; $('#ctlStage').hidden = true; $('#ctlTown').hidden = true;
    ['#panel'].forEach(id => $(id).classList.remove('on')); $('#dlg').hidden = true; this._dlg = null;
    const T = Town.T, r = T.results, n = Math.max(1, r.length);
    const avg = r.reduce((a, x) => a + x.typesAtName, 0) / n;
    const clueLine = avg >= 3.5 ? VERDICT.clue4 : avg >= 2.5 ? VERDICT.clue3 : VERDICT.clue2;
    const first = r.filter(x => x.tries === 1 && x.evTries === 1).length;
    const nameLine = first === r.length ? VERDICT.nameBest(CH.base) : VERDICT.nameOk(CH.base);
    const great = r.filter(x => x.fit === 'great').length, fitLine = great >= Math.ceil(r.length * .6) ? VERDICT.fitHigh : VERDICT.fitLow;
    const rows = `<p>完成 <b>${r.length}/3</b> 個委託；第一次就說對情緒和證據：<b>${first}/${r.length}</b> 個</p>` + CASES.map((c, i) => {
      const x = r.find(y => y.idx === i);
      if (!x) return `<p><span class="tag">委託 ${i+1}</span>${NAMES[c.npc]}：這次沒處理</p>`;
      return `<p><span class="tag">委託 ${i+1}</span>${NAMES[c.npc]}：線索 ${x.typesAtName} 種，說了 ${x.tries} 次、挑證據 ${x.evTries} 次，陪伴方法「${x.choice}」<span class="fit ${x.fit}">${FIT[x.fit]}</span></p>`; }).join('');
    const line = x => typeof x === 'string' ? `<p>${esc(x)}</p>` : `<p><span class="who">${NAMES[x[0]]}：</span>${esc(x[1])}</p>`;
    const story = this.stageStats ? CH.winStory.map(line).join('') :
      `<p>今天的調查先到這裡。你把找到的線索整理進偵探筆記。</p><p><span class="who">米亞：</span>沒做完的委託不會跑掉，下次再來。</p>`;
    $('#settleCard').innerHTML = `<h2>結案報告・${CH.event}</h2>${story}
      <h2 style="margin-top:16px">情緒圖鑑</h2>${this.cardsHtml()}
      <h2 style="margin-top:16px">偵探評語</h2>
      <p>${clueLine}</p><p>${nameLine}</p><p>${fitLine}</p>
      ${rows}
      <p><span class="who">米亞：</span>${VERDICT.last}</p>
      <p class="cite">${CITE}</p>
      <div class="row"><button class="pb pri" id="againBtn">選擇章節</button></div>`;
    $('#settle').classList.add('on');
    $('#againBtn').addEventListener('click', () => { $('#settle').classList.remove('on'); this.chapterSelect(); });
  },
  chapterSelect(){
    ['#settle','#paused','#panel'].forEach(id => $(id).classList.remove('on')); $('#dlg').hidden = true; this._dlg = null;
    this.mode = 'title'; this.paused = false; $('#titleScr').classList.remove('on');
    // 章節卡只寫事件，不寫情緒名稱：情緒要玩家自己找出來
    $('#chList').innerHTML = CHAPTERS.map(c => { const ready = !!CH_DATA[c.n];
      return `<button class="chc${ready ? '' : ' soon'}" id="ch${c.n}" ${ready ? '' : 'disabled'}>
      <span class="che">${c.icon}</span><b>第${'一二三四五'[c.n-1]}章</b><span class="chn">${c.event}</span><small>${c.teaser}</small><i>${ready ? '可以玩' : '製作中'}</i></button>`; }).join('');
    CHAPTERS.filter(c => CH_DATA[c.n]).forEach(c => $('#ch' + c.n).addEventListener('click', () => { $('#chapters').classList.remove('on'); this.begin(c.n); }));
    $('#chapters').classList.add('on');
  },
  toTitle(){
    ['#settle','#paused','#panel','#chapters'].forEach(id => $(id).classList.remove('on')); $('#dlg').hidden = true; this._dlg = null;
    this.mode = 'title'; this.paused = false; $('#titleScr').classList.add('on');
  },
  begin(n){
    loadChapter(n || 3); buildSkills();
    this.skills = new Set(); this.methods = {}; this.stageStats = null; this.book = false;
    $('#titleScr').classList.remove('on'); $('#obj').hidden = false; $('#ctlTown').hidden = false; $('#ctlStage').hidden = true; $('#hud').hidden = true;
    S = null; Town.reset(); this.mode = 'town'; this.objective(); this.clueCount(); refreshSkills();
    this.say(TUTORIAL.opening, () => { Town.T.step = 'shelf'; this.objective(); });
  },

  /* ----- 圖鑑、線索本 ----- */
  showBook(){
    if (!this.book){ toast('還沒有拿到情緒圖鑑。社辦的書架上有。'); return; }
    this.panel('情緒圖鑑', this.cardsHtml(), [{t:'關閉', cls:'pri', fn:() => this.closePanel()}]);
  },
  showNotes(){
    const T = Town.T;
    if (!T.cs){ toast('接下委託後，找到的線索會記在這裡。'); return; }
    const html = T.cs.clues.length ? T.cs.clues.map(k => `<p><span class="tag ${k.type}">${TYPE_NAME[k.type]}</span>${esc(k.text)}</p>`).join('') : '<p class="hint">還沒有線索。</p>';
    this.panel(`線索本：${CASES[T.ci].title}`, html, [{t:'關閉', cls:'pri', fn:() => this.closePanel()}]);
  },
};

/* =========================================================
   入口：觸控、鍵盤、縮放
   ========================================================= */
const cvEl = document.getElementById('cv');
function layoutFor(w, h){ return w < h ? 'tall' : (w / h > 1.9 && h < 640) ? 'wide' : 'normal'; }
function fit(){
  const L = layoutFor(innerWidth, innerHeight);
  document.body.className = 'L-' + L; Game.layout = L;
  const box = $('#screen'), bw = box.clientWidth, bh = box.clientHeight;
  const s = Math.max(.5, Math.min(bw / VW, bh / VH));
  cvEl.style.width = Math.floor(VW*s) + 'px'; cvEl.style.height = Math.floor(VH*s) + 'px';
}
addEventListener('resize', fit);
if (window.ResizeObserver) new ResizeObserver(() => fit()).observe($('#screen'));
cvEl.addEventListener('pointerdown', e => {
  if (Game.mode !== 'town' || Game.paused) return;
  const r = cvEl.getBoundingClientRect();
  Town.tap((e.clientX - r.left) * VW / r.width, (e.clientY - r.top) * VH / r.height);
});
$('#dbox').addEventListener('click', () => Game._next());
function hold(el, on, off){
  el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('on'); on(); });
  const up = () => { el.classList.remove('on'); off(); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
}
hold($('#left'), () => input.left = true, () => input.left = false);
hold($('#right'), () => input.right = true, () => input.right = false);
hold($('#jump'), () => { input.jump = true; input.jumpPressed = true; }, () => input.jump = false);
const KEYS = {ArrowLeft:'left', a:'left', ArrowRight:'right', d:'right'};
addEventListener('keydown', e => {
  if (Game.mode === 'town' && !Game.paused){
    if (Game._dlg && (e.key === ' ' || e.key === 'Enter')){ Game._next(); return; }
    if (!$('#panel').classList.contains('on') && (e.key === ' ' || e.key === 'Enter')){ Town.lookNearby(); return; }
    const d = {ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1]}[e.key];
    if (d){ const [x,y] = Town.tileOf(); Town.goTo(x + d[0], y + d[1]); }
    return;
  }
  if (Game.mode !== 'stage') return;
  if (KEYS[e.key]) input[KEYS[e.key]] = true;
  if ((e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') && !e.repeat){ input.jump = true; input.jumpPressed = true; }
  const sk = STAGE && STAGE.skills[+e.key - 1]; if (sk) useSkill(sk.k);
});
addEventListener('keyup', e => { if (KEYS[e.key]) input[KEYS[e.key]] = false; if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') input.jump = false; });
function togglePause(force){
  if (Game.mode !== 'town' && Game.mode !== 'stage') return;
  Game.paused = force != null ? force : !Game.paused; $('#paused').classList.toggle('on', Game.paused);
  if (S) S.paused = Game.paused;
}
$('#pauseBtn').addEventListener('click', () => togglePause());
$('#resumeBtn').addEventListener('click', () => togglePause(false));
$('#restartBtn').addEventListener('click', () => { togglePause(false); Game.toTitle(); });
$('#startBtn').addEventListener('click', () => Game.chapterSelect());
$('#chBack').addEventListener('click', () => { $('#chapters').classList.remove('on'); Game.toTitle(); });
$('#notesBtn').addEventListener('click', () => { if (Game.mode === 'town' && !Game._dlg) Game.showNotes(); });
$('#lookBtn').addEventListener('click', () => { if (Game.mode === 'town' && !Game.paused && !Game._dlg) Town.lookNearby(); });
$('#bookBtn').addEventListener('click', () => { if (Game.mode === 'town' && !Game._dlg) Game.showBook(); });
if (typeof IMG_SRC !== 'undefined' && IMG_SRC.title) $('#titleScr').style.backgroundImage = `url(${IMG_SRC.title})`;

/* =========================================================
   地基：固定步長主迴圈；測試積木 window.__GAME
   ========================================================= */
const DT = 1/60; let last = performance.now(), acc = 0;
function tick(dt){
  if (Game.paused) return;
  if (Game.mode === 'town') Town.update(dt);
  else if (Game.mode === 'stage') update(dt);
}
function render(){
  if (Game.mode === 'stage' && S) draw();
  else if (Town.T) Town.draw();
  else { g.fillStyle = '#2B2D42'; g.fillRect(0, 0, VW, VH); }
}
function loop(now){
  acc += Math.min(.1, (now - last)/1000); last = now;
  try { while (acc >= DT){ tick(DT); acc -= DT; } render(); if (Game.mode === 'stage') refreshSkills(); else Game.updateLook(); }
  catch (err){ $('#err').textContent = '錯誤代碼 E1：' + err.message; throw err; }
  requestAnimationFrame(loop);
}
addEventListener('error', e => { $('#err').textContent = '錯誤代碼 E0：' + e.message; });
fit(); requestAnimationFrame(loop);

window.__GAME = {
  Game, Town, input, useSkill, solid, get S(){ return S; }, get CASES(){ return CASES; }, get LEVEL(){ return LEVEL; }, get STAGE(){ return STAGE; }, get CH(){ return CH; }, get CHAPTERS(){ return CHAPTERS; }, CH_DATA,
  step(n){ for (let i = 0; i < n; i++) tick(DT); },
  teleport(tx){ S.p.x = tx*TS; S.p.y = (GROUND-1)*TS; S.p.vx = S.p.vy = 0; S.cam = Math.max(0, S.p.x - VW*.4); },
};
