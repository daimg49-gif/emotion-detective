// 版面測試：各種螢幕尺寸下，按鈕不出畫面、操作區不蓋住遊戲畫面、對話時主角看得到
// node tests/test_layout.js <遊戲 html 絕對路徑> <截圖資料夾>
const { chromium } = require('playwright');
const [file, out] = process.argv.slice(2);
const SIZES = [
  ['電腦1920', 1920, 1080], ['筆電1366', 1366, 768], ['iPad橫', 1024, 768], ['iPadAir橫', 1180, 820],
  ['iPad直', 768, 1024], ['手機橫', 844, 390], ['小手機橫', 667, 375], ['手機直', 390, 844], ['小手機直', 360, 640],
];
(async () => {
  const browser = await chromium.launch(); const res = [];
  const ok = (n, c, i='') => res.push(`${c ? 'PASS' : 'FAIL'} ${n} ${i}`);
  for (const [si, [name0, w, h]] of SIZES.entries()){
    const ch = [3, 4, 1, 2, 5][si % 5], name = `${name0}-第${ch}章`; // 每種尺寸輪流用不同章節，五章的技能按鈕都會測到
    const ctx = await browser.newContext({viewport:{width:w, height:h}, hasTouch:true});
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto('file://' + file);
    await page.screenshot({path:`${out}/${name}-0title.png`});
    await page.click('#startBtn'); await page.screenshot({path:`${out}/${name}-0chapters.png`}); await page.click('#ch' + ch); await page.waitForTimeout(200);
    const check = async (label, sel) => page.evaluate(([sel]) => {
      const vw = innerWidth, vh = innerHeight, cv = document.querySelector('#cv').getBoundingClientRect();
      const bad = [], overlap = [];
      document.querySelectorAll(sel).forEach(el => { const r = el.getBoundingClientRect(); if (!r.width) return;
        if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) bad.push(el.id || el.className || el.textContent.trim().slice(0,6));
        const ov = !(r.right <= cv.left + 1 || r.left >= cv.right - 1 || r.bottom <= cv.top + 1 || r.top >= cv.bottom - 1);
        if (ov) overlap.push(el.id || el.textContent.trim().slice(0,6)); });
      const small = [...document.querySelectorAll(sel)].filter(el => { const r = el.getBoundingClientRect(); return r.width && Math.min(r.width, r.height) < 44; }).map(e => e.id || e.textContent.trim().slice(0,6));
      return {bad, overlap, small, cv:[Math.round(cv.width), Math.round(cv.height)], layout:document.body.className};
    }, [sel]);
    // 對話中（序章）
    let r = await check('town', '#top, #controls button, #pauseBtn');
    ok(`${name} 地圖：按鈕都在螢幕內`, !r.bad.length, r.bad.join(','));
    ok(`${name} 地圖：操作區不蓋遊戲畫面`, !r.overlap.length, `${r.layout} 畫面 ${r.cv} ${r.overlap.join(',')}`);
    ok(`${name} 地圖：按鈕夠大可點`, !r.small.length, r.small.join(','));
    const dlg = await page.evaluate(() => { const d = document.querySelector('#dbox').getBoundingClientRect(), vh = innerHeight, vw = innerWidth;
      return {inView: d.top >= 0 && d.bottom <= vh + 1 && d.left >= -1 && d.right <= vw + 1}; });
    ok(`${name} 對話框完整顯示`, dlg.inView);
    await page.screenshot({path:`${out}/${name}-1dialog.png`});
    for (let i = 0; i < 10 && await page.isVisible('#dlg'); i++) await page.click('#dbox');
    // 主角在對話時要看得到：走到書架觸發對話，檢查主角螢幕位置不在對話框底下
    await page.evaluate(() => { window.__GAME.Town.goTo(2, 1); window.__GAME.step(300); });
    const vis = await page.evaluate(() => {
      const T = window.__GAME.Town.T, cv = document.querySelector('#cv').getBoundingClientRect(), k = cv.width / 480;
      const py = cv.top + (T.p.y - T.cam.y) * k, d = document.querySelector('#dlg').hidden ? null : document.querySelector('#dbox').getBoundingClientRect();
      return {py, dTop: d ? d.top : null};
    });
    ok(`${name} 對話時主角沒被擋住`, vis.dTop == null || vis.py < vis.dTop - 4, JSON.stringify(vis));
    await page.screenshot({path:`${out}/${name}-2shelf.png`});
    for (let i = 0; i < 10 && await page.isVisible('#dlg'); i++) await page.click('#dbox');
    // 闖關畫面
    await page.evaluate(() => { const G = window.__GAME.Game; window.__GAME.STAGE.skills.forEach(s => G.skills.add(s.k)); G.startStage(); });
    await page.waitForTimeout(200);
    r = await check('stage', '#top, #controls button, #pauseBtn, .sk, #jump, #left, #right');
    ok(`${name} 闖關：按鈕都在螢幕內`, !r.bad.length, r.bad.join(','));
    ok(`${name} 闖關：按鈕不蓋遊戲畫面`, !r.overlap.length, `${r.layout} 畫面 ${r.cv} ${r.overlap.join(',')}`);
    ok(`${name} 闖關：按鈕夠大可點`, !r.small.length, r.small.join(','));
    ok(`${name} 遊戲畫面夠大`, r.cv[0] >= 320, `畫面 ${r.cv}`);
    await page.screenshot({path:`${out}/${name}-3stage.png`});
    // 結算畫面可以捲到底
    await page.evaluate(() => { const G = window.__GAME.Game; G.stageWon({used:Object.fromEntries(window.__GAME.STAGE.skills.map(s => [s.k, 1]))}); });
    await page.waitForTimeout(200);
    const again = await page.evaluate(() => { const b = document.querySelector('#againBtn'); b.scrollIntoView(); const r = b.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.top >= 0; });
    ok(`${name} 結算按鈕捲得到`, again);
    await page.screenshot({path:`${out}/${name}-4settle.png`});
    ok(`${name} 沒有 JS 錯誤`, !errs.length, errs.join('|'));
    await ctx.close();
  }
  console.log(res.join('\n')); await browser.close();
})();
