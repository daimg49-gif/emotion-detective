# 情緒偵探社

莒光國小資優班的「認識情緒」像素風遊戲，給三到六年級學生用平板玩，一輪約 20 分鐘。

- 線上遊玩（開啟 GitHub Pages 後）：https://daimg49-gif.github.io/emotion-detective/
- 設計綱要與文字腳本：協作中心 [game-dev-lab](https://github.com/daimg49-gif/game-dev-lab) 的 `docs/specs/`
- 目前版本：第三章「生氣」v4（只說「生氣」不能結案；說出情緒要挑證據）

## 檔案

| 路徑 | 內容 |
|---|---|
| `index.html` | 目前上線的遊戲（與最新版號檔案相同） |
| `情緒偵探社_v4.html` | 第三章 v4；v2、v3 保留可退回 |
| `src/parts/head.html` | 頁面外殼與樣式 |
| `src/parts/content.js` | **內容表**：角色、序章、3 個委託的線索與選項、圖鑑、評語、地圖配置。改文字只改這裡 |
| `src/parts/town.js` | 校園地圖：點地圖移動、調查、委託流程 |
| `src/parts/game.js` | 主控：對話、面板、闖關切換、結算 |
| `src/stage.html` | 闖關引擎（也可單獨打開試玩） |
| `tools/build_game.py` | 組出完整遊戲：`python3 tools/build_game.py 情緒偵探社_vN.html` |
| `tools/build.py` | 組出單獨的闖關試玩版 |
| `prototype/` | 闖關原型 v1～v3 |
| `assets/raw/` | ChatGPT 生的原始圖；`assets/game/` 是裁切縮小後給遊戲用的圖 |
| `tests/` | 自動測試 |

## 回歸測試清單

整章（`tests/test_game.js`，iPad 兩種尺寸、手機橫直、筆電，A/B 版本都跑）：

1. 序章：拿圖鑑 → 跟米亞說話 → 學會深呼吸
2. 每個委託：沒線索時不能判斷情緒；找到 3 種以上線索
3. 說錯情緒會回到調查，不會卡住；只說「生氣」這類大方向的詞不能結案
3-1. 說對情緒後要挑證據：挑錯會重挑，線索本裡一定找得到可用的證據
4. 說對情緒後能選陪伴方法，結案學會對應技能（暫停、換個角度、說出來）
5. 三個委託後要回社辦，走到走廊左邊觸發闖關
6. 闖關能通過，出現結案報告、圖鑑卡片、評語、研究出處
7. 「再玩一次」回到開始畫面；全程沒有 JS 錯誤
8. 走到人旁邊「調查」按鈕會亮並顯示名字，按下去能開始調查；遠離時變暗
9. 委託內容的對話沒有括號補充文字

版面（`tests/test_layout.js`，9 種螢幕：電腦 1920、筆電 1366、iPad 橫直、手機橫直、小手機）：

1. 按鈕都在螢幕內、至少 44 像素
2. 上方資訊列和操作按鈕不蓋住遊戲畫面
3. 對話框完整顯示；對話時主角不會被對話框擋住
4. 闖關畫面寬度至少 320 像素；結算按鈕捲得到

闖關（`tests/test_stage.js`、`tests/test_bypass.js`）：

1. 三種尺寸都能通關；按鈕至少 56 像素見方
2. 硬撞生氣怪會被彈開；沒冷靜前過不去
3. 挫折怪的牆跳不過去，只有「換個角度」能變成橋
4. 暗區沒「說出來」會掉下去
5. 用錯技能有提示；情緒條滿了回到旗子
6. 站著不動不會抖

執行：

```bash
NODE_PATH=$(npm root -g) node tests/test_game.js "$PWD/情緒偵探社_v4.html" /tmp
NODE_PATH=$(npm root -g) node tests/test_layout.js "$PWD/情緒偵探社_v4.html" /tmp
NODE_PATH=$(npm root -g) node tests/test_stage.js "$PWD/prototype/stage_v3.html" /tmp
```

所有角色、情境都是虛構的，遊戲不記錄任何學生資料。
