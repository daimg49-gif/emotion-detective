/* =========================================================
   ① 內容表・共用：人物外觀、名字、情緒卡、地圖骨架
   每一章的委託、闖關放在 src/parts/chN.js，用 CH_DATA[N] 登記
   ========================================================= */
const CH_DATA = {};
const LOOKS = {
  me:   {hair:'#3b2a20', style:'cap', top:'#2A9D8F', cap:'#7a4a2a'},
  mia:  {hair:'#2a1d18', style:'pony', top:'#c98b4f', glasses:true},
  // 第三章
  bear: {hair:'#1d1d22', style:'buzz', top:'#EF233C', big:true},
  xiang:{hair:'#2a2420', style:'cap', top:'#2A9D8F', cap:'#2B2D42'},
  le:   {hair:'#5a3a22', style:'curly', top:'#E9C46A'},
  mate: {hair:'#222', style:'bob', top:'#8ecae6'},
  kui:  {hair:'#2a211c', style:'braids', top:'#3f8f5a'},
  kai:  {hair:'#222', style:'cap', top:'#8D99AE', cap:'#EF233C'},
  jie:  {hair:'#3a2a22', style:'short', top:'#f2f2ee', stripe:'#5a6b8a'},
  // 第四章
  star: {hair:'#1d1d22', style:'short', top:'#3a7bd5'},
  lin:  {hair:'#2a1d18', style:'long', top:'#7B6D8D', big:true},
  dou:  {hair:'#3b2a20', style:'cap', top:'#8ecae6', cap:'#E9C46A'},
  nurse:{hair:'#222', style:'bob', top:'#f2f2ee', big:true},
  rain: {hair:'#2a211c', style:'pony', top:'#8D99AE'},
  zhe:  {hair:'#222', style:'short', top:'#3f8f5a', glasses:true},
  // 第一章
  shu:  {hair:'#2a2420', style:'buzz', top:'#F4A261'},
  aka:  {hair:'#5a3a22', style:'curly', top:'#8D99AE'},
  mi:   {hair:'#1d1d22', style:'bob', top:'#F2B5D4'},
  chun: {hair:'#e8e8e8', style:'cap', top:'#3a7bd5', cap:'#3d4a6b', big:true},
  qing: {hair:'#2a1d18', style:'pony', top:'#f2f2ee'},
  wang: {hair:'#222', style:'short', top:'#3f8f5a', big:true},
};
const NAMES = {mia:'米亞', radio:'📻 米亞', me:'我',
  bear:'大熊', xiang:'小翔', le:'阿樂', mate:'隔壁同學', kui:'小葵', kai:'阿凱', jie:'阿傑',
  star:'小星', lin:'林老師', dou:'豆豆', nurse:'護理師阿姨', rain:'小雨', zhe:'阿哲',
  shu:'小樹', aka:'阿卡', mi:'小米', chun:'春伯', qing:'晴晴', wang:'王老師'};
const TYPE_NAME = {face:'表情', body:'身體', talk:'話語', scene:'情境'};
const BASE_WORDS = ['開心','難過','生氣','害怕','討厭'];
const FIT = {great:'很適合', ok:'還可以', bad:'不適合'};

/* 章節卡：不寫情緒名稱，用一件事來暗示 */
const CHAPTERS = [
  {n:1, icon:'🎈', event:'園遊會的氣球', teaser:'三個人都在笑，可是笑的原因不一樣。'},
  {n:2, icon:'☔', event:'下雨的操場', teaser:'雨停了，有人還站在原地。'},
  {n:3, icon:'📓', event:'掉進水桶的筆記', teaser:'紙塔倒了三次，有人被喊了綽號。'},
  {n:4, icon:'🌫️', event:'起霧的舊走廊', teaser:'有人說肚子痛，有人一直沒進教室。'},
  {n:5, icon:'🔦', event:'聚光燈下的舞台', teaser:'燈一亮，大家都在看。'},
];

