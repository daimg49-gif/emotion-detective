/* =========================================================
   闖關引擎：關卡、怪物、技能都從章節資料的 STAGE 讀取
   STAGE.level   地形：坑、平台、暗區、檢查點、終點、怪物位置、擋路物
   STAGE.types   會移動的情緒小怪：用哪些技能冷靜（calmBy）
   STAGE.walls   擋路物：用哪個技能打開（openBy），打開後變成橋、樓梯或消失
   STAGE.skills  這章的四個技能：slow 時間變慢、freeze 站著不動（dur 秒，結束時冷靜小怪或打開擋路物）、
                 calm 說一句話讓小怪冷靜、open 打開擋路物、light 照亮暗區
   ghost 擋路物  沒有牆，只是一個太寬的坑（例如積水坑），打開後變成橋
   ========================================================= */
const TS = 16, VW = 480, VH = 272, ROWS = 17, GROUND = 14;
/*@ASSETS@*/
const COL = { ink:'#2B2D42', mist:'#8D99AE', paper:'#EDF2F4', red:'#EF233C', orange:'#F4A261', yellow:'#E9C46A',
  green:'#2A9D8F', violet:'#7B6D8D', pink:'#F2B5D4', grass:'#5fae5a', dirt:'#8a5a3c', dirt2:'#6e452d', skin:'#F2C9A0', cap:'#7a4a2a', pants:'#3d4a6b' };
let STAGE = null, LEVEL = null;

/* =========================================================
   規則：物理、怪物、技能、情緒條
   ========================================================= */
const G = 900, RUN = 92, JUMP = 300, COYOTE = .1, BUFFER = .12;
let grid, S;
const input = { left:false, right:false, jump:false, jumpPressed:false };
const skillDef = k => STAGE.skills.find(s => s.k === k);

function buildGrid(){
  grid = Array.from({length:ROWS}, () => new Uint8Array(LEVEL.w));
  for (let x = 0; x < LEVEL.w; x++) for (let y = GROUND; y < ROWS; y++) grid[y][x] = 1;
  LEVEL.pits.forEach(([a,b]) => { for (let x = a; x <= b; x++) for (let y = GROUND; y < ROWS; y++) grid[y][x] = 0; });
  LEVEL.platforms.forEach(([x,y,n]) => { for (let i = 0; i < n; i++) grid[y][x+i] = 1; });
  (LEVEL.hidden || []).forEach(([x,y,n]) => { for (let i = 0; i < n; i++) grid[y][x+i] = 3; }); // 3 = 暗區平台，照亮後才算實心
  for (let y = 0; y < ROWS; y++) grid[y][0] = 1;
}
function solid(tx, ty){
  if (tx < 0 || tx >= LEVEL.w) return true;
  if (ty < 0 || ty >= ROWS) return false;
  const v = grid[ty][tx];
  return v === 1 || v === 2 || (v === 3 && S.lit);
}
function newState(){
  const keys = STAGE.skills.map(s => s.k), z = () => Object.fromEntries(keys.map(k => [k, 0]));
  return {
    t:0, running:false, won:false, paused:false,
    p:{x:LEVEL.start*TS, y:(GROUND-1)*TS, vx:0, vy:0, w:10, h:16, face:1, ground:false, coyote:0, buf:0, anim:0, inv:0, pauseT:0},
    bar:20, cp:LEVEL.checkpoints[0], cpReached:{[LEVEL.checkpoints[0]]:true},
    cd:z(), slowT:0, lit:!LEVEL.dark, litR:LEVEL.dark ? 0 : 1, shake:0, cam:0,
    fx:[], say:null, lastCause:null, calmAt:0, calmKey:null, pauseKey:null, respawnAt:0,
    mons: LEVEL.blockers.map(([x,a,b,type]) => ({x:x*TS, y:GROUND*TS, a:a*TS, b:b*TS, dir:1, state:'normal', type, h:STAGE.types[type].h.normal, ph:x})),
    walls: LEVEL.walls.map(w => ({x:w.x*TS, bridge:w.bridge || null, ledge:w.ledge || 0, type:w.type, state:'shut', k:0})),
    stats:{hits:0, falls:0, resets:0, used:z(), wrong:0},
  };
}
function reset(){
  buildGrid(); S = newState();
  S.walls.forEach(w => setWall(w, true));
  updateBar(); refreshSkills();
}
function setWall(w, on){ if (STAGE.wallTypes[w.type].ghost) return; const tx = Math.round(w.x/TS); for (let y = GROUND-5; y < GROUND; y++) for (let x = tx-2; x <= tx; x++) grid[y][x] = on ? 2 : 0; }
const wallMid = w => w.x - 8;
function openDone(w){
  const tx = Math.round(w.x/TS), wt = STAGE.wallTypes[w.type];
  if (w.bridge) for (let x = w.bridge[0]; x <= w.bridge[1]; x++) grid[GROUND][x] = 1;
  if (wt.open === 'stairs') for (let i = 0; i < 3; i++) for (let y = GROUND-1-i; y < GROUND; y++) grid[y][tx-2+i] = 1;
}

