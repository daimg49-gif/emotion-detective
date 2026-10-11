// 整章自動測試：node tests/test_game.js <遊戲 html 絕對路徑> <截圖資料夾>
const { chromium } = require('playwright');
const [file, out] = process.argv.slice(2);
const results = []; const ok = (n, c, info='') => results.push(`${c ? 'PASS' : 'FAIL'} ${n} ${info}`);

async function run(browser, vp, variant){
  const ctx = await browser.newContext({viewport:vp, hasTouch:true});
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + file);
  const tag = `${vp.width}x${vp.height}-${variant}`;
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const advance = async () => { for (let i = 0; i < 40; i++){ const vis = await page.isVisible('#dlg'); if (!vis) return; await page.click('#dbox'); } };
  const walk = async (x, y) => { await ev(([x,y]) => window.__GAME.Town.goTo(x, y), [x, y]); for (let i = 0; i < 80; i++){ await ev(() => window.__GAME.step(10)); if (await page.isVisible('#dlg') || await page.isVisible('#panel.on')) break; } };
  const clickBtn = async (txt) => { await page.locator('#pBtns button', {hasText: txt}).first().click(); };

  await page.screenshot({path:`${out}/${tag}-title.png`});
  const paren = await ev(() => { const G = window.__GAME, bad = []; const walk = (o) => { if (typeof o === 'string'){ if (/[（）()]/.test(o)) bad.push(o.slice(0,20)); } else if (o && typeof o === 'object') Object.values(o).forEach(walk); }; walk(G.CASES); return bad; });
  ok(`${tag} 對話沒有括號補充文字`, !paren.length, paren.join(' / '));
  ok(`${tag} 一開始調查按鈕是暗的`, await page.isDisabled('#lookBtn'));
  await page.click('#startBtn');
  ok(`${tag} 出現章節選擇，第三章可以玩`, await page.isVisible('#chapters.on') && !(await page.isDisabled('#ch3')) && await page.isDisabled('#ch1'));
  await page.screenshot({path:`${out}/${tag}-chapters.png`});
  await page.click('#ch3');
  await ev(v => window.__GAME.Game.forceVariant = [v, v, v], variant);
  await advance();
  ok(`${tag} 序章後要找書架`, await ev(() => window.__GAME.Town.T.step) === 'shelf');
  await walk(2, 1); await advance();
  await walk(7, 2); await advance();
  ok(`${tag} 學會深呼吸`, await ev(() => window.__GAME.Game.skills.has('breath')));
  await page.screenshot({path:`${out}/${tag}-office.png`});
  const cases = await ev(() => window.__GAME.CASES.map(c => ({npc:c.npc, pos:c.pos, ents:Object.keys(c.entClues), wrongWord:Object.keys(c.wrong)[0], best:c.best, ok:c.ok, level:c.level, extras:c.extras, evidence:c.evidence})));
  const ORDER = variant === 'A' ? [1, 0, 2] : [2, 1, 0];
  for (let k = 0; k < 3; k++){
    const i = ORDER[k], c = cases[i], p = c.pos[variant];
    await walk(11, 8); await page.waitForSelector('#panel.on'); await clickBtn(`接下委託 ${i+1}`);
    ok(`${tag} 委託 ${i+1} 開始`, await ev(() => window.__GAME.Town.T.ci) === i);
    // 先看主角色兩種線索：委託 1 走到旁邊後用「調查」按鈕，其餘直接點人
    if (k === 0){
      await ev(([x,y]) => { const T = window.__GAME.Town; const spots = [[x,y+1],[x-1,y],[x+1,y],[x,y-1]]; for (const [a,b] of spots){ if (T.goTo(a,b)) return; } }, [p.x, p.y]);
      await ev(() => window.__GAME.step(400)); await page.waitForTimeout(400);
      ok(`${tag} 走到委託人旁邊，調查按鈕亮起`, !(await page.isDisabled('#lookBtn')) && (await page.textContent('#lookName')).length > 0);
      await page.click('#lookBtn');
    } else await walk(p.x, p.y);
    await page.waitForSelector('#panel.on');
    const disabledBefore = await page.locator('#pBtns button', {hasText:'說出他的情緒'}).isDisabled();
    ok(`${tag} 委託 ${i+1} 沒線索時不能判斷`, disabledBefore);
    await clickBtn('看他的表情'); await advance(); await clickBtn('看他的動作'); await advance();
    await clickBtn('跟他說話'); await advance();
    await clickBtn('先離開');
    if (i === 0) await page.screenshot({path:`${out}/${tag}-case1.png`});
    // 調查周圍
    const entTiles = await ev(ids => { const T = window.__GAME.Town; return ids.map(id => { const e = T.entsNow().find(e => e.id === id); return e ? e.tiles[0] : null; }).filter(Boolean); }, c.ents);
    for (const [x,y] of entTiles.slice(0, 2)){ await walk(x, y); await advance(); }
    const n = await ev(() => Object.keys(window.__GAME.Town.T.cs.found).length);
    ok(`${tag} 委託 ${i+1} 找到 3 種以上線索`, n >= 3, `n=${n}`);
    await walk(p.x, p.y); await page.waitForSelector('#panel.on');
    // 第一次故意說錯
    await clickBtn('說出他的情緒');
    const wrongW = c.wrongWord && !['生氣'].includes(c.wrongWord) ? c.wrongWord : '開心';
    await page.click(`#pBody [data-w="${wrongW}"]`); await page.click('#pBody [data-l="3"]'); await clickBtn('確定'); await advance();
    ok(`${tag} 委託 ${i+1} 說錯會回到調查`, await page.isVisible('#panel.on') && !(await ev(() => window.__GAME.Town.T.cs.named)));
    // 選「方向對但不夠細」的詞（例如生氣）不能結案
    await clickBtn('說出他的情緒');
    await page.click(`#pBody [data-w="${c.ok[variant][0]}"]`); await page.click('#pBody [data-l="3"]'); await clickBtn('確定'); await advance();
    ok(`${tag} 委託 ${i+1} 只說「${c.ok[variant][0]}」不能結案`, await page.isVisible('#panel.on') && !(await ev(() => window.__GAME.Town.T.cs.named)));
    await clickBtn('說出他的情緒');
    await page.click(`#pBody [data-w="${c.best[variant][0]}"]`); await page.click(`#pBody [data-l="${c.level[variant]}"]`);
    if (i === 2) await page.screenshot({path:`${out}/${tag}-name.png`});
    await clickBtn('確定'); await advance();
    // 證據：先挑一條不對的，再挑對的
    await page.waitForSelector('#panel.on');
    const evi = await ev(ok => { const cs = window.__GAME.Town.T.cs; const keys = cs.clues.map(k => k.key);
      return {bad: keys.findIndex(k => !ok.includes(k)), good: keys.findIndex(k => ok.includes(k))}; }, c.evidence[variant]);
    ok(`${tag} 委託 ${i+1} 線索本裡有可用的證據`, evi.good >= 0, JSON.stringify(evi));
    if (i === 0) await page.screenshot({path:`${out}/${tag}-evidence.png`});
    if (evi.bad >= 0){ await page.click(`#pBody [data-e="${evi.bad}"]`); await advance();
      ok(`${tag} 委託 ${i+1} 證據挑錯會重挑`, await page.isVisible('#panel.on') && !(await ev(() => window.__GAME.Town.T.cs.named))); }
    await page.click(`#pBody [data-e="${evi.good}"]`); await advance();
    ok(`${tag} 委託 ${i+1} 命名正確`, await ev(() => window.__GAME.Town.T.cs.named) === 'best');
    if (i === 0) await page.screenshot({path:`${out}/${tag}-choose.png`});
    await page.locator('#pBtns button').first().click(); await advance();
  }
  ok(`${tag} 三個委託後回到公布欄`, await ev(() => window.__GAME.Town.T.step) === 'board');
  await walk(11, 8); await page.waitForSelector('#panel.on'); await clickBtn('去闖關');
  ok(`${tag} 選闖關後要回社辦`, await ev(() => window.__GAME.Town.T.step) === 'return');
  ok(`${tag} 四個技能都學會`, await ev(() => ['breath','pause','angle','say'].every(k => window.__GAME.Game.skills.has(k))));
  await walk(5, 9); await advance();
  ok(`${tag} 進入闖關`, await ev(() => window.__GAME.Game.mode) === 'stage');
  await page.screenshot({path:`${out}/${tag}-stage.png`});
  const won = await ev(() => {
    const G = window.__GAME, S = () => G.S, TS = 16, L = G.LEVEL, inp = G.input; let frames = 0, waits = 0;
    while (!S().won && frames < 60*600){
      const s = S(), p = s.p; inp.right = true; inp.jump = false;
      if (waits > 0){ waits--; inp.right = false; G.step(1); frames++; continue; }
      const ang = s.angry.find(m => m.state !== 'calm' && m.x - p.x > -10 && m.x - p.x < 75);
      const fr = s.fr.find(f => f.state === 'knot' && f.x - p.x > 0 && f.x - p.x < 60);
      const tx = Math.floor((p.x + p.w)/TS);
      if (ang && p.ground && G.useSkill('pause')){ waits = 130; continue; }
      if (fr && p.ground && G.useSkill('angle')){ waits = 60; continue; }
      if (!s.lit && tx >= L.dark[0] && tx <= L.dark[1] && G.useSkill('say')){ waits = 40; continue; }
      const feet = Math.floor((p.y + p.h)/TS);
      if (p.ground && !G.solid(tx, feet)){ inp.jumpPressed = true; inp.jump = true; }
      if (!p.ground && p.vy < 0) inp.jump = true;
      G.step(1); frames++;
    }
    return S().won;
  });
  ok(`${tag} 闖關通過`, won);
  await page.waitForSelector('#settle.on', {timeout:5000}).catch(() => {});
  ok(`${tag} 出現結案報告`, await page.isVisible('#settle.on'));
  const cards = await page.locator('#settle .ecard:not(.none)').count();
  ok(`${tag} 圖鑑收集`, cards >= 4, `cards=${cards}`);
  const txt = await page.textContent('#settle');
  ok(`${tag} 結算有研究出處`, /Lieberman/.test(txt) && /Nummenmaa/.test(txt));
  await page.screenshot({path:`${out}/${tag}-settle.png`});
  await page.click('#againBtn');
  ok(`${tag} 結案後回到章節選擇`, await page.isVisible('#chapters.on'));
  ok(`${tag} 沒有 JS 錯誤`, errs.length === 0, errs.join(' | '));
  await ctx.close();
}
async function runShort(browser){
  const ctx = await browser.newContext({viewport:{width:1024, height:768}, hasTouch:true});
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + file);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const advance = async () => { for (let i = 0; i < 40; i++){ if (!(await page.isVisible('#dlg'))) return; await page.click('#dbox'); } };
  const walk = async (x, y) => { await ev(([x,y]) => window.__GAME.Town.goTo(x, y), [x, y]); for (let i = 0; i < 80; i++){ await ev(() => window.__GAME.step(10)); if (await page.isVisible('#dlg') || await page.isVisible('#panel.on')) break; } };
  const clickBtn = async (txt) => { await page.locator('#pBtns button', {hasText: txt}).first().click(); };
  await page.click('#startBtn'); await page.click('#ch3');
  await ev(() => window.__GAME.Game.forceVariant = ['A','A','A']);
  await advance(); await walk(2, 1); await advance(); await walk(7, 2); await advance();
  await walk(11, 8); await page.waitForSelector('#panel.on');
  ok('提早結算 沒做委託時沒有「結束今天的調查」', await page.locator('#pBtns button', {hasText:'結束今天的調查'}).count() === 0);
  await clickBtn('接下委託 2');
  // 用測試接口快速完成委託 2
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
  // 只學會深呼吸和換個角度時，闖關的暗區直接打開
  await ev(() => { const G = window.__GAME.Game; document.querySelector('#settle').classList.remove('on'); G.skills = new Set(['breath','angle']); G.startStage(); });
  const st = await ev(() => ({lit: window.__GAME.S.lit, fr: window.__GAME.S.fr.map(f => f.state)}));
  ok('闖關 沒學「說出來」時暗區直接亮', st.lit === true);
  ok('闖關 學了「換個角度」挫折怪還在', st.fr.every(x => x === 'knot'));
  await ev(() => { const G = window.__GAME.Game; G.skills = new Set(['breath','pause']); G.startStage(); });
  const st2 = await ev(() => ({fr: window.__GAME.S.fr.map(f => f.state), solid: window.__GAME.solid(68, 14)}));
  ok('闖關 沒學「換個角度」時橋直接搭好', st2.fr.every(x => x === 'bridge') && st2.solid);
  ok('提早結算 沒有 JS 錯誤', !errs.length, errs.join('|'));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch();
  await runShort(browser);
  await run(browser, {width:1024, height:768}, 'A');
  await run(browser, {width:1180, height:820}, 'B');
  await run(browser, {width:844, height:390}, 'A');
  await run(browser, {width:390, height:844}, 'B');
  await run(browser, {width:1366, height:768}, 'A');
  console.log(results.join('\n'));
  await browser.close();
})();
