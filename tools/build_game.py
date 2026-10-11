"""組出完整遊戲：python3 tools/build_game.py 情緒偵探社_v7.html
頁面外殼 src/parts/head.html
闖關引擎 src/parts/stage.js（讀 STAGE、LEVEL，換章時由 loadChapter 指定）
共用內容 src/parts/content.js
各章內容 src/parts/ch1.js～ch5.js（新章節加在 CHAPTER_FILES）
校園地圖 src/parts/town.js
主控     src/parts/game.js
圖片     assets/game/（內嵌成 data URI，鍵名對應 STAGE.types[].img 與 STAGE.bg）"""
import base64, json, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
CHAPTER_FILES = ['ch1.js', 'ch2.js', 'ch3.js', 'ch4.js', 'ch5.js']
IMAGES = {
    'title': 'title.jpg',
    # 第三章
    'bg3': 'stage-bg.png', 'angry-normal': 'angry-normal.png', 'angry-puff': 'angry-puff.png', 'angry-calm': 'angry-calm.png',
    'frus-knot': 'frus-knot.png', 'frus-loose': 'frus-loose.png',
    # 第一章
    'bg1': 'ch1/stage-bg.png',
    'excited-normal': 'ch1/excited-normal.png', 'excited-puff': 'ch1/excited-puff.png', 'excited-calm': 'ch1/excited-calm.png',
    'proud-normal': 'ch1/proud-normal.png', 'proud-puff': 'ch1/proud-puff.png', 'proud-calm': 'ch1/proud-calm.png',
    # 第四章
    'bg4': 'ch4/stage-bg.png',
    'anxious-normal': 'ch4/anxious-normal.png', 'anxious-puff': 'ch4/anxious-puff.png', 'anxious-calm': 'ch4/anxious-calm.png',
    'nervous-normal': 'ch4/nervous-normal.png', 'nervous-puff': 'ch4/nervous-puff.png', 'nervous-calm': 'ch4/nervous-calm.png',
}
# 第二、五章用同樣的命名：chN/怪物-狀態.png
for ch, mons in {'ch2': ['wronged', 'lonely'], 'ch5': ['impatient', 'jealous', 'awkward']}.items():
    IMAGES['bg' + ch[-1]] = f'{ch}/stage-bg.png'
    for m in mons:
        for st in ['normal', 'puff', 'calm']: IMAGES[f'{m}-{st}'] = f'{ch}/{m}-{st}.png'
def uri(f, key=''):
    if key.startswith('bg'): # 背景沒有透明，轉成 JPEG 內嵌，檔案小很多
        from PIL import Image; import io
        buf = io.BytesIO(); Image.open(root/'assets/game'/f).convert('RGB').save(buf, 'JPEG', quality=88)
        return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()
    kind = 'jpeg' if f.endswith('.jpg') else 'png'
    return f'data:image/{kind};base64,' + base64.b64encode((root/'assets/game'/f).read_bytes()).decode()
part = lambda name: (root/'src/parts'/name).read_text(encoding='utf-8')
stage = part('stage.js')
assert '/*@ASSETS@*/' in stage
stage = stage.replace('/*@ASSETS@*/', 'const IMG_SRC = ' + json.dumps({k: uri(f, k) for k, f in IMAGES.items()}) + ';')
parts = [part('head.html'), "<script>\n(() => {\n'use strict';\n", stage, part('content.js')] + \
        [part(f) for f in CHAPTER_FILES] + [part('town.js'), part('game.js'), "})();\n</script>\n</body>\n</html>\n"]
out = '\n'.join(parts)
dst = root/sys.argv[1]; dst.write_text(out, encoding='utf-8'); print(dst, round(len(out)/1024), 'KB')