function hurt(amount, cause, dir){
  const p = S.p; if (p.inv > 0 || p.pauseT > 0) return;
  S.bar = Math.min(100, S.bar + amount); S.lastCause = cause; S.stats.hits++;
  p.vx = -dir * 170; p.vy = -200; p.inv = 1.1; p.pauseT = 0;
  S.shake = .2; updateBar();
  if (S.bar >= 100){ S.shake = .6; S.stats.resets++; S.respawnAt = S.t + .45; }
}
function respawn(){
  const p = S.p; p.x = S.cp*TS + 2; p.y = (GROUND-1)*TS; p.vx = p.vy = 0; p.inv = 1; p.pauseT = 0;
  S.bar = 30; updateBar();
}
function hintFor(cause){
  if (!cause || cause === 'pit') return STAGE.hints.pit;
  if (cause === 'dark') return LEVEL.dark.hint;
  const [kind, type] = cause.split(':');
  return kind === 'mon' ? STAGE.types[type].hint : STAGE.wallTypes[type].hint;
}
function calmNear(r, k){
  let n = 0, last = null;
  S.mons.forEach(m => { const t = STAGE.types[m.type];
    if (m.state !== 'calm' && t.calmBy.includes(k) && Math.abs(m.x - S.p.x) < r){ m.state = 'calm'; n++; last = t; burst(m.x, m.y-10, t.color || COL.pink, 10); } });
  if (last) toast(last.calmToast, 1400);
  return n;
}
function openWall(w){ w.state = 'opening'; w.k = 0; setWall(w, false); burst(wallMid(w), (GROUND-3)*TS, STAGE.wallTypes[w.type].color || COL.violet, 16); }
function openNear(k){ let n = 0; S.walls.forEach(w => { if (w.state === 'shut' && Math.abs(w.x - S.p.x) < 100 && STAGE.wallTypes[w.type].openBy === k){ openWall(w); n++; } }); return n; }
function nearTarget(){
  const px = S.p.x;
  const m = S.mons.find(m => m.state !== 'calm' && Math.abs(m.x - px) < 130);
  if (m) return {kind:'mon', m, def:STAGE.types[m.type]};
  const w = S.walls.find(w => w.state === 'shut' && Math.abs(w.x - px) < 100);
  if (w) return {kind:'wall', w, def:STAGE.wallTypes[w.type]};
  if (!S.lit && px/TS > LEVEL.dark[0]-3 && px/TS < LEVEL.dark[1]) return {kind:'dark', def:LEVEL.dark};
  return null;
}
function useSkill(k){
  if (!S.running || S.paused || S.won || S.cd[k] > 0) return false;
  if (!Game.skills.has(k)){ toast('這招還沒學會。', 1400); return false; }
  const d = skillDef(k), tg = nearTarget(), p = S.p;
  S.cd[k] = d.cd; S.stats.used[k]++;
  let fit = false;
  if (d.lines){ S.say = {txt:d.lines[(S.stats.used[k]-1) % d.lines.length], t:1.6}; }
  if (d.effect === 'slow'){
    S.slowT = 3; S.bar = Math.max(0, S.bar - 15); updateBar(); ring(p.x+5, p.y+8, d.color);
    if (tg && tg.kind === 'mon' && tg.def.calmBy.includes(k)){ S.calmAt = S.t + .9; S.calmKey = k; fit = true; }
  } else if (d.effect === 'freeze'){
    p.pauseT = S.pauseDur = d.dur || 2; p.vx = 0; S.pauseKey = k; ring(p.x+5, p.y+8, d.color);
    if (tg && tg.kind === 'mon' && tg.def.calmBy.includes(k)) fit = true;
    if (tg && tg.kind === 'wall' && tg.def.openBy === k) fit = true;
  } else if (d.effect === 'calm'){
    S.bar = Math.max(0, S.bar - 10); updateBar(); ring(p.x+5, p.y+8, d.color);
    if (tg && tg.kind === 'mon' && tg.def.calmBy.includes(k)){ S.calmAt = S.t + .6; S.calmKey = k; fit = true; }
  } else if (d.effect === 'open'){
    const w = S.walls.find(w => w.state === 'shut' && Math.abs(w.x - p.x) < 100 && STAGE.wallTypes[w.type].openBy === k);
    if (w){ openWall(w); fit = true; }
    spin(p.x+5, p.y+8, d.color);
  } else if (d.effect === 'light'){
    S.bar = Math.max(0, S.bar - 10); updateBar();
    if (tg && tg.kind === 'dark' && LEVEL.dark.by === k){ S.lit = true; burst(p.x, p.y, COL.yellow, 24); fit = true; }
  }
  if (!tg) toast(STAGE.hints.none, 1600);
  else if (!fit){ const w = tg.def.wrong, msg = w && typeof w === 'object' ? w[k] : w; if (msg){ toast(msg, 2600); S.stats.wrong++; } }
  refreshSkills();
  return true;
}

