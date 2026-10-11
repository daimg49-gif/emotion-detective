// 整章自動測試：node tests/test_game.js <遊戲 html 絕對路徑> <截圖資料夾>
// 第一、三、四章各跑 A、B 兩種版本；另外測提早結算與「沒學會的技能，關卡直接打開」
const { chromium } = require('playwright');
const [file, out] = process.argv.slice(2);
const results = []; const ok = (n, c, info='') => results.push(`${c ? 'PASS' : 'FAIL'} ${n} ${info}`);
const CITE_KEY = {1:/Seligman/, 2:/Pennebaker/, 3:/Lieberman/, 4:/Ramirez/, 5:/Gilovich/};
const BASE = ['開心','難過','生氣','害怕','討厭'];

function helpers(page){
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const advance = async () => { for (let i = 0; i < 40; i++){ if (!(await page.isVisible('#dlg'))) return; await page.click('#dbox'); } };
  const walk = async (x, y) => { await ev(([x,y]) => window.__GAME.Town.goTo(x, y), [x, y]); for (let i = 0; i < 80; i++){ await ev(() => window.__GAME.step(10)); if (await page.isVisible('#dlg') || await page.isVisible('#panel.on')) break; } };
  const clickBtn = async (txt) => { await page.locator('#pBtns button', {hasText: txt}).first().click(); };
  return {ev, advance, walk, clickBtn};
}
// 闖關機器人：碰到小怪用它的冷靜技能，碰到擋路物用打開它的技能，進暗區用照亮技能，坑和台階就跳
function playStage(){
  const G = window.__GAME, S = () => G.S, TS = 16, L = G.LEVEL, ST = G.STAGE, inp = G.input; let frames = 0, waits = 0;
  const has = k => G.Game.skills.has(k), def = k => ST.skills.find(s => s.k === k);
  while (!S().won && frames < 60*600){
    const s = S(), p = s.p; inp.right = true; inp.jump = false;
    if (waits > 0){ waits--; inp.right = false; G.step(1); frames++; continue; }
    const m = s.mons.find(m => m.state !== 'calm' && m.x - p.x > -10 && m.x - p.x < 75);
    const w = s.walls.find(w => w.state === 'shut' && w.x - p.x > 0 && w.x - p.x < 70);
    const tx = Math.floor((p.x + p.w)/TS), feet = Math.floor((p.y + p.h)/TS);
    if (m && p.ground){ const k = ST.types[m.type].calmBy.find(has); if (k && G.useSkill(k)){ waits = def(k).effect === 'freeze' ? (def(k).dur || 2)*60 + 15 : 70; continue; } }
    if (w && p.ground){ const k = ST.wallTypes[w.type].openBy; if (G.useSkill(k)){ waits = def(k).effect === 'freeze' ? (def(k).dur || 2)*60 + 70 : 60; continue; } }
    if (L.dark && !s.lit && tx >= L.dark[0] && tx <= L.dark[1] && G.useSkill(L.dark.by)){ waits = 40; continue; }
    if (p.ground && (!G.solid(tx, feet) || G.solid(Math.floor((p.x + p.w + 3)/TS), feet - 1))){ inp.jumpPressed = true; inp.jump = true; }
    if (!p.ground && p.vy < 0) inp.jump = true;
    G.step(1); frames++;
  }
  return {won:S().won, frames};
}