/* 情緒卡：所有章節共用；ch 是這張卡屬於哪一章 */
const CARDS = {
  '興奮':{ch:1, body:'停不下來、說話變快變大聲', cause:'期待的事要發生了'},
  '得意':{ch:1, body:'下巴抬高、想一直講', cause:'覺得自己比別人厲害'},
  '自豪':{ch:1, body:'臉熱熱的、想分享過程', cause:'努力很久終於做到'},
  '感激':{ch:1, body:'心裡暖暖的、眼眶可能會紅', cause:'別人幫了你'},
  '放心':{ch:1, body:'吐一口氣、肩膀放鬆', cause:'擔心的事解決了'},
  '失望':{ch:2, body:'嘆氣、肩膀垂下來', cause:'期待的事沒發生'},
  '寂寞':{ch:2, body:'發呆、吃不下', cause:'想要有人陪，身邊卻沒有'},
  '委屈':{ch:2, body:'眼眶紅、想說又說不出口', cause:'被誤會、被不公平對待'},
  '捨不得':{ch:2, body:'一直看著、不想放手', cause:'喜歡的人或東西要離開'},
  '生氣':{ch:3, body:'臉熱、握拳、咬牙', cause:'想要的被擋住'},
  '不公平':{ch:3, body:'很想爭辯、一直重講同一件事', cause:'覺得規則對自己不一樣'},
  '挫折':{ch:3, body:'想放棄、想把東西丟掉', cause:'努力很多次還是失敗'},
  '被冒犯':{ch:3, body:'想衝過去、聲音變大', cause:'被取笑、被不尊重'},
  '丟臉':{ch:3, body:'耳朵和臉紅、想躲起來', cause:'不想被別人看到自己的樣子'},
  '害怕':{ch:4, body:'想躲、想逃、身體縮起來', cause:'覺得有危險'},
  '緊張':{ch:4, body:'心跳快、手抖、想跑廁所', cause:'某件事就快發生了'},
  '擔心':{ch:4, body:'一直想同一件事、皺眉', cause:'想到以後可能發生的壞事'},
  '焦慮':{ch:4, body:'肚子痛、頭痛、睡不好', cause:'說不太出在怕什麼，但一直不安'},
  '噁心':{ch:5, body:'皺鼻子、摀嘴、往後退', cause:'看到、聞到、吃到不乾淨的東西'},
  '不耐煩':{ch:5, body:'腳點地、敲東西、翻白眼', cause:'等太久、被一直打擾'},
  '嫉妒':{ch:5, body:'一直盯著看、咬嘴唇', cause:'別人有你想要的東西或關係'},
  '尷尬':{ch:5, body:'臉紅、傻笑、抓頭', cause:'出了小狀況，覺得大家都在看'},
};

/* 每章都一樣的教學段落 */
const TUTORIAL_COMMON = {
  tap:['sys','點地圖，角色會自己走過去。走到人或東西旁邊，按下方的「調查」；直接點他們也可以。先去左上角的書架。'],
  shelf:[['sys','你在書架上找到一本《情緒圖鑑》，裡面還有很多空白頁。'],['sys','左下角的「線索」和右下角的「圖鑑」隨時可以點開看。']],
  mia:[
    ['mia','線索有四種：看表情、看身體、聽他說的話、看周圍發生什麼事。'],
    ['mia','至少找到兩種線索，才能判斷是什麼情緒。找越多，判斷越準。'],
    ['mia','送你第一招。不管遇到什麼事，先吸氣數到四，再慢慢吐氣。'],
    ['sys','學會技能：深呼吸'],
    ['mia','今天有三個委託，都貼在走廊的公布欄。想先做哪件都可以，做完一件就能決定要不要收工。'],
  ],
};