function moveBody(b, dt){
  b.x += b.vx * dt;
  let x0 = Math.floor(b.x/TS), x1 = Math.floor((b.x+b.w-1)/TS), y0 = Math.floor(b.y/TS), y1 = Math.floor((b.y+b.h-1)/TS);
  for (let ty = y0; ty <= y1; ty++){
    if (b.vx > 0 && solid(x1, ty)){ b.x = x1*TS - b.w; b.vx = 0; break; }
    if (b.vx < 0 && solid(x0, ty)){ b.x = (x0+1)*TS; b.vx = 0; break; }
  }
  b.y += b.vy * dt; b.ground = false;
  x0 = Math.floor(b.x/TS); x1 = Math.floor((b.x+b.w-1)/TS); y0 = Math.floor(b.y/TS); y1 = Math.floor((b.y+b.h-.01)/TS); // 用腳底實際位置判斷，避免站著時每幾格就離地一次
  for (let tx = x0; tx <= x1; tx++){
    if (b.vy > 0 && solid(tx, y1)){ b.y = y1*TS - b.h; b.vy = 0; b.ground = true; break; }
    if (b.vy < 0 && solid(tx, y0)){ b.y = (y0+1)*TS; b.vy = 0; break; }
  }
}

function update(dt){
  if (!S.running || S.paused || S.won) return;
  S.t += dt;
  const p = S.p, wdt = S.slowT > 0 ? dt*.35 : dt;
  for (const k in S.cd) S.cd[k] = Math.max(0, S.cd[k] - dt);
  S.slowT = Math.max(0, S.slowT - dt); p.inv = Math.max(0, p.inv - dt); S.shake = Math.max(0, S.shake - dt);

  if (S.respawnAt && S.t >= S.respawnAt){ S.respawnAt = 0; respawn(); toast(hintFor(S.lastCause), 3200); }
  if (S.calmAt && S.t >= S.calmAt){ S.calmAt = 0; calmNear(130, S.calmKey); }
  if (p.pauseT > 0){
    p.pauseT -= dt; p.vx = 0; S.bar = Math.max(0, S.bar - 6*dt);
    if (p.pauseT <= 0){ p.pauseT = 0; calmNear(130, S.pauseKey); openNear(S.pauseKey); updateBar(); }
  } else {
    const dir = (input.right?1:0) - (input.left?1:0);
    if (p.inv < .8) p.vx = dir * RUN;
    if (dir) p.face = dir;
  }
  if (input.jumpPressed){ p.buf = BUFFER; input.jumpPressed = false; }
  p.buf = Math.max(0, p.buf - dt);
  p.coyote = p.ground ? COYOTE : Math.max(0, p.coyote - dt);
  if (p.buf > 0 && p.coyote > 0 && p.pauseT <= 0){ p.vy = -JUMP; p.buf = 0; p.coyote = 0; }
  if (!input.jump && p.vy < -120) p.vy = -120;
  p.vy = Math.min(p.vy + G*dt, 520);
  moveBody(p, dt);
  p.anim += Math.abs(p.vx) * dt;

  if (p.y > VH + 20){ S.stats.falls++;
    const pt = p.x/TS, pool = S.walls.find(w => w.state === 'shut' && w.bridge && pt >= w.bridge[0] - 1 && pt <= w.bridge[1] + 1);
    S.lastCause = (LEVEL.dark && !S.lit && pt > LEVEL.dark[0] && pt < LEVEL.dark[1]) ? 'dark' : pool ? 'wall:' + pool.type : 'pit';
    S.bar = Math.min(95, S.bar + 10); respawn(); toast(hintFor(S.lastCause), 2600); }

  LEVEL.checkpoints.forEach(c => { if (!S.cpReached[c] && p.x > c*TS){ S.cpReached[c] = true; S.cp = c; burst(c*TS+4, (GROUND-2)*TS, COL.yellow, 12); } });

  // 會移動的情緒小怪：靠近就變大，沒冷靜前過不去
  S.mons.forEach(m => {
    const t = STAGE.types[m.type];
    if (m.state === 'calm'){ m.h += (t.h.calm - m.h) * Math.min(1, dt*6); return; }
    const near = Math.abs(m.x - p.x) < 60 && Math.abs(m.y - (p.y+p.h)) < 70;
    m.state = near ? 'puff' : 'normal';
    m.h += ((near ? t.h.puff : t.h.normal) - m.h) * Math.min(1, wdt*8);
    const watching = p.pauseT > 0 && Math.abs(m.x - p.x) < 130;
    if (!watching) m.x += m.dir * (t.speed || 22) * wdt; if (m.x < m.a){ m.x = m.a; m.dir = 1; } if (m.x > m.b){ m.x = m.b; m.dir = -1; }
    m.ph += wdt * (t.bob || 0);
    const hw = m.h*.42, hh = m.h*.9;
    if (p.x < m.x+hw && p.x+p.w > m.x-hw && p.y < m.y && p.y+p.h > m.y-hh){
      if (p.inv > 0 || p.pauseT > 0){ p.x = p.x + p.w/2 < m.x ? m.x - hw - p.w : m.x + hw; p.vx = 0; }
      else hurt(m.state === 'puff' ? t.hurt[1] : t.hurt[0], 'mon:' + m.type, p.x < m.x ? 1 : -1);
    }
    if (m.state === 'puff' && t.steam && Math.random() < wdt*6) S.fx.push({k:'steam', x:m.x+(Math.random()*10-5), y:m.y-hh-2, vy:-20, t:.8, c:t.steam});
  });
  // 擋路物：撞到會被彈開，用對技能打開
  S.walls.forEach(w => {
    if (w.state === 'opening'){ w.k = Math.min(1, w.k + dt*1.4); if (w.k >= 1){ w.state = 'open'; openDone(w); } return; }
    if (w.state !== 'shut' || STAGE.wallTypes[w.type].ghost) return;
    if (Math.abs((p.x+p.w/2) - wallMid(w)) < 32 && p.y+p.h > (GROUND-5)*TS) hurt(10, 'wall:' + w.type, p.x < w.x ? 1 : -1);
  });

  if (p.x >= LEVEL.door*TS){ S.won = true; setTimeout(() => Game.stageWon(S.stats), 700); }

  S.fx.forEach(e => { e.t -= dt; if (e.vy) e.y += e.vy*dt; if (e.vx) e.x += e.vx*dt; if (e.r != null) e.r += e.dr*dt; });
  S.fx = S.fx.filter(e => e.t > 0);
  if (S.say){ S.say.t -= dt; if (S.say.t <= 0) S.say = null; }
  if (S.lit) S.litR = Math.min(1, S.litR + dt*1.5);

  const target = p.x - VW*.4; S.cam += (target - S.cam) * Math.min(1, dt*6);
  S.cam = Math.max(0, Math.min(LEVEL.w*TS - VW, S.cam));
}
function burst(x, y, c, n){ for (let i = 0; i < n; i++){ const a = Math.random()*Math.PI*2, v = 30+Math.random()*60; S.fx.push({k:'dot', x, y, vx:Math.cos(a)*v, vy:Math.sin(a)*v, c, t:.6+Math.random()*.3}); } }
function ring(x, y, c){ S.fx.push({k:'ring', x, y, r:6, dr:70, c:c || COL.yellow, t:.9}); }
function spin(x, y, c){ S.fx.push({k:'spin', x, y, t:.6, c:c || COL.violet}); }

