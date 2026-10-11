/* =========================================================
   ② 校園地圖（俯視）：點地圖移動、調查、案件流程
   ========================================================= */
const Town = (() => {
  const W = 40, H = 26, SPEED = 74; // 地圖大小每章都一樣，房間和物件看 MAP（換章時由 loadChapter 指定）
  const FLOOR = {wood:1, class:2, hall:3, grass:4, court:5, clinic:6};
  let tiles, block, T;

  function build(){
    tiles = Array.from({length:H}, () => new Uint8Array(W));
    MAP.rooms.forEach(([x,y,w,h,f]) => { for (let j = y; j < y+h; j++) for (let i = x; i < x+w; i++) tiles[j][i] = FLOOR[f]; });
    MAP.doors.forEach(([x,y,f]) => tiles[y][x] = FLOOR[f]);
  }
  function entsNow(){
    const list = MAP.ents.slice();
    const c = T.ci >= 0 && T.step === 'case' ? CASES[T.ci] : null;
    if (c){
      const p = c.pos[T.cs.v];
      list.push({id:c.npc, npc:c.npc, tiles:[[p.x,p.y]], expr:p.expr, pose:p.pose, shake:p.shake, main:true});
      c.extras.filter(e => !e.only || e.only === T.cs.v).forEach(e => list.push({id:e.id, npc:e.id, tiles:[[e.x,e.y]], expr:e.expr, pose:e.pose, line:e.line}));
    }
    return list;
  }
  function rebuildBlock(){
    block = Array.from({length:H}, () => new Uint8Array(W));
    entsNow().forEach(e => e.tiles.forEach(([x,y]) => block[y][x] = 1));
  }
  const walk = (x, y) => x >= 0 && y >= 0 && x < W && y < H && tiles[y][x] && !block[y][x];
  function entAt(x, y){ return entsNow().find(e => e.tiles.some(([a,b]) => a === x && b === y)); }

  function newTown(){
    return {
      step:'intro', ci:-1, cs:null, p:{x:MAP.start[0]*TS+8, y:MAP.start[1]*TS+8, dir:'down', anim:0}, path:[], target:null,
      cam:{x:0,y:0}, zone:'', results:[], cards:new Set(), t:0, busy:false,
    };
  }
  function reset(){ build(); T = newTown(); rebuildBlock(); centerCam(true); }

  /* ---------- 移動 ---------- */
  function bfs(sx, sy, goal){
    const prev = new Map(), key = (x,y) => y*W + x, q = [[sx,sy]]; prev.set(key(sx,sy), null);
    while (q.length){
      const [x,y] = q.shift();
      if (goal(x,y)){ const path = []; let k = key(x,y); while (k != null){ path.unshift([k % W, Math.floor(k / W)]); k = prev.get(k); } return path.slice(1); }
      for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx = x+dx, ny = y+dy, k = key(nx,ny);
        if (!prev.has(k) && walk(nx,ny)){ prev.set(k, key(x,y)); q.push([nx,ny]); } }
    }
    return null;
  }
  function tileOf(){ return [Math.floor(T.p.x/TS), Math.floor(T.p.y/TS)]; }
  function goTo(tx, ty){
    if (T.busy) return false;
    const [sx,sy] = tileOf(), e = entAt(tx, ty);
    if (e){
      const near = (x,y) => e.tiles.some(([a,b]) => Math.abs(a-x) + Math.abs(b-y) === 1);
      if (near(sx,sy)){ face(e); act(e); return true; }
      const path = bfs(sx, sy, near); if (!path) return false;
      T.path = path; T.target = e; return true;
    }
    if (!walk(tx,ty)) return false;
    const path = bfs(sx, sy, (x,y) => x === tx && y === ty); if (!path) return false;
    T.path = path; T.target = null; return true;
  }
  function face(e){ const [x,y] = tileOf(), [a,b] = e.tiles[0]; T.p.dir = Math.abs(a-x) > Math.abs(b-y) ? (a > x ? 'right' : 'left') : (b > y ? 'down' : 'up'); }

  function update(dt){
    T.t += dt;
    if (T.busy){ centerCam(false, dt); return; }
    const p = T.p;
    if (T.path.length){
      const [tx,ty] = T.path[0], gx = tx*TS+8, gy = ty*TS+8, dx = gx - p.x, dy = gy - p.y, d = Math.hypot(dx,dy), s = SPEED*dt;
      if (Math.abs(dx) > Math.abs(dy)) p.dir = dx > 0 ? 'right' : 'left'; else if (dy) p.dir = dy > 0 ? 'down' : 'up';
      if (d <= s){ p.x = gx; p.y = gy; T.path.shift(); if (!T.path.length && T.target){ const e = T.target; T.target = null; face(e); act(e); } }
      else { p.x += dx/d*s; p.y += dy/d*s; }
      p.anim += s;
    }
    const [x,y] = tileOf(), z = MAP.zones.find(z => x >= z.x && x < z.x+z.w && y >= z.y && y < z.y+z.h);
    if (z && z.name !== T.zone){ T.zone = z.name; if (T.t > .5) toast(z.name, 1200); }
    if (T.step === 'return' && y <= 10 && x <= 9){ T.path = []; T.target = null; Game.bump(); }
    centerCam(false, dt);
  }
  function centerCam(snap, dt){
    const tx = Math.max(0, Math.min(W*TS - VW, T.p.x - VW/2)), ty = Math.max(0, Math.min(H*TS - VH, T.p.y - VH/2 + Game.camBias()));
    if (snap){ T.cam.x = tx; T.cam.y = ty; } else { const k = Math.min(1, dt*6); T.cam.x += (tx - T.cam.x)*k; T.cam.y += (ty - T.cam.y)*k; }
  }

  /* ---------- 互動 ---------- */
  function act(e){
    const c = T.step === 'case' ? CASES[T.ci] : null, v = T.cs && T.cs.v;
    if (e.id === 'shelf' && T.step === 'shelf'){ T.step = 'mia'; Game.say(TUTORIAL.shelf, () => { Game.bookOn(); Game.objective(); }); return; }
    if (e.id === 'mia'){
      if (T.step === 'mia'){ Game.say(TUTORIAL.mia, () => { Game.learn('breath'); T.step = 'board'; Game.objective(); }); return; }
      if (T.step === 'shelf'){ Game.say([['mia','先去書架那邊拿《情緒圖鑑》吧。']]); return; }
      Game.say([['mia','委託都在走廊的公布欄。我在這裡等你的報告！']]); return;
    }
    if (e.id === 'board'){
      if (T.step === 'board'){ Game.boardPanel(i => startCase(i)); return; }
      if (T.step === 'case'){ Game.say([['sys', `委託單：${c.board}`]]); return; }
    }
    if (c && e.main){ Game.casePanel(); return; }
    if (c && hasClue(c, e.id)){ clue(e.id); return; }
    if (e.npc && e.npc !== 'mia'){ Game.say([[e.npc, e.line || '……']]); return; }
    if (e.flavor) Game.say([['sys', e.flavor]]);
  }
  // 有些線索只在 A 或 B 版本出現，另一個版本是 null
  const hasClue = (c, id) => !!(c.entClues[id] && c.entClues[id][T.cs.v]);
  function startCase(i){
    T.ci = i; T.step = 'case';
    T.cs = {v: Math.random() < .5 ? 'A' : 'B', found:{}, clues:[], named:null, tries:0, evTries:0, typesAtName:0, fit:null, choice:null};
    if (Game.forceVariant) T.cs.v = Game.forceVariant[i] || T.cs.v;
    rebuildBlock(); Game.objective(); Game.clueCount();
  }
  function addClue(type, text, key){
    const fresh = !T.cs.found[type];
    T.cs.found[type] = true;
    if (!T.cs.clues.some(c => c.text === text)) T.cs.clues.push({type, text, key: key || type});
    Game.clueCount();
    return fresh;
  }
  function clue(entId){
    const c = CASES[T.ci], d = c.entClues[entId], v = T.cs.v, type = typeof d.type === 'object' ? d.type[v] : d.type;
    const fresh = addClue(type, d[v], entId);
    Game.say([['sys', d[v]], ['sys', fresh ? `找到「${TYPE_NAME[type]}」線索。` : '這個線索已經記下來了。']]);
  }
  function finishCase(){
    const c = CASES[T.ci];
    T.results.push({idx:T.ci, id:c.id, v:T.cs.v, typesAtName:T.cs.typesAtName, named:T.cs.named, tries:T.cs.tries, evTries:T.cs.evTries, fit:T.cs.fit, choice:T.cs.choice});
    T.step = 'board'; T.ci = -1; T.cs = null; rebuildBlock(); Game.clueCount();
    Game.objective();
  }

  /* ---------- 畫面 ---------- */
  const FC = {1:['#b07a4a','#a06c40'], 2:['#c9a46c','#bd975f'], 3:['#d9d2c3','#cfc7b6'], 4:['#6fb35f','#67aa57'], 5:['#c8553d','#bf4c35'], 6:['#e6eef2','#d8e3ea']};
  function drawTiles(cx, cy){
    const x0 = Math.max(0, Math.floor(cx/TS)), y0 = Math.max(0, Math.floor(cy/TS));
    for (let y = y0; y < Math.min(H, y0 + 19); y++) for (let x = x0; x < Math.min(W, x0 + 32); x++){
      const t = tiles[y][x], sx = x*TS - cx, sy = y*TS - cy;
      if (!t){
        const below = y+1 < H && tiles[y+1][x];
        const side = (x > 10 && tiles[y][x-1]) || (x < 26 && tiles[y][x+1]); // 旁邊是這章開放的房間，就畫普通牆
        if (y >= 1 && y <= 6 && x >= 10 && x <= 26 && !side){ // 其他班級的教室外牆
          R(sx, sy, TS, TS, '#b9a58a'); R(sx, sy+TS-1, TS, 1, '#a08c72');
          if ((y === 2 || y === 5) && x % 3 !== 1){ O(sx+3, sy+2, 10, 9, '#8ecae6'); R(sx+8, sy+2, 1, 9, '#2B2D42'); }
          if (y === 6 && x % 8 === 2) O(sx+3, sy+1, 10, 14, '#7a4a2a');
          continue;
        }
        R(sx, sy, TS, TS, below ? '#6a6283' : '#3a3550');
        if (below){ R(sx, sy, TS, 3, '#544c6e'); R(sx, sy+TS-2, TS, 2, '#2B2D42'); }
        continue;
      }
      R(sx, sy, TS, TS, FC[t][(x+y)%2]);
      if (t === 1 || t === 2){ R(sx, sy+7, TS, 1, t === 1 ? '#8f5f36' : '#a8844f'); }
      if (t === 4 && (x*7+y*3)%5 === 0){ R(sx+4, sy+6, 1, 2, '#4f9443'); R(sx+6, sy+5, 1, 3, '#4f9443'); }
      if (t === 5){
        const [ax,ay,aw,ah] = [4,15,14,7];
        if (y === ay) R(sx, sy, TS, 1, '#f2efe6'); if (y === ay+ah-1) R(sx, sy+TS-1, TS, 1, '#f2efe6');
        if (x === ax) R(sx, sy, 1, TS, '#f2efe6'); if (x === ax+aw-1) R(sx+TS-1, sy, 1, TS, '#f2efe6');
        if (x === ax + aw/2) R(sx, sy, 1, TS, '#f2efe6');
      }
    }
    MAP.doors.forEach(([x,y]) => { if (y === 7) R(x*TS - cx + 2, y*TS - cy + 4, 12, 8, '#7a4a2a'); });
  }
  function drawEnt(e, cx, cy){
    const [x,y] = e.tiles[0], sx = x*TS - cx, sy = y*TS - cy, n = e.tiles.length;
    switch (e.draw){
      case 'shelf': O(sx+1, sy-6, n*TS-2, 20, '#7a4a2a'); for (let i = 0; i < n*3; i++) R(sx+3+i*5, sy-4, 3, 6, ['#EF233C','#E9C46A','#2A9D8F','#8ecae6'][i%4]); for (let i = 0; i < n*3; i++) R(sx+3+i*5, sy+5, 3, 6, ['#F4A261','#7B6D8D','#EDF2F4'][i%3]); break;
      case 'desk': O(sx+1, sy+2, 14, 10, '#8a5a34'); R(sx+9, sy-1, 4, 4, '#E9C46A'); break;
      case 'sdesk': O(sx+2, sy+3, 12, 8, '#a8844f'); R(sx+4, sy+5, 6, 3, '#EDF2F4'); break;
      case 'board': O(sx+1, sy, 14, 12, '#b07a4a'); R(sx+3, sy+2, 4, 5, '#EDF2F4'); R(sx+8, sy+3, 5, 4, '#F2B5D4'); R(sx+4, sy+8, 7, 2, '#E9C46A'); break;
      case 'photo': O(sx+1, sy, 14, 12, '#2B2D42'); R(sx+3, sy+2, 4, 4, '#8ecae6'); R(sx+9, sy+2, 4, 4, '#E9C46A'); R(sx+3, sy+7, 4, 3, '#F4A261');
        if (T.step === 'case' && CASES[T.ci].markPhoto){ R(sx+9, sy+7, 4, 3, '#EDF2F4'); R(sx+10, sy+8, 1, 2, '#3a7bd5'); R(sx+12, sy+8, 1, 2, '#3a7bd5'); } break;
      case 'sink': O(sx+1, sy+2, n*TS-2, 9, '#cfd8e3'); for (let i = 0; i < n; i++) { R(sx+5+i*TS, sy+4, 6, 4, '#8ecae6'); R(sx+7+i*TS, sy, 2, 4, '#8D99AE'); } break;
      case 'blackboard': O(sx, sy-4, n*TS, 14, '#2f5d4a'); R(sx+6, sy, 22, 1, '#EDF2F4'); R(sx+6, sy+3, 30, 1, '#EDF2F4'); R(sx, sy+10, n*TS, 2, '#8a5a34'); break;
      case 'trash': O(sx+3, sy+2, 10, 12, '#5a6b8a'); R(sx+2, sy+1, 12, 2, '#3d4a6b'); R(sx+5, sy-1, 3, 3, '#EDF2F4'); R(sx+8, sy, 3, 2, '#EDF2F4'); break;
      case 'sign': R(sx+7, sy+6, 2, 10, '#2B2D42'); O(sx+1, sy, 14, 8, '#EDF2F4'); R(sx+3, sy+2, 10, 1, '#2B2D42'); R(sx+3, sy+4, 7, 1, '#2B2D42'); break;
      case 'score': O(sx+1, sy, n*TS-2, 12, '#2B2D42'); R(sx+4, sy+3, 8, 6, '#EF233C'); R(sx+20, sy+3, 8, 6, '#3a7bd5'); R(sx+6, sy+5, 4, 2, '#EDF2F4'); R(sx+22, sy+5, 4, 2, '#EDF2F4'); break;
      case 'piano': O(sx+1, sy-4, n*TS-2, 16, '#2B2D42'); R(sx+3, sy+5, n*TS-6, 4, '#EDF2F4'); for (let i = 0; i < n*4; i++) R(sx+4+i*7, sy+5, 2, 2, '#2B2D42'); R(sx+6, sy-2, 12, 5, '#f2efe6'); break;
      case 'bed': O(sx+1, sy-2, 14, n*TS, '#EDF2F4'); R(sx+2, sy-1, 12, 6, '#8ecae6'); R(sx+1, sy+n*TS-4, 14, 2, '#8D99AE'); break;
      case 'book': O(sx+3, sy+3, 10, 8, '#c8553d'); R(sx+5, sy+4, 7, 6, '#EDF2F4'); R(sx+6, sy+6, 5, 1, '#8D99AE'); R(sx+6, sy+8, 4, 1, '#8D99AE'); break;
      case 'mini': O(sx+1, sy, 14, 11, '#2f5d4a'); R(sx+3, sy+3, 8, 1, '#EDF2F4'); R(sx+3, sy+6, 5, 1, '#EDF2F4'); R(sx+7, sy+11, 2, 4, '#8a5a34'); break;
      case 'phone': O(sx+5, sy+4, 6, 9, '#7B6D8D'); R(sx+6, sy+5, 4, 4, '#F2B5D4'); R(sx+6, sy+10, 4, 1, '#EDF2F4'); break;
      case 'tank': O(sx+1, sy-2, n*TS-2, 13, '#cfe8f2'); R(sx+2, sy+5, n*TS-4, 5, '#8ecae6'); R(sx+6, sy+7, 6, 3, '#8D99AE'); R(sx+1, sy+11, n*TS-2, 2, '#5a6b8a'); break;
      case 'pot': O(sx+2, sy+2, 12, 11, '#8D99AE'); R(sx+3, sy+3, 10, 3, '#E9C46A'); R(sx+1, sy+5, 1, 3, '#2B2D42'); R(sx+14, sy+5, 1, 3, '#2B2D42'); break;
      case 'clock': disc(sx+8, sy+5, 6, '#2B2D42'); disc(sx+8, sy+5, 5, '#EDF2F4'); R(sx+8, sy+1, 1, 4, '#2B2D42'); R(sx+8, sy+5, 3, 1, '#EF233C'); break;
      case 'skates': if (T.cs && T.cs.v === 'B'){ O(sx+5, sy+4, 6, 10, '#8ecae6'); R(sx+6, sy+3, 4, 2, '#2B2D42'); }
        else { O(sx+2, sy+5, 5, 7, '#3a7bd5'); O(sx+9, sy+5, 5, 7, '#3a7bd5'); R(sx+2, sy+12, 5, 2, '#E9C46A'); R(sx+9, sy+12, 5, 2, '#E9C46A'); } break;
      case 'tree': R(sx+6, sy+8, 4, 8, '#6e452d'); disc(sx+8, sy+2, 9, '#2B2D42'); disc(sx+8, sy+2, 8, '#3f7a3c'); disc(sx+6, sy, 4, '#5fae5a'); break;
    }
  }
  function drawPerson(cx, by, lk, dir, frame, o){
    o = o || {};
    const big = lk.big ? 1 : 0, sit = o.pose === 'sit', top = by - 17 - big + (sit ? 3 : 0), x = Math.round(cx), sh = o.shake ? (Math.floor(T.t*20)%2) : 0;
    const P = (dx, dy, w, h, c) => O(x + dx + sh, top + dy, w, h, c);
    // 腿
    if (sit){ P(-4, 13, 3, 2, '#3d4a6b'); P(1, 13, 3, 2, '#3d4a6b'); }
    else { const s = frame % 4; const a = s === 1 ? 1 : s === 3 ? -1 : 0; P(-4, 12+Math.max(0,a), 3, 4-Math.max(0,a), '#3d4a6b'); P(1, 12+Math.max(0,-a), 3, 4-Math.max(0,-a), '#3d4a6b'); }
    // 身體
    P(-4-big, 7, 8+big*2, 6, lk.top);
    if (lk.stripe){ R(x-4+sh, top+9, 8, 1, lk.stripe); R(x-4+sh, top+11, 8, 1, lk.stripe); }
    P(-6-big, 8, 2, 4, lk.top); P(4+big, 8, 2, 4, lk.top);
    // 頭
    P(-4, 0, 8, 7, '#F2C9A0');
    const hc = lk.hair;
    if (dir === 'up'){ R(x-4+sh, top, 8, 6, hc); }
    else {
      if (lk.style === 'buzz'){ R(x-4+sh, top, 8, 2, hc); }
      else if (lk.style === 'curly'){ R(x-5+sh, top-1, 10, 3, hc); R(x-5+sh, top+2, 2, 2, hc); R(x+3+sh, top+2, 2, 2, hc); }
      else if (lk.style === 'braids'){ R(x-4+sh, top, 8, 2, hc); R(x-6+sh, top+3, 2, 6, hc); R(x+4+sh, top+3, 2, 6, hc); }
      else if (lk.style === 'pony'){ R(x-4+sh, top, 8, 2, hc); R(x-4+sh, top+2, 1, 3, hc); R(x+4+sh, top+1, 2, 6, hc); }
      else if (lk.style === 'long'){ R(x-5+sh, top, 10, 2, hc); R(x-5+sh, top+2, 2, 8, hc); R(x+3+sh, top+2, 2, 8, hc); }
      else if (lk.style === 'bob'){ R(x-5+sh, top, 10, 2, hc); R(x-5+sh, top+2, 2, 4, hc); R(x+3+sh, top+2, 2, 4, hc); }
      else { R(x-4+sh, top, 8, 2, hc); R(x-4+sh, top+2, 1, 2, hc); }
      if (lk.style === 'cap'){ O(x-5+sh, top-2, 10, 3, lk.cap || '#7a4a2a'); R(x+(dir === 'left' ? -7 : dir === 'right' ? 3 : -3)+sh, top+1, 4, 1, lk.cap || '#7a4a2a'); }
      if (dir === 'down') face(x+sh, top, o.expr || 'neutral', lk);
      else { const ex = dir === 'left' ? -3 : 2; R(x+ex+sh, top+3, 1, 2, '#2B2D42'); }
    }
    function face(fx, ty, ex, l){
      const K = '#2B2D42';
      if (ex === 'hide'){ R(fx-4, ty, 8, 5, l.hair); R(fx-4, ty+5, 1, 1, '#ff8a8a'); R(fx+3, ty+5, 1, 1, '#ff8a8a'); return; }
      if (l.glasses){ R(fx-3, ty+3, 3, 2, '#EDF2F4'); R(fx+1, ty+3, 3, 2, '#EDF2F4'); }
      if (ex === 'angry'){ R(fx-3, ty+2, 2, 1, K); R(fx+1, ty+2, 2, 1, K); R(fx-2, ty+3, 1, 1, K); R(fx+2, ty+3, 1, 1, K); R(fx-1, ty+5, 3, 1, K); R(fx-4, ty+4, 1, 1, '#ff6b6b'); R(fx+3, ty+4, 1, 1, '#ff6b6b'); }
      else if (ex === 'sulk'){ R(fx-2, ty+4, 1, 1, K); R(fx+2, ty+4, 1, 1, K); R(fx-1, ty+6, 3, 1, K); R(fx-2, ty+5, 1, 1, K); }
      else if (ex === 'cry'){ R(fx-2, ty+3, 1, 1, K); R(fx+2, ty+3, 1, 1, K); R(fx-3, ty+4, 1, 2, '#8ecae6'); R(fx-1, ty+5, 3, 1, K); R(fx-2, ty+3, 1, 1, '#ff6b6b'); }
      else if (ex === 'blank'){ R(fx-2, ty+3, 1, 1, K); R(fx+2, ty+3, 1, 1, K); R(fx-1, ty+5, 2, 1, K); }
      else if (ex === 'laugh'){ R(fx-2, ty+3, 2, 1, K); R(fx+1, ty+3, 2, 1, K); R(fx-1, ty+4, 3, 2, '#7a2a2a'); }
      else if (ex === 'happy'){ R(fx-2, ty+3, 1, 1, K); R(fx+2, ty+3, 1, 1, K); R(fx-1, ty+5, 3, 1, K); R(fx-2, ty+4, 1, 1, K); R(fx+2, ty+4, 1, 1, K); }
      else { R(fx-2, ty+3, 1, 2, K); R(fx+2, ty+3, 1, 2, K); R(fx-1, ty+5, 2, 1, K); }
    }
  }
  function bubble(cx, top, ch, c){ O(cx-4, top-12, 9, 9, c); R(cx-1, top-3, 3, 2, c); g.fillStyle = '#2B2D42'; g.font = 'bold 8px sans-serif'; g.textBaseline = 'top'; g.fillText(ch, cx-2, top-11); }
  function draw(){
    const cx = Math.round(T.cam.x), cy = Math.round(T.cam.y);
    R(0, 0, VW, VH, '#2B2D42');
    drawTiles(cx, cy);
    // 依 y 排序畫物件、人物、主角
    const list = entsNow().map(e => ({e, y:e.tiles[0][1]*TS + 16}));
    list.push({me:true, y:T.p.y + 8});
    list.sort((a,b) => a.y - b.y);
    list.forEach(it => {
      if (it.me){ drawPerson(T.p.x - cx, T.p.y + 8 - cy, LOOKS.me, T.p.dir, T.path.length ? Math.floor(T.p.anim/6) : 0); return; }
      const e = it.e;
      if (e.npc){
        const [x,y] = e.tiles[0], bx = x*TS + 8 - cx, by = y*TS + 16 - cy;
        drawPerson(bx, by, LOOKS[e.npc], 'down', 0, {expr:e.expr, pose:e.pose, shake:e.shake});
        if (e.main && !T.cs.fit) bubble(bx, by - 20, T.cs.named ? '!' : '?', '#E9C46A');
        if (e.id === 'mia' && (T.step === 'mia' || T.step === 'shelf')) bubble(bx, by - 20, '!', '#F2B5D4');
      } else drawEnt(e, cx, cy);
    });
    // 目標地點的小箭頭
    const goal = Game.goalTile();
    if (goal){ const gx = goal[0]*TS + 8 - cx, gy = goal[1]*TS - cy - 22 + Math.round(Math.sin(T.t*5)*2);
      if (gx > -8 && gx < VW+8 && gy > -16 && gy < VH) { O(gx-3, gy, 7, 4, '#E9C46A'); R(gx-1, gy+4, 3, 3, '#E9C46A'); R(gx-1, gy+5, 3, 2, '#2B2D42'); R(gx, gy+4, 1, 3, '#E9C46A'); } }
  }
  function tap(px, py){
    if (!T || T.busy) return;
    const wx = px + T.cam.x, wy = py + T.cam.y;
    let tx = Math.floor(wx/TS), ty = Math.floor(wy/TS);
    if (!entAt(tx, ty)){ // 點偏一點也算點到人或東西，角色小也點得到
      let best = null, bd = 14;
      entsNow().filter(usable).forEach(e => e.tiles.forEach(([x,y]) => { const d = Math.hypot(x*TS+8 - wx, y*TS+8 - wy); if (d < bd){ bd = d; best = [x,y]; } }));
      if (best){ tx = best[0]; ty = best[1]; }
    }
    goTo(tx, ty);
  }
  // 可以調查的東西：人、有說明文字的物件、公布欄、書架，以及這個委託的線索
  function usable(e){
    const c = T.step === 'case' ? CASES[T.ci] : null;
    return !!(e.npc || e.flavor || e.id === 'board' || (c && hasClue(c, e.id)));
  }
  function nearby(){
    if (!T || T.step === 'stage') return null;
    const [x,y] = tileOf(), c = T.step === 'case' ? CASES[T.ci] : null;
    const rank = e => e.main ? 0 : (c && hasClue(c, e.id)) ? 1 : e.npc ? 2 : 3;
    return entsNow().filter(e => usable(e) && e.tiles.some(([a,b]) => Math.abs(a-x) + Math.abs(b-y) <= 1))
      .sort((a,b) => rank(a) - rank(b))[0] || null;
  }
  function lookNearby(){ if (!T || T.busy || T.path.length) return false; const e = nearby(); if (!e) return false; face(e); act(e); return true; }

  return { reset, update, draw, tap, goTo, nearby, lookNearby, startCase, addClue, finishCase, rebuildBlock, entsNow,
    get T(){ return T; }, tileOf };
})();