const VERDICT = {
  clue4:'你把四種線索都找齊了，連周圍的小細節都沒漏掉。',
  clue3:'你很會觀察，下次可以多看看周圍發生了什麼事。',
  clue2:'你找到線索就急著判斷。多看一眼，常常會發現不一樣的答案。',
  nameBest: base => `你說得出很細的情緒，也找得到證據，不只是「${base}」兩個字。`,
  nameOk: base => `你試了幾次才找到最準的詞和證據。「${base}」底下，常常還藏著別的感覺。`,
  fitHigh:'你看得出對方現在需要什麼，不是每次都用同一招。',
  fitLow:'同一個方法，有時有用、有時沒用。差別在對方當下有多激動。',
  last:'今天的三個委託人，下次可能換你需要人陪。到時候，你知道要找誰。',
};

/* 地圖骨架：40×26 格，每格 16 像素。各章再加自己的房間、物件 */
const MAP_BASE = { w:40, h:26, start:[4,4],
  rooms:[ // [x, y, 寬, 高, 地板]
    [1,1,9,6,'wood'], [27,1,12,6,'class'], [1,8,38,3,'hall'], [1,12,38,13,'grass'], [4,15,14,7,'court'] ],
  doors:[[5,7,'wood'], [32,7,'class'], [10,11,'hall'], [11,11,'hall'], [28,11,'hall'], [29,11,'hall']],
  zones:[ {name:'偵探社社辦', x:1,y:1,w:9,h:6}, {name:'走廊', x:1,y:8,w:38,h:3}, {name:'操場', x:1,y:12,w:38,h:13} ],
  ents:[
    {id:'shelf', name:'書架', tiles:[[2,1],[3,1]], draw:'shelf', flavor:'書架上都是偵探社的舊檔案。'},
    {id:'mdesk', name:'社長的桌子', tiles:[[6,4]], draw:'desk', flavor:'社長的桌子，上面有一盞小檯燈。'},
    {id:'mia', npc:'mia', tiles:[[7,2]], expr:'happy'},
    {id:'board', name:'公布欄', tiles:[[11,8]], draw:'board'},
    {id:'tree1', tiles:[[31,16]], draw:'tree'}, {id:'tree2', tiles:[[35,20]], draw:'tree'}, {id:'tree3', tiles:[[24,22]], draw:'tree'}, {id:'tree4', tiles:[[2,23]], draw:'tree'},
  ],
};
const CLASS_DESKS = [{id:'desk1', tiles:[[29,3]], draw:'sdesk'}, {id:'desk2', tiles:[[31,3]], draw:'sdesk'}, {id:'desk3', tiles:[[34,3]], draw:'sdesk'},
  {id:'desk4', tiles:[[29,5]], draw:'sdesk'}, {id:'desk5', tiles:[[33,5]], draw:'sdesk'}];

/* 目前這一章的資料：loadChapter(n) 換章時重新指定 */
let CH = null, CASES = [], TUTORIAL = null, CARD_ORDER = [], FINE_WORDS = [], CITE = '', MAP = null;
function loadChapter(n){
  CH = CH_DATA[n];
  CASES = CH.cases; CARD_ORDER = CH.cardOrder; FINE_WORDS = CH.fine; CITE = CH.cite;
  TUTORIAL = { opening: CH.opening.concat([TUTORIAL_COMMON.tap]), shelf: TUTORIAL_COMMON.shelf, mia: TUTORIAL_COMMON.mia, bump: CH.bump };
  MAP = { w:MAP_BASE.w, h:MAP_BASE.h, start:MAP_BASE.start,
    rooms: MAP_BASE.rooms.concat(CH.map.rooms || []), doors: MAP_BASE.doors.concat(CH.map.doors || []),
    zones: CH.map.zones.concat(MAP_BASE.zones), ents: MAP_BASE.ents.concat(CH.map.ents) };
  STAGE = CH.stage; LEVEL = CH.stage.level;
}
/* 暗區、坑這類「範圍＋設定」的寫法：zone(46, 62, {by:'say'}) */
const zone = (a, b, o) => Object.assign([a, b], o);
