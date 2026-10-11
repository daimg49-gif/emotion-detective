"""把 src/stage.html 和 assets/game/ 的圖組成單一 HTML。
用法：python3 tools/build.py prototype/stage_v2.html"""
import base64, json, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
MAP = {'bg':'stage-bg.png', 'title':'title.jpg', 'normal':'angry-normal.png', 'puff':'angry-puff.png',
       'calm':'angry-calm.png', 'knot':'frus-knot.png', 'loose':'frus-loose.png'}
src = (root/'src/stage.html').read_text(encoding='utf-8')
imgs = {}
for k, f in MAP.items():
    b = (root/'assets/game'/f).read_bytes()
    mime = 'image/jpeg' if f.endswith('.jpg') else 'image/png'
    imgs[k] = f'data:{mime};base64,' + base64.b64encode(b).decode()
assert '/*@ASSETS@*/' in src
out = src.replace('/*@ASSETS@*/', 'const IMG_SRC = ' + json.dumps(imgs) + ';')
dst = root/sys.argv[1]; dst.write_text(out, encoding='utf-8')
print(dst, round(len(out)/1024), 'KB')
