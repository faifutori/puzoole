/* ============================================================
 * PUZOOLE — アプリ本体
 *
 * データの追加・修正は js/data.js だけで完結します。
 * このファイルは基本的にさわらなくて大丈夫です。
 * ============================================================ */
(function(){
"use strict";

var DATA  = window.PUZOOLE_DATA;
var ZONES = DATA.zones;
var KEY   = 'puzoole_v2';

/* ============================================================
 * 記号（絵文字は使わず、すべて線で描いています）
 * ============================================================ */
var MARK_PAW =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">' +
  '<ellipse cx="12" cy="15.6" rx="5.2" ry="4.4"/>' +
  '<ellipse cx="5.6" cy="10.2" rx="2.1" ry="2.8"/>' +
  '<ellipse cx="10" cy="7.2" rx="2.1" ry="3"/>' +
  '<ellipse cx="14.6" cy="7.2" rx="2.1" ry="3"/>' +
  '<ellipse cx="18.6" cy="10.4" rx="2.1" ry="2.8"/></svg>';

var MARK_CLOSE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
  'stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

var MARK_TALK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">' +
  '<path d="M20 4H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3v4l5-4h8a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/></svg>';

/* ============================================================
 * ふりがな
 *   {漢字|かんじ} を <ruby>漢字<rt>かんじ</rt></ruby> に変換する
 * ============================================================ */
function escapeHtml(s){
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function ruby(text){
  return escapeHtml(text).replace(
    /\{([^{}|]+)\|([^{}|]+)\}/g,
    '<ruby>$1<rt>$2</rt></ruby>'
  );
}
/* alt属性など、タグを置けない場所むけ */
function plain(text){
  return String(text).replace(/\{([^{}|]+)\|([^{}|]+)\}/g, '$1');
}
function setRuby(node, text){
  /* flex コンテナ（.btn や .choice）の直下に ruby が来ると、Safari が
     ruby を独立した flex アイテムとして扱い、縦位置がずれることがあります。
     必ず span 1つでくるんで「子はひとつだけ」にしておきます。 */
  node.innerHTML = '<span class="rb">' + ruby(text) + '</span>';
  return node;
}

/* ============================================================
 * 画像の置き場所（命名規則はここに集約）
 * ============================================================ */
var PATH = {
  /* スタンプ絵はゾーンごとに1枚。どうぶつごとではありません */
  stamp:  function(zoneId){ return 'img/stamp/stamp_' + zoneId + '.png'; },
  animal: function(id){ return 'img/animal/animal_' + id + '.jpg'; },
  quiz:   function(id, n){ return 'img/quiz/quiz_' + id + '_q' + n + '.jpg'; },
  prize:  function(id){ return 'img/prize/prize_' + id + '.png'; },
  wall:   function(id, os){ return 'phone/' + os + '/wall_' + os + '_' + id + '.png'; }
};

/* ============================================================
 * 小道具
 * ============================================================ */
function el(tag, cls, html){
  var n = document.createElement(tag);
  if(cls) n.className = cls;
  if(html != null) n.innerHTML = html;
  return n;
}
function $(id){ return document.getElementById(id); }

/* 画像を読みこみ、失敗したら代替表示に差しかえる */
function imgOrFallback(src, altText, buildFallback){
  var img = document.createElement('img');
  img.alt = altText;
  img.draggable = false;
  img.addEventListener('error', function(){
    if(img.parentNode) img.parentNode.replaceChild(buildFallback(), img);
  });
  img.src = src;
  return img;
}
/* 名前を朱書きした代替表示（スタンプ用）。ゾーン名でも動物名でも使えます */
function stampAlt(label){
  var box = el('div','stamp-alt');
  box.appendChild(el('div','mark', MARK_PAW));
  box.appendChild(setRuby(el('div','nm'), label));
  return box;
}
/* 図鑑サムネ用の代替表示 */
function zukanAlt(animal){
  var box = el('div','zukan-alt');
  box.appendChild(el('div','mark', MARK_PAW));
  box.appendChild(setRuby(el('div','nm'), animal.name));
  return box;
}
function missingNote(path){
  return el('div','asset-missing',
    'ここに <code>' + escapeHtml(path) + '</code> を' + ruby('{置|お}くと{表示|ひょうじ}されます'));
}

function shuffle(arr){
  var a = arr.slice();
  for(var i=a.length-1;i>0;i--){
    var j = Math.floor(Math.random()*(i+1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function pickRandom(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

function findZone(zoneId){
  for(var i=0;i<ZONES.length;i++){ if(ZONES[i].id === zoneId) return ZONES[i]; }
  return null;
}
function findAnimal(animalId){
  for(var i=0;i<ZONES.length;i++){
    var list = ZONES[i].animals;
    for(var j=0;j<list.length;j++){ if(list[j].id === animalId) return list[j]; }
  }
  return null;
}
function zoneOfAnimal(animalId){
  for(var i=0;i<ZONES.length;i++){
    var list = ZONES[i].animals;
    for(var j=0;j<list.length;j++){ if(list[j].id === animalId) return ZONES[i]; }
  }
  return null;
}

/* ============================================================
 * 状態の保存
 *   zukan:   これまでに出会ったどうぶつidの配列。
 *            ★リセットしても消えません（図鑑は残す）
 *   cleared: クイズに全問正解したどうぶつidの配列。これも消えません
 *   stamps:  いまの台紙 { ゾーンid: どうぶつid }
 *            リセットで消えます。ただしゾーンの全種類を集めたゾーンは
 *            もう引ける相手がいないので、押したまま固定します
 *   wall:    壁紙にえらばれているどうぶつid / os: 'iphone' | 'android'
 * ============================================================ */
var state = { zukan:[], stamps:{}, cleared:[], wall:null, os:'iphone', intro:false };

function loadState(){
  try{
    var raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    if(raw && typeof raw === 'object'){
      var stamps = {};
      Object.keys(raw.stamps || {}).forEach(function(z){
        /* データから消えたゾーン・どうぶつは読みすてる */
        if(findZone(z) && findAnimal(raw.stamps[z])) stamps[z] = raw.stamps[z];
      });
      state.stamps  = stamps;
      state.cleared = (raw.cleared || []).filter(findAnimal);

      /* zukan が無い＝以前のバージョンの保存データ。
         そのときは台紙にあるぶんを図鑑の初期値として引きつぐ */
      state.zukan = (raw.zukan || Object.keys(stamps).map(function(z){ return stamps[z]; }))
                      .filter(findAnimal);
      /* 台紙にあるのに図鑑に無い、という食いちがいは起きないようにそろえる */
      Object.keys(stamps).forEach(function(z){
        if(state.zukan.indexOf(stamps[z]) === -1) state.zukan.push(stamps[z]);
      });
      state.wall    = findAnimal(raw.wall) ? raw.wall : null;
      state.os      = raw.os === 'android' ? 'android' : 'iphone';
      state.intro   = !!raw.intro;
    }
  }catch(e){ /* 壊れていたら初期状態のまま進める */ }
}
function saveState(){
  try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){}
}
/* いま台紙に押してあるどうぶつ */
function collectedIds(){
  return ZONES.map(function(z){ return state.stamps[z.id]; })
              .filter(function(v){ return !!v; });
}
/* 図鑑に入っているどうぶつ（データの並び順にそろえて返す） */
function zukanIds(){
  var out = [];
  ZONES.forEach(function(z){
    z.animals.forEach(function(an){
      if(state.zukan.indexOf(an.id) !== -1) out.push(an.id);
    });
  });
  return out;
}
function zukanTotal(){
  var n = 0;
  ZONES.forEach(function(z){ n += z.animals.length; });
  return n;
}
/* そのゾーンで、まだ図鑑に入っていないどうぶつ */
function zoneRemaining(zone){
  return zone.animals.filter(function(an){ return state.zukan.indexOf(an.id) === -1; });
}
/* ゾーンの全種類を集めきったか。集めきると台紙のマスが固定される */
function isZoneComplete(zone){ return zoneRemaining(zone).length === 0; }

function isComplete(){ return collectedIds().length === ZONES.length; }
function isCleared(animalId){ return state.cleared.indexOf(animalId) !== -1; }

/* ============================================================
 * トースト
 * ============================================================ */
function toast(msg){
  var box = $('toasts');
  var t = el('div','toast');
  t.textContent = plain(msg);
  box.appendChild(t);
  setTimeout(function(){ t.remove(); }, 2900);
}

/* ============================================================
 * 描画：進捗
 * ============================================================ */
function renderProgress(){
  var got = collectedIds().length;
  var track = $('progressTrack');
  track.innerHTML = '';
  for(var i=0;i<ZONES.length;i++){
    track.appendChild(el('span','pip' + (i < got ? ' on' : '')));
  }
  setRuby($('progressText'), got + ' / ' + ZONES.length + ' {個|こ}');
}

/* いま押したばかりのゾーンid。押印アニメをこのマスだけで流すため */
var justPressed = null;

/* ============================================================
 * 描画：スタンプ台紙
 * ============================================================ */
function renderSheet(){
  var grid = $('stampGrid');
  grid.innerHTML = '';

  ZONES.forEach(function(zone){
    var animalId = state.stamps[zone.id];
    var animal   = animalId ? findAnimal(animalId) : null;

    var done = isZoneComplete(zone);
    var slot = el('div','stamp-slot' + (animal ? ' got' : '') + (done ? ' complete' : '') +
                       (zone.id === justPressed ? ' press' : ''));
    slot.style.setProperty('--zone-color', zone.color);
    /* 小さい文字用の濃い色。CSS 側で --zt-{ゾーンid} として定義しています */
    slot.style.setProperty('--zone-text', 'var(--zt-' + zone.id + ')');

    var ring = el('div','stamp-ring');
    if(animal){
      ring.appendChild(imgOrFallback(
        PATH.stamp(zone.id), plain(zone.name) + 'のスタンプ',
        function(){ return stampAlt(zone.name); }
      ));
    }else{
      ring.appendChild(el('div','stamp-empty', MARK_PAW));
    }
    slot.appendChild(ring);

    slot.appendChild(setRuby(el('span','stamp-label'), zone.name));
    if(animal) slot.appendChild(setRuby(el('span','stamp-name'), animal.name));
    if(done) slot.appendChild(setRuby(el('span','stamp-done'),
      'ぜんぶ{集|あつ}めた'));

    grid.appendChild(slot);
  });
  justPressed = null;   /* 一度流したら消す */
}

/* ============================================================
 * 描画：どうぶつ図鑑
 *   QRで会えたどうぶつだけを並べます。
 *   クイズをクリアするまでは白黒、全問正解すると色がつきます。
 * ============================================================ */
function renderZukan(){
  var grid = $('zukanGrid');
  var ids  = zukanIds();          /* 台紙ではなく図鑑。リセットしても残る */
  grid.innerHTML = '';

  setRuby($('zukanCount'),
    '{図鑑|ずかん} ' + ids.length + ' / ' + zukanTotal() + ' {種類|しゅるい}');

  if(!ids.length){
    var empty = el('div','zukan-empty');
    empty.innerHTML =
      ruby('まだ どうぶつに{会|あ}っていません。') + '<br>' +
      ruby('ゾーンの{看板|かんばん}にあるQRコードを{読|よ}みとってみてください。');
    grid.appendChild(empty);
    return;
  }

  ids.forEach(function(animalId){
    var animal  = findAnimal(animalId);
    var zone    = zoneOfAnimal(animalId);
    var cleared = isCleared(animalId);

    var card = el('div','zukan-card' + (cleared ? ' cleared' : ''));
    card.style.setProperty('--zone-color', zone.color);
    card.style.setProperty('--zone-text', 'var(--zt-' + zone.id + ')');

    var hit = el('button','zukan-hit');
    hit.type = 'button';
    hit.setAttribute('aria-label', plain(animal.name) + 'のクイズをひらく');

    var thumb = el('div','zukan-thumb');
    thumb.appendChild(imgOrFallback(
      PATH.animal(animal.id), plain(animal.name),
      function(){ return zukanAlt(animal); }
    ));
    hit.appendChild(thumb);

    hit.appendChild(setRuby(el('span','zukan-name'), animal.name));
    hit.appendChild(setRuby(el('span','zukan-zone'), zone.name));
    hit.appendChild(el('span','zukan-state',
      escapeHtml(cleared ? 'クリア' : 'クイズにちょうせん')));

    hit.addEventListener('click', function(){ openAnimal(animal.id); });

    card.appendChild(hit);
    grid.appendChild(card);
  });
}

/* ============================================================
 * 描画：ごほうび（6つそろったとき）
 * ============================================================ */
function renderReward(){
  var box = $('reward');
  box.innerHTML = '';

  if(!isComplete()){
    var left = ZONES.length - collectedIds().length;
    box.appendChild(setRuby(el('h2','reward-title'), 'あと ' + left + ' {個|こ}'));
    box.appendChild(setRuby(el('p','reward-lead'),
      'スタンプが{全部|ぜんぶ}そろうと、{動画|どうが}とスマホの{壁紙|かべがみ}がもらえます。'));
    return;
  }

  box.appendChild(setRuby(el('h2','reward-title'), 'スタンプ{全部|ぜんぶ}あつまりました'));
  box.appendChild(setRuby(el('p','reward-lead'),
    '{記念|きねん}の{動画|どうが}と、スマホの{壁紙|かべがみ}をどうぞ。'));

  /* --- 動画 --- */
  var vBlock = el('div','reward-block');
  vBlock.appendChild(setRuby(el('h3'), '{記念|きねん}の{動画|どうが}'));
  var vFrame = el('div','video-frame');
  var video = document.createElement('video');
  video.controls = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.poster = DATA.video.poster;
  video.src = DATA.video.src;
  video.addEventListener('error', function(){
    if(vFrame.parentNode) vFrame.parentNode.replaceChild(missingNote(DATA.video.src), vFrame);
  });
  vFrame.appendChild(video);
  vBlock.appendChild(vFrame);
  box.appendChild(vBlock);

  /* --- 壁紙 --- */
  var wBlock = el('div','reward-block');
  wBlock.appendChild(setRuby(el('h3'), 'スマホの{壁紙|かべがみ}'));

  var sw = el('div','os-switch');
  [['iphone','iPhone'],['android','Android']].forEach(function(pair){
    var b = el('button','os-btn');
    b.type = 'button';
    b.textContent = pair[1];
    b.setAttribute('aria-pressed', String(state.os === pair[0]));
    b.addEventListener('click', function(){
      state.os = pair[0]; saveState(); renderReward();
    });
    sw.appendChild(b);
  });
  wBlock.appendChild(sw);

  var wallSlot = el('div');
  wallSlot.id = 'wallSlot';
  wBlock.appendChild(wallSlot);
  box.appendChild(wBlock);

  /* --- はじめから --- */
  var rBlock = el('div','reward-block');
  rBlock.appendChild(setRuby(el('h3'), 'スタンプ{台紙|だいし}をリセット'));
  rBlock.appendChild(setRuby(el('p','section-note'),
    '{台紙|だいし}を{空|から}にして、また{集|あつ}められるようにします。' +
    'どうぶつ{図鑑|ずかん}とクイズの{記録|きろく}は{消|き}えません。' +
    '{全種類|ぜんしゅるい}を{集|あつ}めきったゾーンは、そのまま{残|のこ}ります。'));
  var reset = el('button','btn danger wide');
  reset.type = 'button';
  setRuby(reset, 'スタンプ{台紙|だいし}をリセットする');
  reset.addEventListener('click', doReset);
  rBlock.appendChild(reset);
  box.appendChild(rBlock);

  renderWallpaper();
}

/* 壁紙は「あつめたキャラクターの中から」ランダムでえらぶ */
function ensureWallPick(){
  var ids = zukanIds();
  if(!ids.length){ state.wall = null; return; }
  if(state.wall && ids.indexOf(state.wall) !== -1) return;
  state.wall = pickRandom(ids);
  saveState();
}
function rerollWall(){
  var ids = zukanIds();
  var others = ids.filter(function(id){ return id !== state.wall; });
  state.wall = others.length ? pickRandom(others) : ids[0];
  saveState();
  renderWallpaper();
}

function renderWallpaper(){
  var slot = $('wallSlot');
  if(!slot) return;
  ensureWallPick();
  slot.innerHTML = '';
  if(!state.wall) return;

  var animal = findAnimal(state.wall);
  var zone   = zoneOfAnimal(state.wall);
  var src    = PATH.wall(animal.id, state.os);

  var row = el('div','wall-row');

  var preview = el('div','wall-preview');
  var dl = el('a','btn wide');
  dl.setAttribute('download', src.split('/').pop());
  dl.href = src;
  setRuby(dl, 'この{壁紙|かべがみ}をダウンロード');

  var img = document.createElement('img');
  img.alt = plain(animal.name) + 'の壁紙';
  img.addEventListener('error', function(){
    preview.innerHTML = '';
    preview.appendChild(missingNote(src));
    dl.remove();
  });
  img.src = src;
  preview.appendChild(img);
  row.appendChild(preview);

  var info = el('div','wall-info');
  var who = el('div','wall-who');
  who.innerHTML = '<span class="rb">' + ruby(animal.name) + '</span>' +
    '<small>' + ruby(zone.name) + ' ／ ' + (state.os === 'iphone' ? 'iPhone' : 'Android') + '</small>';
  info.appendChild(who);
  info.appendChild(setRuby(el('p','section-note'),
    'あつめたどうぶつの{中|なか}から、1{頭|とう}えらばれています。'));

  var btns = el('div','btn-row');
  btns.appendChild(dl);
  var re = el('button','btn ghost wide');
  re.type = 'button';
  setRuby(re, 'ちがうどうぶつにする');
  re.addEventListener('click', rerollWall);
  btns.appendChild(re);
  info.appendChild(btns);

  row.appendChild(info);
  slot.appendChild(row);
}

/* 来園者むけ：台紙だけを空にする。図鑑とクイズの記録は残す。
   ただし全種類を集めきったゾーンは、もう引ける相手がいないので
   押したまま固定する */
function doReset(){
  if(!window.confirm('スタンプ台紙をまっさらにします。\nどうぶつ図鑑とクイズの記録はのこります。よろしいですか？')) return;

  var kept = {};
  ZONES.forEach(function(zone){
    if(isZoneComplete(zone) && state.stamps[zone.id]) kept[zone.id] = state.stamps[zone.id];
  });
  state.stamps = kept;
  state.wall   = null;
  saveState();
  closeSheet();
  closeAdmin();
  renderAll();
  window.scrollTo({ top:0, behavior:'smooth' });
  toast('スタンプ台紙をリセットしました（図鑑はのこっています）');
}

/* 運営むけ：図鑑もふくめて全部消す */
function doFullReset(){
  if(!window.confirm('図鑑・クイズの記録もふくめて、すべて消します。\n（運営用。来園者のデータも消えます）よろしいですか？')) return;
  state.zukan = []; state.stamps = {}; state.cleared = [];
  state.wall = null; state.intro = false;
  saveState();
  closeSheet();
  closeAdmin();
  renderAll();
  window.scrollTo({ top:0, behavior:'smooth' });
  $('intro').hidden = false;
  toast('すべてのデータを消しました');
}

/* ============================================================
 * まとめて描画
 * ============================================================ */
function renderAll(){
  renderProgress();
  renderSheet();
  renderZukan();
  renderReward();
}

/* ============================================================
 * モーダルの土台
 * ============================================================ */
function openSheet(narrow){
  $('sheet').className = 'sheet' + (narrow ? ' narrow' : '');
  $('overlay').hidden = false;
  document.body.style.overflow = 'hidden';
  var body = $('sheetBody');
  body.innerHTML = '';
  return body;
}
function closeSheet(){
  $('overlay').hidden = true;
  document.body.style.overflow = '';
}

/* ============================================================
 * QRを読んだとき：ゾーンの中からランダムで1頭えらんで押印する
 * ============================================================ */
function pressStamp(zoneId){
  var zone = findZone(zoneId);
  if(!zone){
    toast('このQRコードはPUZOOLEのものではないようです');
    return;
  }

  /* すでにこの台紙に押してあるゾーン */
  if(state.stamps[zone.id]){
    toast(isZoneComplete(zone)
      ? plain(zone.name) + 'のどうぶつは、ぜんぶ集めました'
      : plain(zone.name) + 'のスタンプは、もう押してあります');
    openAnimal(state.stamps[zone.id]);
    return;
  }

  /* 抽選は「まだ図鑑に入っていないどうぶつ」からだけ行う。
     同じ子が二度出ないので、通うほど図鑑が埋まっていく */
  var remaining = zoneRemaining(zone);

  /* 制覇済みのゾーンで、台紙のマスだけが空いている場合。
     新しく図鑑に入る子はいないが、押せないと台紙が二度と揃わなくなるので、
     そのゾーンで会ったことのある子を1頭えらんで押しなおす */
  if(!remaining.length){
    var again = pickRandom(zone.animals);
    state.stamps[zone.id] = again.id;
    justPressed = zone.id;
    saveState();
    renderAll();
    showPress(zone, again);
    setTimeout(function(){
      toast(plain(zone.name) + 'は制覇ずみ。図鑑はもう埋まっています');
    }, 900);
    return;
  }

  var animal = pickRandom(remaining);
  state.stamps[zone.id] = animal.id;
  state.zukan.push(animal.id);
  justPressed = zone.id;
  saveState();
  renderAll();
  showPress(zone, animal);

  if(isZoneComplete(zone)){
    setTimeout(function(){
      toast(plain(zone.name) + 'をコンプリート！このマスは残ります');
    }, 900);
  }else if(isComplete()){
    setTimeout(function(){ toast('スタンプが全部そろいました'); }, 900);
  }
}

function showPress(zone, animal){
  var body = openSheet(true);
  body.appendChild(setRuby(el('h2'), 'スタンプを{押|お}しました'));
  body.appendChild(setRuby(el('p','lead'), plain(zone.name) + 'で{出会|であ}ったのは…'));

  var ring = el('div','press-ring');
  ring.style.setProperty('--zone-color', zone.color);
  ring.style.setProperty('--zone-text', 'var(--zt-' + zone.id + ')');
  ring.appendChild(imgOrFallback(
    PATH.animal(animal.id), plain(animal.name),
    function(){ return stampAlt(animal.name); }
  ));
  body.appendChild(ring);

  body.appendChild(setRuby(el('div','press-zone'), zone.name));
  body.appendChild(setRuby(el('div','press-name'), animal.name));

  var row = el('div','btn-row');
  var quizBtn = el('button','btn wide');
  quizBtn.type = 'button';
  setRuby(quizBtn, 'クイズにちょうせんする');
  quizBtn.addEventListener('click', function(){ openQuiz(animal.id); });
  row.appendChild(quizBtn);

  var later = el('button','btn ghost wide');
  later.type = 'button';
  setRuby(later, 'あとにする');
  later.addEventListener('click', closeSheet);
  row.appendChild(later);
  body.appendChild(row);

  if(isComplete()){
    var row2 = el('div','btn-row');
    var go = el('button','btn ghost wide');
    go.type = 'button';
    setRuby(go, 'ごほうびを{見|み}る');
    go.addEventListener('click', function(){
      closeSheet();
      $('rewardSection').scrollIntoView({ behavior:'smooth', block:'start' });
    });
    row2.appendChild(go);
    body.appendChild(row2);
  }
}

/* ============================================================
 * 図鑑カード：クリア済みならカード、まだならクイズへ
 * ============================================================ */
function openAnimal(animalId){
  if(isCleared(animalId)) showCard(animalId);
  else openQuiz(animalId);
}

function showCard(animalId){
  var animal = findAnimal(animalId);
  var zone   = zoneOfAnimal(animalId);
  var body   = openSheet(false);

  body.appendChild(setRuby(el('h2'), animal.name));
  body.appendChild(setRuby(el('p','lead'), zone.name + '　' + animal.sub));

  var frame = el('div','prize-frame');
  frame.appendChild(imgOrFallback(
    PATH.animal(animal.id), plain(animal.name),
    function(){ return zukanAlt(animal); }
  ));
  body.appendChild(frame);

  var facts = el('ul','fact-list');
  [['{園内|えんない}のどこ', animal.place],
   ['すんでいるところ', animal.habitat],
   ['とくちょう', animal.feature]].forEach(function(p){
    var li = el('li');
    li.appendChild(setRuby(el('span','lbl'), p[0]));
    li.appendChild(setRuby(el('span','val'), p[1]));
    facts.appendChild(li);
  });
  body.appendChild(facts);

  body.appendChild(buildKeeper(animal));
  body.appendChild(buildPrize(animal));

  var row = el('div','btn-row');
  var again = el('button','btn ghost wide');
  again.type = 'button';
  setRuby(again, 'クイズをもういちどやる');
  again.addEventListener('click', function(){ openQuiz(animal.id); });
  row.appendChild(again);
  body.appendChild(row);
}

function buildKeeper(animal){
  var box  = el('div','keeper');
  var head = el('div','keeper-head');
  head.appendChild(el('span','mark', MARK_TALK));
  head.appendChild(setRuby(el('span'), '{飼育員|しいくいん}さんから'));
  box.appendChild(head);
  box.appendChild(setRuby(el('div','keeper-body'), animal.keeper));
  return box;
}

/* ごほうび画像。ファイルが無いときはブロックごと消える */
function buildPrize(animal){
  var block = el('div','reward-block');
  var src   = PATH.prize(animal.id);

  var frame = el('div','prize-frame');
  var img = document.createElement('img');
  img.alt = plain(animal.name) + 'の記念画像';
  img.addEventListener('error', function(){ block.remove(); });
  img.src = src;
  frame.appendChild(img);

  var dl = el('a','btn wide');
  dl.setAttribute('download', src.split('/').pop());
  dl.href = src;
  setRuby(dl, '{記念|きねん}の{画像|がぞう}をダウンロード');

  block.appendChild(setRuby(el('h3'), 'ぜんもん{正解|せいかい}のごほうび'));
  block.appendChild(frame);
  block.appendChild(dl);
  return block;
}

/* ============================================================
 * クイズ
 * ============================================================ */
var quiz = null;

function openQuiz(animalId){
  quiz = {
    animal: findAnimal(animalId),
    i: 0,
    marks: [],   /* true=正解 / false=不正解 */
    order: null, /* 選択肢の並び（答えるまで固定） */
    picked: -1
  };
  renderQuiz();
}

function renderQuiz(){
  var animal = quiz.animal;
  var q      = animal.quiz[quiz.i];
  var body   = openSheet(false);

  /* ステップ表示 */
  var step = el('div','quiz-step');
  step.appendChild(setRuby(el('span'), plain(animal.name) + 'クイズ'));
  var dots = el('div','quiz-dots');
  for(var k=0;k<animal.quiz.length;k++){
    var mark = quiz.marks[k];
    dots.appendChild(el('i', mark === true ? 'on' : (mark === false ? 'ng' : '')));
  }
  step.appendChild(dots);
  body.appendChild(step);

  /* 設問 */
  body.appendChild(setRuby(el('p','quiz-q'), (quiz.i + 1) + '. ' + q.q));

  /* 設問の画像（img:1 のときだけ読みにいく） */
  if(q.img){
    var box = el('div','quiz-img');
    var src = PATH.quiz(animal.id, quiz.i + 1);
    box.appendChild(imgOrFallback(src, '問題の画像', function(){ return missingNote(src); }));
    body.appendChild(box);
  }

  /* 選択肢。並びは毎回シャッフルする */
  if(!quiz.order){
    quiz.order = shuffle(q.c.map(function(_, idx){ return idx; }));
  }
  var choices = el('div','quiz-choices');
  quiz.order.forEach(function(origIdx){
    var b = el('button','choice');
    b.type = 'button';
    setRuby(b, q.c[origIdx]);

    if(quiz.picked !== -1){
      b.disabled = true;
      if(origIdx === q.a) b.className = 'choice correct';
      else if(origIdx === quiz.picked) b.className = 'choice wrong';
      else b.className = 'choice dim';
    }else{
      b.addEventListener('click', function(){
        quiz.picked = origIdx;
        quiz.marks[quiz.i] = (origIdx === q.a);
        renderQuiz();
      });
    }
    choices.appendChild(b);
  });
  body.appendChild(choices);

  /* 答えあわせ */
  if(quiz.picked !== -1){
    var ok = quiz.marks[quiz.i];
    var fb = el('div','quiz-feedback');
    fb.appendChild(setRuby(el('div','quiz-verdict ' + (ok ? 'ok' : 'ng')),
      ok ? 'せいかい！' : 'ざんねん…'));
    fb.appendChild(setRuby(el('div','quiz-explain'), q.e));
    body.appendChild(fb);

    var row = el('div','btn-row');
    var next = el('button','btn wide');
    next.type = 'button';
    var last = quiz.i === animal.quiz.length - 1;
    setRuby(next, last ? '{結果|けっか}を{見|み}る' : 'つぎのもんだいへ');
    next.addEventListener('click', function(){
      if(last){ showQuizResult(); return; }
      quiz.i++; quiz.order = null; quiz.picked = -1;
      renderQuiz();
    });
    row.appendChild(next);
    body.appendChild(row);
  }
}

function showQuizResult(){
  var animal  = quiz.animal;
  var perfect = quiz.marks.length === animal.quiz.length &&
                quiz.marks.every(function(m){ return m === true; });
  var body = openSheet(false);

  if(perfect){
    if(!isCleared(animal.id)){
      state.cleared.push(animal.id);
      saveState();
      renderZukan();
    }

    var badge = el('div','result-badge');
    badge.innerHTML = '<span class="rb">ぜんもん<br>' + ruby('{正解|せいかい}') + '</span>';
    body.appendChild(badge);
    body.appendChild(setRuby(el('h2'), animal.name + 'はかせ に なりました'));
    body.appendChild(setRuby(el('p','lead'), '{図鑑|ずかん}の{絵|え}に{色|いろ}がつきました。'));

    body.appendChild(buildPrize(animal));
    body.appendChild(buildKeeper(animal));

    var row = el('div','btn-row');
    var done = el('button','btn wide');
    done.type = 'button';
    setRuby(done, 'とじる');
    done.addEventListener('click', closeSheet);
    row.appendChild(done);
    body.appendChild(row);

  }else{
    var right = quiz.marks.filter(Boolean).length;
    body.appendChild(setRuby(el('h2'), 'おしい！'));
    body.appendChild(setRuby(el('p','lead'),
      animal.quiz.length + '{問中|もんちゅう} ' + right + '{問|もん}{正解|せいかい}。' +
      'ぜんぶ{正|ただ}しく{答|こた}えると、ごほうびがもらえます。'));

    var row2 = el('div','btn-row');
    var retry = el('button','btn wide');
    retry.type = 'button';
    setRuby(retry, 'もういちど ちょうせんする');
    retry.addEventListener('click', function(){ openQuiz(animal.id); });
    row2.appendChild(retry);

    var later = el('button','btn ghost wide');
    later.type = 'button';
    setRuby(later, 'あとにする');
    later.addEventListener('click', closeSheet);
    row2.appendChild(later);
    body.appendChild(row2);
  }
}

/* ============================================================
 * QRの受けとり  例）……/index.html?zone=asia
 * ============================================================ */
function handleIncomingQR(){
  var params = new URLSearchParams(window.location.search);
  var zoneId = params.get('zone') || params.get('z');
  if(!zoneId) return;

  /* リロードで二重に押されないよう、URLからパラメータを外す */
  window.history.replaceState({}, document.title,
    window.location.origin + window.location.pathname);

  pressStamp(zoneId);
}

/* ============================================================
 * 運営パネル
 *   ・タイトルを2.5秒以内に7回タップ
 *   ・または URL に ?admin=1
 * ============================================================ */
function openAdmin(){ $('adminOverlay').hidden = false; document.body.style.overflow = 'hidden'; }
function closeAdmin(){ $('adminOverlay').hidden = true; document.body.style.overflow = ''; }

function buildAdminButtons(){
  var wrap = $('adminZoneButtons');
  wrap.innerHTML = '';
  ZONES.forEach(function(zone){
    var b = el('button');
    b.type = 'button';
    b.textContent = plain(zone.name);
    b.addEventListener('click', function(){ pressStamp(zone.id); });
    wrap.appendChild(b);
  });
}

/* ------------------------------------------------------------
 * どうぶつの復元（運営用）
 *   データが消えた来園者のために、1体ずつ状態を戻せるようにします。
 *   ボタンを押すごとに 未取得 → 図鑑にある → クイズもクリア → 未取得
 *   と一巡します。押し間違えてももう一度押せば戻せます。
 * ---------------------------------------------------------- */
function animalState(id){
  if(isCleared(id)) return 2;                          /* クイズもクリア */
  if(state.zukan.indexOf(id) !== -1) return 1;         /* 図鑑にある */
  return 0;                                            /* 未取得 */
}
var RESTORE_LABEL = ['未取得','図鑑にある','クリア済み'];

function cycleAnimal(animal, zone){
  var s = animalState(animal.id);
  if(s === 0){
    state.zukan.push(animal.id);
    /* 台紙のそのゾーンが空いていれば、あわせて押しておく */
    if(!state.stamps[zone.id]) state.stamps[zone.id] = animal.id;
  }else if(s === 1){
    state.cleared.push(animal.id);
  }else{
    state.cleared = state.cleared.filter(function(x){ return x !== animal.id; });
    state.zukan   = state.zukan.filter(function(x){ return x !== animal.id; });
    if(state.stamps[zone.id] === animal.id) delete state.stamps[zone.id];
  }
  saveState();
  renderAll();
  buildRestoreList();
}

function buildRestoreList(){
  var wrap = $('restoreList');
  if(!wrap) return;
  wrap.innerHTML = '';

  $('restoreCount').textContent = zukanIds().length + ' / ' + zukanTotal();

  ZONES.forEach(function(zone){
    var box = el('div','restore-zone');
    box.appendChild(setRuby(el('h4','restore-zone-name'), zone.name));

    var list = el('div','restore-list');
    zone.animals.forEach(function(animal){
      var s = animalState(animal.id);
      var b = el('button','restore-btn s' + s);
      b.type = 'button';
      b.style.setProperty('--zone-text', 'var(--zt-' + zone.id + ')');
      b.innerHTML = '<span class="nm">' + ruby(animal.name) + '</span>' +
                    '<span class="st">' + escapeHtml(RESTORE_LABEL[s]) + '</span>';
      b.setAttribute('aria-label', plain(animal.name) + '：' + RESTORE_LABEL[s]);
      b.addEventListener('click', function(){ cycleAnimal(animal, zone); });
      list.appendChild(b);
    });

    box.appendChild(list);
    wrap.appendChild(box);
  });
}

function buildQrList(){
  var base = window.location.origin + window.location.pathname;
  var list = $('qrList');
  list.innerHTML = '';

  ZONES.forEach(function(zone){
    var url = base + '?zone=' + zone.id;
    var row = el('div','qr-row');

    var qrbox = el('div','qrbox');
    row.appendChild(qrbox);
    row.appendChild(el('div','qrtxt', escapeHtml(plain(zone.name) + '：' + url)));

    var copy = el('button');
    copy.type = 'button';
    copy.textContent = 'コピー';
    copy.addEventListener('click', function(){
      if(navigator.clipboard){
        navigator.clipboard.writeText(url).then(function(){ toast('リンクをコピーしました'); });
      }
    });
    row.appendChild(copy);
    list.appendChild(row);

    if(window.QRCode){
      try{
        new QRCode(qrbox, { text:url, width:60, height:60,
          colorDark:'#33302B', colorLight:'#FFFFFF' });
      }catch(e){ /* ライブラリが読めない環境ではQR画像なしで運用 */ }
    }
  });
}

/* ============================================================
 * はじめての案内
 * ============================================================ */
function initIntro(){
  var intro = $('intro');
  if(state.intro){ intro.hidden = true; return; }
  intro.hidden = false;
  $('introStart').addEventListener('click', function(){
    state.intro = true; saveState();
    intro.hidden = true;
  });
}

/* ============================================================
 * 画像の持ち出し対策
 *   右クリック（PC）と長押し（スマホ）の保存メニューを抑えます。
 *   ダウンロードボタンは <a download> なので影響しません。
 *
 *   ※ 表示している画像は開発者ツールのネットワークタブから
 *     取得できます。ここでできるのは「うっかり保存」を防ぐまでで、
 *     本気で守るならサーバー側で配信を制御する必要があります。
 * ============================================================ */
function guardImages(){
  document.addEventListener('contextmenu', function(e){
    if(e.target && e.target.tagName === 'IMG') e.preventDefault();
  });
  document.addEventListener('dragstart', function(e){
    if(e.target && e.target.tagName === 'IMG') e.preventDefault();
  });
}

/* ============================================================
 * 初期化
 * ============================================================ */
function init(){
  loadState();
  guardImages();

  $('sheetClose').innerHTML = MARK_CLOSE;
  $('sheetClose').addEventListener('click', closeSheet);
  $('overlay').addEventListener('click', function(e){ if(e.target === this) closeSheet(); });

  $('adminClose').innerHTML = MARK_CLOSE;
  $('adminClose').addEventListener('click', closeAdmin);
  $('adminOverlay').addEventListener('click', function(e){ if(e.target === this) closeAdmin(); });

  document.addEventListener('keydown', function(e){
    if(e.key !== 'Escape') return;
    if(!$('overlay').hidden) closeSheet();
    else if(!$('adminOverlay').hidden) closeAdmin();
  });

  /* 隠しコマンド：タイトルを7回タップ */
  var taps = 0, timer = null;
  $('brandTitle').addEventListener('click', function(){
    taps++;
    clearTimeout(timer);
    timer = setTimeout(function(){ taps = 0; }, 2500);
    if(taps >= 7){ taps = 0; openAdmin(); }
  });
  $('adminReset').addEventListener('click', doFullReset);

  handleIncomingQR();
  renderAll();
  buildAdminButtons();
  buildRestoreList();
  buildQrList();
  initIntro();

  if(new URLSearchParams(window.location.search).get('admin') === '1') openAdmin();
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
}else{
  init();
}

})();
