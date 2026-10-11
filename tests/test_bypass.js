const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({viewport:{width:1024,height:768}});
  await page.goto('file://' + process.argv[2]);
  const r = await page.evaluate(() => {
    const G = window.__GAME, out = {};
    // 不用技能、一直往右跳，看能不能跳過生氣怪
    G.start(); G.teleport(4); let f = 0;
    while (f < 600){ G.input.right = true; const p = G.S.p; if (p.ground){ G.input.jumpPressed = true; } G.input.jump = true; G.step(1); f++; }
    out.jumpOverAngry = { x: Math.round(G.S.p.x/16), hits: G.S.stats.hits };
    // 跳過挫折怪的牆？
    G.start(); G.teleport(60); f = 0;
    while (f < 400){ G.input.right = true; if (G.S.p.ground) G.input.jumpPressed = true; G.input.jump = true; G.step(1); f++; }
    out.jumpOverWall = { x: Math.round(G.S.p.x/16), falls: G.S.stats.falls };
    return out;
  });
  console.log(JSON.stringify(r));
  await page.evaluate(() => { const G = window.__GAME; G.start(); G.teleport(40); G.step(30); });
  await page.screenshot({path: process.argv[3] + '/dark.png'});
  await page.evaluate(() => { const G = window.__GAME; G.start(); G.teleport(5); G.input.right = true; G.step(25); G.input.right = false; G.step(2); });
  await page.screenshot({path: process.argv[3] + '/angry.png'});
  await page.evaluate(() => { const G = window.__GAME; G.start(); G.teleport(61); G.step(30); });
  await page.screenshot({path: process.argv[3] + '/wall.png'});
  await b.close();
})();
