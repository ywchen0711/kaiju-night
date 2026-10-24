// Two languages: Traditional Chinese and English. Elements with data-i18n get their text from here; the code asks T(key).
const D = {
  zh: {
    pageTitle: '巨獸之夜 Kaiju Night',
    kicker: '緊急警報 · 港灣區全面撤離', title: '巨獸之夜', sub: 'KAIJU NIGHT',
    lede: '凌晨三點，暴雨。一隻第四級巨獸從海溝爬上港口。<br>城裡最後一台守望者 MK-IV 機甲，正走向海邊。',
    mWatch: '<b>觀戰</b><span>電腦對戰，像新聞直播一樣切換鏡頭</span>',
    mRobot: '<b>駕駛機甲</b><span>操控守望者 MK-IV，把巨獸打回海裡</span>',
    mKaiju: '<b>化身巨獸</b><span>操控深淵獸，摧毀這座城市</span>',
    mHuman: '<b>路人視角</b><span>你是街上的一個人，抬頭看著牠們開打——別被踩到</span>',
    home: '← 回到遊戲場', again: '再打一場', back: '回標題', nogl: '你的瀏覽器不支援 WebGL，無法顯示 3D 畫面。',
    robotName: '守望者 MK-IV', kaijuName: '深淵獸', quality: '畫質：', qLow: '流暢', qMid: '標準', qHigh: '電影', langBtn: 'EN',
    superOf: '· 絕招', missiles: '飛彈齊射', blade: '電漿劍 · 天降斬', beam: '原子熱線', quake: '震地踐踏',
    camNews: '● LIVE · CH7 新聞', camHeli1: '● LIVE · 新聞直升機 1', camHeli2: '● LIVE · 新聞直升機 2', camPhone: 'REC · 路人手機', camCctv: 'REC · 街口監視器',
    camCockpit: '守望者 MK-IV · 駕駛艙外部鏡頭', camHarbour: 'REC · 港口監視器 #04', camMine: 'REC · 你的手機',
    helpR: '<b>WASD</b> 移動 · <b>J</b> 刺拳 · <b>K</b> 重拳 · <b>L</b> 上勾拳 · <b>I</b> 踢擊 · <b>U</b> 肘擊 · <b>O</b> 鐵鎚 · <b>H</b> 三連擊 · <b>G</b> 火箭飛拳 · <b>Q</b> 電漿砲 · <b>C</b> 後撤 · <b>Shift</b> 衝刺 · <b>空白</b> 格擋 · 能量滿：<b>E</b> 飛彈齊射 · <b>F</b> 天降斬 · <b>Esc</b> 離開',
    helpK: '<b>WASD</b> 移動 · <b>J</b> 爪擊 · <b>K</b> 撕咬 · <b>L</b> 甩尾 · <b>I</b> 衝撞 · <b>U</b> 雙爪 · <b>O</b> 頭槌 · <b>H</b> 踏地 · <b>G</b> 飛撲 · <b>Q</b> 酸液吐息 · <b>R</b> 咆哮 · <b>C</b> 後跳 · 能量滿：<b>E</b> 原子熱線 · <b>F</b> 震地踐踏 · <b>Esc</b> 離開',
    helpH: '<b>WASD</b> 走 · <b>滑鼠</b> 看（點一下畫面鎖定游標） · <b>Shift</b> 跑 · <b>Esc</b> 離開 · 別被踩到、別站在大樓下',
    padR: { KeyJ: '刺拳', KeyK: '重拳', KeyL: '上勾', KeyI: '踢', KeyU: '肘擊', KeyO: '鐵鎚', KeyH: '連擊', KeyG: '飛拳', KeyQ: '電漿', KeyC: '後撤', ShiftLeft: '衝刺', Space: '格擋', KeyE: '飛彈', KeyF: '天降斬' },
    padK: { KeyJ: '爪擊', KeyK: '撕咬', KeyL: '甩尾', KeyI: '衝撞', KeyU: '雙爪', KeyO: '頭槌', KeyH: '踏地', KeyG: '飛撲', KeyQ: '酸液', KeyR: '咆哮', KeyC: '後跳', KeyE: '熱線', KeyF: '踐踏' },
    cdRocket: 'G 火箭飛拳', cdPounce: 'G 飛撲', cdPlasma: 'Q 電漿砲', cdDash: 'Shift 衝刺', cdMissiles: 'E 飛彈齊射', cdBlade: 'F 天降斬', cdAcid: 'Q 酸液', cdCharge: 'I 衝撞', cdRoar: 'R 咆哮', cdBeam: 'E 原子熱線', cdQuake: 'F 震地踐踏',
    win: '勝利', lose: '戰敗', cityHeld: '城市守住了', cityFell: '城市陷落',
    robotWonSub: '守望者 MK-IV 擊倒了深淵獸。雨還在下，火光照著廢墟。', kaijuWonSub: '深淵獸擊毀了守望者 MK-IV。牠的咆哮蓋過了警報聲。',
    stats: (clock, n) => `戰鬥時間 ${clock} · 倒塌建築 ${n} 棟`, survivedFor: (s) => `你撐了 ${s}`,
    survived: '你活下來了', dead_robot: '你被機甲踩扁了', dead_kaiju: '你被巨獸踩扁了', dead_beam: '你被熱線蒸發了', dead_blast: '你被爆炸吞沒了', dead_rubble: '你被大樓壓垮了',
    deadSub: '在這場戰鬥裡，沒有人看得見地上的你。',
  },
  en: {
    pageTitle: 'Kaiju Night',
    kicker: 'Emergency alert · Harbour district evacuation', title: 'KAIJU NIGHT', sub: '巨獸之夜',
    lede: '3 a.m., a storm. A Category IV kaiju has crawled out of the trench into the harbour.<br>The city\'s last jaeger, Sentinel MK-IV, is walking down to the shore.',
    mWatch: '<b>Watch</b><span>AI vs AI, cut like a live news broadcast</span>',
    mRobot: '<b>Pilot the jaeger</b><span>Drive Sentinel MK-IV and beat the kaiju back into the sea</span>',
    mKaiju: '<b>Be the kaiju</b><span>Play the Abyssal and tear the city apart</span>',
    mHuman: '<b>On foot</b><span>You are one person in the street, looking up as they fight. Don\'t get stepped on</span>',
    home: '← Back to the arcade', again: 'Fight again', back: 'Title', nogl: 'Your browser does not support WebGL, so the 3D scene cannot be shown.',
    robotName: 'SENTINEL MK-IV', kaijuName: 'ABYSSAL', quality: 'Quality: ', qLow: 'Smooth', qMid: 'Standard', qHigh: 'Cinema', langBtn: '中',
    superOf: '· SPECIAL', missiles: 'MISSILE BARRAGE', blade: 'PLASMA BLADE · SKYFALL', beam: 'ATOMIC BREATH', quake: 'QUAKE STOMP',
    camNews: '● LIVE · CH7 NEWS', camHeli1: '● LIVE · NEWS CHOPPER 1', camHeli2: '● LIVE · NEWS CHOPPER 2', camPhone: 'REC · BYSTANDER PHONE', camCctv: 'REC · STREET CCTV',
    camCockpit: 'SENTINEL MK-IV · HULL CAMERA', camHarbour: 'REC · HARBOUR CCTV #04', camMine: 'REC · YOUR PHONE',
    helpR: '<b>WASD</b> move · <b>J</b> jab · <b>K</b> cross · <b>L</b> uppercut · <b>I</b> kick · <b>U</b> elbow · <b>O</b> hammer · <b>H</b> combo · <b>G</b> rocket punch · <b>Q</b> plasma · <b>C</b> back off · <b>Shift</b> dash · <b>Space</b> block · full meter: <b>E</b> missiles · <b>F</b> blade · <b>Esc</b> quit',
    helpK: '<b>WASD</b> move · <b>J</b> claw · <b>K</b> bite · <b>L</b> tail · <b>I</b> charge · <b>U</b> rake · <b>O</b> headbutt · <b>H</b> stomp · <b>G</b> pounce · <b>Q</b> acid · <b>R</b> roar · <b>C</b> hop back · full meter: <b>E</b> atomic breath · <b>F</b> quake stomp · <b>Esc</b> quit',
    helpH: '<b>WASD</b> walk · <b>mouse</b> look (click to lock) · <b>Shift</b> run · <b>Esc</b> quit · don\'t get stepped on, don\'t stand under buildings',
    padR: { KeyJ: 'Jab', KeyK: 'Cross', KeyL: 'Upper', KeyI: 'Kick', KeyU: 'Elbow', KeyO: 'Hammer', KeyH: 'Combo', KeyG: 'Rocket', KeyQ: 'Plasma', KeyC: 'Back', ShiftLeft: 'Dash', Space: 'Block', KeyE: 'Missile', KeyF: 'Blade' },
    padK: { KeyJ: 'Claw', KeyK: 'Bite', KeyL: 'Tail', KeyI: 'Charge', KeyU: 'Rake', KeyO: 'Butt', KeyH: 'Stomp', KeyG: 'Pounce', KeyQ: 'Acid', KeyR: 'Roar', KeyC: 'Hop', KeyE: 'Beam', KeyF: 'Stomp' },
    cdRocket: 'G Rocket', cdPounce: 'G Pounce', cdPlasma: 'Q Plasma', cdDash: 'Shift Dash', cdMissiles: 'E Missiles', cdBlade: 'F Blade', cdAcid: 'Q Acid', cdCharge: 'I Charge', cdRoar: 'R Roar', cdBeam: 'E Breath', cdQuake: 'F Stomp',
    win: 'Victory', lose: 'Defeat', cityHeld: 'The city holds', cityFell: 'The city falls',
    robotWonSub: 'Sentinel MK-IV brought the Abyssal down. The rain keeps falling on the burning ruins.', kaijuWonSub: 'The Abyssal tore Sentinel MK-IV apart. Its roar drowns out the sirens.',
    stats: (clock, n) => `Fight time ${clock} · ${n} buildings down`, survivedFor: (s) => `You lasted ${s}`,
    survived: 'You survived', dead_robot: 'Crushed by the jaeger', dead_kaiju: 'Crushed by the kaiju', dead_beam: 'Vaporised by the beam', dead_blast: 'Caught in the blast', dead_rubble: 'Buried by a falling building',
    deadSub: 'In a fight like this, nobody sees you down on the street.',
  },
};
let lang = 'zh';
try { lang = localStorage.getItem('kaiju.lang') || (/^zh/i.test(navigator.language) ? 'zh' : 'en'); } catch { lang = /^zh/i.test(navigator.language || '') ? 'zh' : 'en'; }
const urlLang = typeof location !== 'undefined' && new URLSearchParams(location.search).get('lang'); if (D[urlLang]) lang = urlLang;
export const T = (k) => D[lang][k] ?? D.zh[k] ?? k;
export const getLang = () => lang;
export function applyDom() {
  if (typeof document === 'undefined' || !document.querySelectorAll) return;
  document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en'; document.title = T('pageTitle');
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.innerHTML = T(el.dataset.i18n); });
}
export function setLang(l) { lang = l; try { localStorage.setItem('kaiju.lang', l); } catch {} applyDom(); }