async function run(browser, ch, vp, variant){
  const ctx = await browser.newContext({viewport:vp, hasTouch:true});
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + file);
  const {ev, advance, walk, clickBtn} = helpers(page);
  const tag = `第${ch}章 ${vp.width}x${vp.height}-${variant}`;
  ok(`${tag} 一開始調查按鈕是暗的`, await page.isDisabled('#lookBtn'));
  await page.click('#startBtn');
  ok(`${tag} 章節選擇：五章都可以玩`, await page.isVisible('#chapters.on') && (await page.locator('#chList button:not([disabled])').count()) === 5);
  await page.click('#ch' + ch);
  await ev(v => window.__GAME.Game.forceVariant = [v, v, v], variant);
  await advance();
  ok(`${tag} 序章後要找書架`, await ev(() => window.__GAME.Town.T.step) === 'shelf');
  await walk(2, 1); await advance();
  await walk(7, 2); await advance();
  ok(`${tag} 學會深呼吸`, await ev(() => window.__GAME.Game.skills.has('breath')));
  // 線索物件只算這個版本有內容的（有些線索只在 A 或 B 出現）
  const cases = await ev(v => window.__GAME.CASES.map(c => ({npc:c.npc, pos:c.pos, ents:Object.keys(c.entClues).filter(k => c.entClues[k][v]), wrong:Object.keys(c.wrong), best:c.best, ok:c.ok, level:c.level, evidence:c.evidence})), variant);
  const ORDER = variant === 'A' ? [1, 0, 2] : [2, 1, 0];
  for (let k = 0; k < 3; k++){
    const i = ORDER[k], c = cases[i], p = c.pos[variant];
    await walk(11, 8); await page.waitForSelector('#panel.on'); await clickBtn(`接下委託 ${i+1}`);
    ok(`${tag} 委託 ${i+1} 開始`, await ev(() => window.__GAME.Town.T.ci) === i);
    if (k === 0){ // 第一件用「調查」按鈕，其餘直接點人
      await ev(([x,y]) => { const T = window.__GAME.Town; const spots = [[x,y+1],[x-1,y],[x+1,y],[x,y-1]]; for (const [a,b] of spots){ if (T.goTo(a,b)) return; } }, [p.x, p.y]);
      await ev(() => window.__GAME.step(400)); await page.waitForTimeout(400);
      ok(`${tag} 走到委託人旁邊，調查按鈕亮起`, !(await page.isDisabled('#lookBtn')) && (await page.textContent('#lookName')).length > 0);
      await page.click('#lookBtn');
    } else await walk(p.x, p.y);
    await page.waitForSelector('#panel.on');
    ok(`${tag} 委託 ${i+1} 沒線索時不能判斷`, await page.locator('#pBtns button', {hasText:'說出他的情緒'}).isDisabled());
    await clickBtn('看他的表情'); await advance(); await clickBtn('看他的動作'); await advance();
    await clickBtn('跟他說話'); await advance();
    await clickBtn('先離開');
    if (k === 0) await page.screenshot({path:`${out}/ch${ch}-${variant}-case${i+1}.png`});
    const entTiles = await ev(ids => { const T = window.__GAME.Town; return ids.map(id => { const e = T.entsNow().find(e => e.id === id); return e ? e.tiles[0] : null; }); }, c.ents);
    ok(`${tag} 委託 ${i+1} 線索物件都在地圖上`, entTiles.every(Boolean), c.ents.join(','));
    for (const [x,y] of entTiles.filter(Boolean)){ await walk(x, y); await advance(); }
    const n = await ev(() => Object.keys(window.__GAME.Town.T.cs.found).length);
    ok(`${tag} 委託 ${i+1} 找到 4 種線索`, n === 4, `n=${n}`);
    await walk(p.x, p.y); await page.waitForSelector('#panel.on');
    // 第一次故意說錯
    const right = c.best[variant].concat(c.ok[variant]);
    const wrongW = c.wrong.find(w => !right.includes(w)) || BASE.find(w => !right.includes(w));
    await clickBtn('說出他的情緒');
    await page.click(`#pBody [data-w="${wrongW}"]`); await page.click('#pBody [data-l="3"]'); await clickBtn('確定'); await advance();
    ok(`${tag} 委託 ${i+1} 說錯「${wrongW}」會回到調查`, await page.isVisible('#panel.on') && !(await ev(() => window.__GAME.Town.T.cs.named)));
    // 方向對但不夠細的詞不能結案
    await clickBtn('說出他的情緒');
    await page.click(`#pBody [data-w="${c.ok[variant][0]}"]`); await page.click('#pBody [data-l="3"]'); await clickBtn('確定'); await advance();
    ok(`${tag} 委託 ${i+1} 只說「${c.ok[variant][0]}」不能結案`, await page.isVisible('#panel.on') && !(await ev(() => window.__GAME.Town.T.cs.named)));
    await clickBtn('說出他的情緒');
    await page.click(`#pBody [data-w="${c.best[variant][0]}"]`); await page.click(`#pBody [data-l="${c.level[variant]}"]`);
    await clickBtn('確定'); await advance();
    await page.waitForSelector('#panel.on');
    const evi = await ev(good => { const keys = window.__GAME.Town.T.cs.clues.map(k => k.key);
      return {bad: keys.findIndex(k => !good.includes(k)), good: keys.findIndex(k => good.includes(k))}; }, c.evidence[variant]);
    ok(`${tag} 委託 ${i+1} 線索本裡有可用的證據`, evi.good >= 0, JSON.stringify(evi));
    if (evi.bad >= 0){ await page.click(`#pBody [data-e="${evi.bad}"]`); await advance();
      ok(`${tag} 委託 ${i+1} 證據挑錯會重挑`, await page.isVisible('#panel.on') && !(await ev(() => window.__GAME.Town.T.cs.named))); }
    await page.click(`#pBody [data-e="${evi.good}"]`); await advance();
    ok(`${tag} 委託 ${i+1} 命名正確`, await ev(() => window.__GAME.Town.T.cs.named) === 'best');
    await page.locator('#pBtns button').first().click(); await advance();
  }
  ok(`${tag} 三個委託後回到公布欄`, await ev(() => window.__GAME.Town.T.step) === 'board');
  await walk(11, 8); await page.waitForSelector('#panel.on'); await clickBtn('就結案');
  ok(`${tag} 選闖關後要回社辦`, await ev(() => window.__GAME.Town.T.step) === 'return');
  ok(`${tag} 四個技能都學會`, await ev(() => window.__GAME.STAGE.skills.every(s => window.__GAME.Game.skills.has(s.k))));
  await walk(5, 9); await advance();
  ok(`${tag} 進入闖關`, await ev(() => window.__GAME.Game.mode) === 'stage');
  ok(`${tag} 技能按鈕是這章的 4 招`, await ev(() => [...document.querySelectorAll('.sk')].map(b => b.dataset.k).join() === window.__GAME.STAGE.skills.map(s => s.k).join()));
  await page.screenshot({path:`${out}/ch${ch}-${variant}-stage.png`});
  const r = await ev(playStage);
  ok(`${tag} 闖關通過`, r.won, `${r.frames} 格`);
  await page.waitForSelector('#settle.on', {timeout:5000}).catch(() => {});
  ok(`${tag} 出現結案報告`, await page.isVisible('#settle.on'));
  const cards = await page.locator('#settle .ecard:not(.none)').count();
  ok(`${tag} 圖鑑收集`, cards >= 3, `cards=${cards}`);
  const head = await page.textContent('#settleCard h2');
  ok(`${tag} 結案報告標題用事件名稱`, !BASE.some(w => head.includes(w)), head);
  ok(`${tag} 結算有研究出處`, CITE_KEY[ch].test(await page.textContent('#settle')));
  await page.screenshot({path:`${out}/ch${ch}-${variant}-settle.png`, fullPage:true});
  await page.click('#againBtn');
  ok(`${tag} 結案後回到章節選擇`, await page.isVisible('#chapters.on'));
  ok(`${tag} 沒有 JS 錯誤`, errs.length === 0, errs.join(' | '));
  await ctx.close();
}

