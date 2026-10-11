"""組出完整遊戲：python3 tools/build_game.py 情緒偵探社_v1.html
頁面外殼 src/parts/head.html
闖關引擎 src/stage.html（取「① 內容表」到 draw() 結束）
內容表   src/parts/content.js
校園地圖 src/parts/town.js
主控     src/parts/game.js
圖片     assets/game/（內嵌成 data URI）"""
import base64, json, sys, pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
st = (root/'src/stage.html').read_text(encoding='utf-8')
a = st.index('/* =========================================================\n   ① 內容表')
b = st.index('/* =========================================================\n   入口')
stage = st[a:b]
old_win = stage[stage.index('function win(){'):stage.index('/* =========================================================\n   ③ 畫面')]
stage = stage.replace(old_win, "function win(){ S.won = true; setTimeout(() => Game.stageWon(S.stats), 700); }\n\n")
lock = "  if (!S.running || S.paused || S.won || S.cd[k] > 0) return false;\n"
assert lock in stage
stage = stage.replace(lock, lock + "  if (!Game.skills.has(k)){ toast('這招還沒學會。', 1400); return false; }\n")
stage = stage.replace('   ① 內容表：關卡、怪物、提示句（換關卡只改這裡）', '   闖關引擎：關卡、怪物、提示句（換關卡只改 LEVEL、HINT、WRONG）')
MAP = {'bg':'stage-bg.png', 'title':'title.jpg', 'normal':'angry-normal.png', 'puff':'angry-puff.png',
       'calm':'angry-calm.png', 'knot':'frus-knot.png', 'loose':'frus-loose.png'}
imgs = {k: ('data:image/jpeg;base64,' if f.endswith('.jpg') else 'data:image/png;base64,') + base64.b64encode((root/'assets/game'/f).read_bytes()).decode() for k, f in MAP.items()}
stage = stage.replace('/*@ASSETS@*/', 'const IMG_SRC = ' + json.dumps(imgs) + ';')
parts = [(root/'src/parts/head.html').read_text(encoding='utf-8'), "<script>\n(() => {\n'use strict';\n", stage,
         (root/'src/parts/content.js').read_text(encoding='utf-8'), (root/'src/parts/town.js').read_text(encoding='utf-8'),
         (root/'src/parts/game.js').read_text(encoding='utf-8'), "})();\n</script>\n</body>\n</html>\n"]
out = '\n'.join(parts)
dst = root/sys.argv[1]; dst.write_text(out, encoding='utf-8'); print(dst, round(len(out)/1024), 'KB')