/* =========================================================
   畫面：背景、地形、角色、怪物
   ========================================================= */
const cv = document.getElementById('cv'), g = cv.getContext('2d');
g.imageSmoothingEnabled = false;
const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const O = (x, y, w, h, c) => { R(x-1, y-1, w+2, h+2, COL.ink); R(x, y, w, h, c); };
const IMGS = {};
if (typeof IMG_SRC !== 'undefined') for (const k in IMG_SRC){ const im = new Image(); im.onload = () => IMGS[k] = im; im.src = IMG_SRC[k]; }
const SKY = ['#3d3561','#5a4373','#7d527c','#a8667a','#cf8577','#e9a36e','#f2c27a'];
function disc(cx, cy, r, c){ for (let dy = -r; dy <= r; dy++){ const w = Math.floor(Math.sqrt(r*r - dy*dy)); R(cx - w, cy + dy, w*2 + 1, 1, c); } }

function drawBg(cam){
  const bg = IMGS[STAGE.bg];
  if (bg){ const w = bg.width, ox = -Math.round(cam*.3) % w; for (let x = ox; x < VW; x += w) g.drawImage(bg, x, 0, w, VH); return; }
  const band = VH / SKY.length;
  SKY.forEach((c, i) => R(0, i*band, VW, band+1, c));
  const ox2 = -(cam*.35) % 240;
  for (let i = -1; i < 4; i++){ const bx = ox2 + i*240;
    R(bx+20, 130, 150, 100, '#8a5d6e'); R(bx+20, 124, 150, 6, '#7a4e60');
    for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) R(bx+32 + c*23, 142 + r*30, 12, 14, '#f2c27a'); }
}
function drawTiles(cam){
  const x0 = Math.floor(cam/TS), x1 = Math.min(LEVEL.w-1, x0 + Math.ceil(VW/TS) + 1), gc = STAGE.ground || {};
  for (let ty = 0; ty < ROWS; ty++) for (let tx = x0; tx <= x1; tx++){
    const v = grid[ty][tx], sx = tx*TS - cam, sy = ty*TS;
    if (v !== 1 && ty >= GROUND){ R(sx, sy, TS, TS, ty === GROUND ? '#2a2b40' : '#1b1c2b'); continue; }
    if (v === 1){
      const top = ty === 0 || grid[ty-1][tx] !== 1;
      R(sx, sy, TS, TS, (tx+ty)%2 ? (gc.a || COL.dirt) : (gc.b || COL.dirt2));
      R(sx+3, sy+7, 2, 2, gc.dot || '#a0704c'); R(sx+10, sy+11, 2, 2, '#5a3826');
      if (top){ R(sx, sy, TS, 5, gc.top || COL.grass); R(sx, sy+5, TS, 1, gc.edge || '#3f7a3c'); }
      if (tx === 0) R(sx, sy, TS, TS, COL.ink);
    } else if (v === 3 && S.lit){
      g.globalAlpha = S.litR; const lc = (LEVEL.dark && LEVEL.dark.plat) || [COL.yellow, COL.orange];
      R(sx, sy, TS, 6, lc[0]); R(sx, sy+6, TS, 3, lc[1]); R(sx, sy, TS, 1, '#fff3c4');
      g.globalAlpha = 1;
    }
  }
  S.walls.forEach(w => { if (w.state === 'shut' || !w.bridge) return;
    const bc = STAGE.wallTypes[w.type].bridgeColor || [COL.pink, COL.violet];
    const a = w.bridge[0]*TS - cam, len = (w.bridge[1]-w.bridge[0]+1)*TS * (w.state === 'open' ? 1 : w.k);
    for (let i = 0; i < len; i += 4){ const wy = GROUND*TS + Math.round(Math.sin((i+S.t*30)/10)); R(a + i, wy, 4, 5, i%8 ? bc[0] : bc[1]); }
  });
}
function drawFlag(x, on){ R(x, (GROUND-3)*TS, 2, 48, COL.ink); O(x+2, (GROUND-3)*TS, 12, 8, on ? COL.yellow : COL.mist); }
function drawGoal(x){
  const y = (GROUND-4)*TS;
  O(x, y, 40, 64, '#b07a4a'); R(x+4, y+4, 32, 56, '#8a5a34'); R(x+30, y+34, 3, 3, COL.yellow);
  O(x+6, y-18, 28, 14, COL.paper);
  R(x+12, y-15, 7, 7, COL.ink); R(x+13, y-14, 5, 5, '#8ecae6'); R(x+19, y-9, 5, 2, COL.ink);
}
function drawPlayer(cam){
  const p = S.p; if (p.inv > 0 && Math.floor(p.inv*12)%2) return;
  const cx = Math.round(p.x + p.w/2 - cam), top = Math.round(p.y), f = p.face;
  const X = (dx, w) => f > 0 ? cx + dx : cx - dx - w;
  const P = (dx, y, w, h, c) => O(X(dx, w), top + y, w, h, c);
  const air = !p.ground, paused = p.pauseT > 0;
  const step = Math.floor(p.anim / 7) % 4;
  if (air){ P(-4, 12, 3, 3, COL.pants); P(1, 11, 3, 3, COL.pants); }
  else if (step === 1){ P(-5, 12, 3, 4, COL.pants); P(2, 12, 3, 4, COL.pants); }
  else if (step === 3){ P(-3, 12, 3, 4, COL.pants); P(0, 13, 3, 3, COL.pants); }
  else { P(-4, 12, 3, 4, COL.pants); P(1, 12, 3, 4, COL.pants); }
  P(-4, 8, 8, 5, COL.green);
  if (paused){ P(-6, 8, 2, 5, COL.green); P(4, 8, 2, 5, COL.green); }
  else { const sw = (!air && (step === 1 || step === 3)) ? (step === 1 ? -1 : 1) : 0; P(-6, 8 + Math.max(0,sw), 2, 4, COL.green); P(4, 8 + Math.max(0,-sw), 2, 4, COL.green); }
  P(-4, 2, 8, 6, COL.skin); R(X(-4, 2), top+2, 2, 3, '#3b2a20');
  if (paused) R(X(1, 2), top+5, 2, 1, COL.ink); else R(X(1, 1), top+4, 1, 2, COL.ink);
  P(-5, -1, 9, 3, COL.cap); R(X(3, 4), top+2, 4, 1, COL.cap);
  if (paused){ g.strokeStyle = COL.yellow; g.lineWidth = 2; g.beginPath(); g.arc(cx, top+7, 13, -Math.PI/2, -Math.PI/2 + Math.PI*2*(1 - p.pauseT/(S.pauseDur || 2))); g.stroke(); }
}
function drawMon(m, cam){
  const t = STAGE.types[m.type], im = IMGS[`${t.img}-${m.state}`];
  const bobY = t.bob && m.state !== 'calm' ? Math.round(Math.abs(Math.sin(m.ph)) * -6) : 0;
  if (im){ const h = Math.round(m.h), w = Math.round(im.width * h / im.height); g.drawImage(im, Math.round(m.x - w/2 - cam), Math.round(m.y - h + bobY), w, h); return; }
  // 沒有圖時的程式畫備案：方塊臉
  const w = Math.round(m.h*.9), h = Math.round(m.h*.8), x = Math.round(m.x - w/2 - cam), y = Math.round(m.y - h + bobY);
  O(x, y, w, h, m.state === 'calm' ? COL.pink : (t.color || COL.red));
  R(x + w*.25, y + h*.35, 2, 2, COL.ink); R(x + w*.7, y + h*.35, 2, 2, COL.ink); R(x + w*.4, y + h*.7, w*.2, 1, COL.ink);
}
function drawWall(w, cam){
  const wt = STAGE.wallTypes[w.type], k = w.state === 'opening' ? w.k : w.state === 'open' ? 1 : 0, baseY = GROUND*TS, cx = Math.round(wallMid(w) - cam);
  if (k >= 1 && wt.open !== 'stairs') return;
  if (wt.draw === 'yarn'){
    const kn = IMGS['frus-knot'];
    if (kn){ g.globalAlpha = 1 - k; g.drawImage(kn, cx - kn.width/2, baseY - kn.height + 2); g.globalAlpha = 1; }
    else { g.globalAlpha = 1 - k; for (let i = 0; i < 5; i++){ const cy = baseY - 9 - i*15; disc(cx, cy, 9, COL.ink); disc(cx, cy, 8, COL.violet); } g.globalAlpha = 1; }
    const lo = IMGS['frus-loose'];
    if (k > 0 && k < 1 && lo && w.bridge){ const bx = w.bridge[0]*TS - cam, len = (w.bridge[1]-w.bridge[0]+1)*TS; g.drawImage(lo, Math.round(bx + len*k - lo.width/2), baseY - lo.height - 4); }
  } else if (wt.draw === 'img'){
    const big = IMGS[`${wt.img}-puff`], small = IMGS[`${wt.img}-calm`];
    if (big){ g.globalAlpha = 1 - k; g.drawImage(big, cx - big.width/2, baseY - big.height + 2); g.globalAlpha = 1; }
    else { g.globalAlpha = 1 - k; O(cx - 24, baseY - 80, 48, 80, wt.color || COL.yellow); g.globalAlpha = 1; }
    if (k > 0 && small) g.drawImage(small, cx - small.width/2, baseY - small.height - Math.round(k*90));
  } else if (wt.draw === 'brick'){
    if (wt.open === 'stairs' && k > 0){
      for (let i = 0; i < 3; i++){ const h = (i+1)*TS*k, x = cx - 24 + i*16; for (let y = 0; y < h; y += 8) { R(x, baseY - h + y, 16, 8, (y/8 + i)%2 ? '#b5654a' : '#c97a5c'); R(x, baseY - h + y, 16, 1, '#7a3f2e'); } }
      if (k >= 1) return;
    }
    g.globalAlpha = 1 - k;
    for (let y = 0; y < 80; y += 8) for (let x = 0; x < 48; x += 16){ const off = (y/8)%2 ? 8 : 0; R(cx - 24 + x + off - 8, baseY - 80 + y, 15, 7, '#b5654a'); }
    R(cx - 24, baseY - 82, 48, 3, COL.ink);
    g.globalAlpha = 1;
  } else if (wt.draw === 'puddle'){
    if (!w.bridge) return;
    const a = w.bridge[0]*TS - cam, len = (w.bridge[1]-w.bridge[0]+1)*TS;
    g.globalAlpha = .85; R(a, baseY + 6, len, VH - baseY - 6, '#3a6ea5');
    for (let i = 0; i < len; i += 12) R(a + i + Math.round(Math.sin(S.t*3 + i)*2), baseY + 9 + (i/12 % 2)*5, 6, 1, '#8ecae6');
    g.globalAlpha = 1;
    if (k > 0 && k < 1) for (let i = 0; i < len*k; i += 20) disc(Math.round(a + i + 8), baseY - 2, 4, COL.paper);
    return;
  } else if (wt.draw === 'door'){
    const lift = Math.round(k*84);
    O(cx - 20, baseY - 80 - lift, 40, 80, '#c98b4f'); R(cx - 16, baseY - 76 - lift, 32, 72, '#a8703c');
    R(cx + 10, baseY - 40 - lift, 3, 3, COL.yellow);
    O(cx - 14, baseY - 96 - lift, 28, 12, COL.paper); g.fillStyle = COL.ink; g.font = 'bold 9px sans-serif'; g.textBaseline = 'top'; g.fillText(wt.sign || '', cx - 12, baseY - 94 - lift);
  }
}
function drawDark(cam){
  if (!LEVEL.dark || S.litR >= 1) return;
  const a = LEVEL.dark[0]*TS - cam, b = (LEVEL.dark[1]+1)*TS - cam;
  if (b < 0 || a > VW) return;
  const p = S.p, cx = p.x + 5 - cam, cy = p.y + 8, fc = LEVEL.dark.fog || '14,14,30';
  g.save();
  g.beginPath(); g.rect(a, 0, b - a, VH); g.clip();
  g.beginPath(); g.rect(a, 0, b - a, VH);
  g.arc(cx, cy, 34 + S.litR*400, 0, Math.PI*2, true);
  g.fillStyle = `rgba(${fc},${.94*(1 - S.litR)})`; g.fill('evenodd');
  g.restore();
}
function drawFx(cam){
  S.fx.forEach(e => {
    if (e.k === 'dot') R(e.x - cam, e.y, 2, 2, e.c);
    else if (e.k === 'steam'){ g.globalAlpha = Math.min(1, e.t*1.5); R(e.x - cam, e.y, 3, 3, e.c || '#d8d8e0'); g.globalAlpha = 1; }
    else if (e.k === 'ring'){ g.globalAlpha = Math.min(1, e.t); g.strokeStyle = e.c; g.lineWidth = 2; g.beginPath(); g.arc(e.x - cam, e.y, e.r, 0, Math.PI*2); g.stroke(); g.globalAlpha = 1; }
    else if (e.k === 'spin'){ g.strokeStyle = e.c; g.lineWidth = 2; const a = (1 - e.t/.6)*Math.PI*2; g.beginPath(); g.arc(e.x - cam, e.y, 12, a, a + Math.PI*1.4); g.stroke(); }
  });
  if (S.say){
    const p = S.p, t = S.say.txt; g.font = '12px "PingFang TC","Noto Sans TC",sans-serif';
    const w = Math.ceil(g.measureText(t).width) + 10, x = Math.round(p.x + 5 - cam - w/2), y = Math.round(p.y - 22);
    O(x, y, w, 15, COL.paper); R(x + w/2 - 1, y + 15, 3, 3, COL.paper);
    g.fillStyle = COL.ink; g.textBaseline = 'top'; g.fillText(t, x + 5, y + 2);
  }
}
function draw(){
  const cam = Math.round(S.cam + (S.shake > 0 ? (Math.random()*6 - 3) : 0));
  drawBg(cam); drawTiles(cam);
  LEVEL.checkpoints.forEach(c => drawFlag(c*TS - cam, !!S.cpReached[c]));
  drawGoal(LEVEL.door*TS - cam);
  S.walls.forEach(w => drawWall(w, cam));
  S.mons.forEach(m => drawMon(m, cam));
  drawPlayer(cam);
  drawDark(cam);
  drawFx(cam);
  if (S.slowT > 0){ g.fillStyle = 'rgba(142,202,230,.12)'; g.fillRect(0, 0, VW, VH); }
}