async function runShort(browser){
  const ctx = await browser.newContext({viewport:{width:1024, height:768}, hasTouch:true});
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + file);
  const {ev, advance, walk, clickBtn} = helpers(page);
  await page.click('#startBtn');
  const chTxt = await page.textContent('#chList');
  ok('章節卡不寫情緒名稱', !BASE.some(w => chTxt.includes(w)), chTxt.replace(/\s+/g,' ').slice(0, 80));
  const paren = await ev(() => { const bad = []; const walkO = (o) => { if (typeof o === 'string'){ if (/[（）()]/.test(o)) bad.push(o.slice(0,20)); } else if (o && typeof o === 'object') Object.values(o).forEach(walkO); };
    Object.values(window.__GAME.CH_DATA).forEach(d => { walkO(d.cases); walkO(d.opening); walkO(d.bump); walkO(d.winStory); }); return bad; });
  ok('各章對話沒有括號補充文字', !paren.length, paren.join(' / '));
  await page.click('#ch3');
  await ev(() => window.__GAME.Game.forceVariant = ['A','A','A']);
  await advance(); await walk(2, 1); await advance(); await walk(7, 2); await advance();
  await walk(11, 8); await page.waitForSelector('#panel.on');
  ok('提早結算 沒做委託時沒有「結束今天的調查」', await page.locator('#pBtns button', {hasText:'結束今天的調查'}).count() === 0);
  await clickBtn('接下委託 2');
  await ev(() => { const G = window.__GAME, T = G.Town.T, c = G.CASES[1]; T.cs.found = {face:1, body:1, scene:1}; T.cs.clues = [{type:'scene', text:'x', key:'trash'}];
    T.cs.named = 'best'; T.cs.word = '挫折'; T.cs.typesAtName = 3; T.cs.tries = 1; T.cs.evTries = 1; T.cs.order = c.options.slice(); });
  const p = await ev(() => window.__GAME.CASES[1].pos.A);
  await walk(p.x, p.y); await page.waitForSelector('#panel.on');
  await page.locator('#pBtns button').first().click(); await advance();
  await walk(11, 8); await page.waitForSelector('#panel.on');
  ok('提早結算 完成一件後出現「結束今天的調查」', await page.locator('#pBtns button', {hasText:'結束今天的調查'}).count() === 1);
  ok('提早結算 學會 2 招後出現「去闖關」', await page.locator('#pBtns button', {hasText:'去闖關'}).count() === 1);
  await clickBtn('結束今天的調查');
  await page.waitForSelector('#settle.on');
  const txt = await page.textContent('#settle');
  ok('提早結算 結案報告顯示 2 件「這次沒處理」', (txt.match(/這次沒處理/g) || []).length === 2);
  ok('提早結算 顯示完成 1/3', /完成 1\/3/.test(txt));
  await page.screenshot({path:`${out}/early-settle.png`});
  // 沒學會的技能，對應的關卡直接打開
  const stageWith = (skills) => ev(sk => { const G = window.__GAME, Gm = G.Game; document.querySelector('#settle').classList.remove('on'); Gm.skills = new Set(sk); Gm.startStage();
    return {lit:G.S.lit, walls:G.S.walls.map(w => w.state)}; }, skills);
  let st = await stageWith(['breath','angle']);
  ok('第三章闖關 沒學「說出來」時暗區直接亮', st.lit === true);
  ok('第三章闖關 學了「換個角度」挫折怪還在', st.walls.every(x => x === 'shut'));
  st = await stageWith(['breath','pause']);
  ok('第三章闖關 沒學「換個角度」時橋直接搭好', st.walls.every(x => x === 'open') && await ev(() => window.__GAME.solid(68, 14)));
  // 第四章、第一章：只會深呼吸也能過
  const CN = {1:'一', 2:'二', 4:'四', 5:'五'};
  for (const [ch, checks] of [[4, [[43,14,'磚牆後的橋'],[40,11,'樓梯最上層'],[100,14,'第二道橋']]], [1, [[73,14,'得意怪後的橋']]], [2, [[43,14,'寂寞怪後的橋'],[69,14,'積水上的紙船']]], [5, [[73,14,'聚光燈後的橋']]]]){
    await ev(n => { const G = window.__GAME.Game; G.toTitle(); G.begin(n); G._dlg = null; document.querySelector('#dlg').hidden = true; }, ch);
    st = await stageWith(['breath']);
    ok(`第${CN[ch]}章闖關 只會深呼吸時擋路物全部打開`, st.walls.every(x => x === 'open') && st.lit === true, st.walls.join());
    for (const [x, y, name] of checks) ok(`第${CN[ch]}章闖關 ${name}是實心的`, await ev(([x,y]) => window.__GAME.solid(x, y), [x, y]));
    const r = await ev(playStage);
    ok(`第${CN[ch]}章闖關 只會深呼吸也能通過`, r.won, `${r.frames} 格`);
    await page.waitForTimeout(900);
  }
  ok('提早結算與技能調整 沒有 JS 錯誤', !errs.length, errs.join('|'));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch();
  await runShort(browser);
  await run(browser, 3, {width:1024, height:768}, 'A');
  await run(browser, 3, {width:390, height:844}, 'B');
  await run(browser, 4, {width:1024, height:768}, 'A');
  await run(browser, 4, {width:1180, height:820}, 'B');
  await run(browser, 1, {width:844, height:390}, 'A');
  await run(browser, 1, {width:1366, height:768}, 'B');
  await run(browser, 2, {width:1024, height:768}, 'A');
  await run(browser, 2, {width:390, height:844}, 'B');
  await run(browser, 5, {width:1180, height:820}, 'A');
  await run(browser, 5, {width:844, height:390}, 'B');
  console.log(results.join('\n'));
  const fail = results.filter(r => r.startsWith('FAIL')).length;
  console.log(`\n${results.length - fail} PASS / ${fail} FAIL`);
  await browser.close();
})();
