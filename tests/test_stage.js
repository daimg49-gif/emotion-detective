const { chromium } = require('playwright');
const file = process.argv[2], out = process.argv[3];
(async () => {
  const browser = await chromium.launch();
  const results = [];
  const ok = (name, cond, info='') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name} ${info}`); };
  for (const vp of [{width:1024,height:768,name:'iPad'},{width:1180,height:820,name:'iPadAir'},{width:844,height:390,name:'phoneLand'}]){
    const ctx = await browser.newContext({viewport:{width:vp.width,height:vp.height}, hasTouch:true});
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
    await page.goto('file://' + file);
    await page.screenshot({path:`${out}/${vp.name}-intro.png`});
    await page.tap('#toIntro'); await page.tap('#startBtn');
    await page.waitForTimeout(300);
    // 按鈕大小
    const sizes = await page.$$eval('.btn,.sk,#pauseBtn', els => els.map(e => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); }));
    ok(`${vp.name} 按鈕至少 56px`, Math.min(...sizes) >= 56, `min=${Math.min(...sizes)}`);
    // 自動通關機器人
    const r = await page.evaluate(() => {
      const G = window.__GAME, S = () => G.S, TS = 16, L = G.LEVEL, inp = G.input;
      let frames = 0, waits = 0, log = [];
      while (!S().won && frames < 60*600){
        const s = S(), p = s.p;
        inp.right = true; inp.jump = false;
        if (waits > 0){ waits--; inp.right = false; G.step(1); frames++; continue; }
        const ang = s.angry.find(m => m.state !== 'calm' && m.x - p.x > -10 && m.x - p.x < 75);
        const fr = s.fr.find(f => f.state === 'knot' && f.x - p.x > 0 && f.x - p.x < 60);
        const tx = Math.floor((p.x + p.w)/TS);
        if (ang && p.ground){ if (G.useSkill('pause')) { log.push('pause@'+tx); waits = 130; continue; } }
        if (fr && p.ground){ if (G.useSkill('angle')) { log.push('angle@'+tx); waits = 60; continue; } }
        if (!s.lit && tx >= L.dark[0] && tx <= L.dark[1]){ if (G.useSkill('say')) { log.push('say@'+tx); waits = 40; continue; } }
        const feet = Math.floor((p.y + p.h)/TS);
        if (p.ground && !G.solid(tx + 1, feet) && !G.solid(tx, feet)) {}
        if (p.ground && !G.solid(tx, feet)) { inp.jumpPressed = true; inp.jump = true; }
        if (!p.ground && p.vy < 0) inp.jump = true;
        G.step(1); frames++;
      }
      return { won: S().won, sec: Math.round(frames/60), stats: S().stats, log, lit: S().lit, fr: S().fr.map(f => f.state), angry: S().angry.map(m => m.state) };
    });
    ok(`${vp.name} 機器人通關`, r.won, JSON.stringify({sec:r.sec, hits:r.stats.hits, falls:r.stats.falls, resets:r.stats.resets, log:r.log}));
    ok(`${vp.name} 暗區點亮`, r.lit);
    ok(`${vp.name} 挫折怪都變成橋`, r.fr.every(x => x === 'bridge'), r.fr.join(','));
    await page.waitForTimeout(800);
    await page.screenshot({path:`${out}/${vp.name}-win.png`});
    // 站著不動不能抖：連續 120 格都在地上、高度不變
    const idle = await page.evaluate(() => { const G = window.__GAME; Object.assign(G.input, {left:false,right:false,jump:false,jumpPressed:false}); G.start(); G.step(30); const S = G.S; const ys = new Set(); let air = 0;
      for (let i = 0; i < 120; i++){ G.step(1); ys.add(Math.round(S.p.y)); if (!S.p.ground) air++; } return {ys:[...ys], air}; });
    ok(`${vp.name} 站著不動不會抖`, idle.ys.length === 1 && idle.air === 0, JSON.stringify(idle));
    // 機制檢查
    const m = await page.evaluate(() => {
      const G = window.__GAME; G.start(); const S = G.S, out = {};
      // 硬撞生氣怪會被彈開、情緒上升
      G.teleport(9); G.input.right = true; G.step(120); G.input.right = false;
      out.hitBar = S.bar; out.hits = S.stats.hits;
      // 在挫折怪前用暫停：有提示、牆還在
      G.step(200); G.teleport(63); S.cd.pause = 0; S.p.inv = 0; G.useSkill('pause'); out.toast1 = document.querySelector('#toast').textContent; out.wall = G.solid(65, 12);
      // 情緒條滿：回到旗子
      G.step(150); S.bar = 95; S.p.inv = 0; S.p.pauseT = 0; G.teleport(9); G.input.right = true; G.step(200); G.input.right = false;
      out.afterOverload = { bar: S.bar, x: Math.round(S.p.x/16), resets: S.stats.resets, toast: document.querySelector('#toast').textContent };
      // 暗區沒說出來會掉下去
      G.start(); G.teleport(48); G.input.right = true; G.step(240); G.input.right = false;
      out.darkFall = { falls: S.stats.falls, toast: document.querySelector('#toast').textContent };
      return out;
    });
    ok(`${vp.name} 硬撞生氣怪情緒上升`, m.hits > 0 && m.hitBar > 20, `bar=${m.hitBar}`);
    ok(`${vp.name} 用錯技能有提示`, /換個角度/.test(m.toast1) && m.wall, m.toast1);
    ok(`${vp.name} 情緒滿回到旗子`, m.afterOverload.resets >= 1 && m.afterOverload.bar <= 40, JSON.stringify(m.afterOverload));
    ok(`${vp.name} 暗區沒說出來會掉下去`, m.darkFall.falls >= 1, m.darkFall.toast);
    await page.evaluate(() => { const G = window.__GAME; G.start(); G.teleport(40); G.step(30); });
    await page.screenshot({path:`${out}/${vp.name}-dark.png`});
    await page.evaluate(() => { const G = window.__GAME; G.teleport(8); G.input.right = true; G.step(40); G.input.right = false; });
    await page.screenshot({path:`${out}/${vp.name}-angry.png`});
    ok(`${vp.name} 沒有 JS 錯誤`, errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  console.log(results.join('\n'));
  await browser.close();
})();
