(()=>{
const STORAGE_KEY='training-menu-maker-v2', LEGACY_KEY='training-menu-maker-v1', HISTORY_KEY='training-menu-history-v1', HISTORY_DB='training-menu-history-db-v1', HISTORY_STORE='images', HISTORY_MIGRATED_KEY='training-menu-history-migrated-v1';
const defaultState={categories:[{id:'cat_basic',name:'準備'},{id:'cat_knock',name:'基礎'},{id:'cat_footwork',name:'技術'},{id:'cat_game',name:'実戦'},{id:'cat_core',name:'体力'},{id:'cat_other',name:'その他'}],menus:[{id:'menu_1',name:'ウォームアップ',categoryId:'cat_basic',seconds:600,requiresSets:false},{id:'menu_2',name:'基礎練習',categoryId:'cat_knock',seconds:180,requiresSets:true},{id:'menu_3',name:'技術練習',categoryId:'cat_footwork',seconds:180,requiresSets:true},{id:'menu_4',name:'ゲーム形式',categoryId:'cat_game',seconds:480,requiresSets:true},{id:'menu_5',name:'体幹トレーニング',categoryId:'cat_core',seconds:600,requiresSets:false},{id:'menu_6',name:'休憩',categoryId:'cat_other',seconds:300,requiresSets:false}],history:[]};
const $=id=>document.getElementById(id);
let state=loadState();
let currentScreen='home';
let createCategory='all';
let listCategory='all';
let selectedMenuIds=[];
let selectedPeople=[4,5];
let currentSheetTitle='メニュー表';
let setPlan=[];
let addCategoryId=state.categories[0]?.id||'';
let editingMenuId=null;
let deleteTargetId=null;
let reorderMode=false;
let categoryEditMode=false;
let historyEditMode=false;
let activeDrag=null;
let activeCategoryDrag=null;
let historyObjectUrls=[];
let historyRenderToken=0;
let historyPreviewId='';
let downloadSequence=0;
let lastImageDataUrl='';
let lastHistoryDataUrl='';
let lastHistoryBlob=null;
let lastHistoryType='image/jpeg';
let lastImageTitle='';
let lastPreviewHistorySaved=false;
let pendingUndo=null;
let toastTimer=null;
let modalReturnFocus=null;
let previewReturnFocus=null;

migrateState();
function uid(p){return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`}
function clone(o){return JSON.parse(JSON.stringify(o))}
function loadLocalHistory(){try{return JSON.parse(localStorage.getItem(HISTORY_KEY))||[]}catch(e){return[]}}
function openHistoryDB(){return new Promise((resolve,reject)=>{if(!('indexedDB' in window)){reject(new Error('IndexedDB unsupported'));return}const req=indexedDB.open(HISTORY_DB,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(HISTORY_STORE))db.createObjectStore(HISTORY_STORE,{keyPath:'id'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function txStore(db,mode='readonly'){return db.transaction(HISTORY_STORE,mode).objectStore(HISTORY_STORE)}
function dataURLToBlob(dataUrl){const parts=String(dataUrl).split(','),meta=parts[0]||'',bin=atob(parts[1]||''),mime=(meta.match(/data:(.*?);base64/)||[])[1]||'image/png',u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);return new Blob([u8],{type:mime})}
function blobToObjectUrl(blob){return URL.createObjectURL(blob)}function revokeHistoryObjectUrls(){historyObjectUrls.forEach(url=>URL.revokeObjectURL(url));historyObjectUrls=[]}
function historyExt(item){const type=item?.type||item?.blob?.type||String(item?.dataUrl||'').match(/^data:(.*?);/)?.[1]||'image/png';return type.includes('jpeg')||type.includes('jpg')?'jpg':'png'}
function safeFileName(value){const cleaned=String(value||'メニュー表').normalize('NFKC').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').replace(/\s+/g,'_').replace(/[. ]+$/g,'').slice(0,60);return cleaned||'メニュー表'}
function uniqueImageFileName(title,extension){const now=new Date(),pad=(value,length=2)=>String(value).padStart(length,'0');downloadSequence=(downloadSequence+1)%100;const stamp=`${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${pad(now.getMilliseconds(),3)}-${pad(downloadSequence)}`;return `${safeFileName(title)}-${stamp}.${extension}`}
function triggerDownload(href,fileName){const a=document.createElement('a');a.href=href;a.download=fileName;document.body.appendChild(a);a.click();a.remove()}
async function getHistoryRecords(){try{const db=await openHistoryDB();return await new Promise((resolve,reject)=>{const req=txStore(db).getAll();req.onsuccess=()=>resolve((req.result||[]).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt)));req.onerror=()=>reject(req.error)})}catch(e){console.warn('IndexedDB履歴を読めませんでした。localStorage履歴にフォールバックします。',e);return loadLocalHistory().map(item=>({...item,type:String(item.dataUrl||'').match(/^data:(.*?);/)?.[1]||'image/png',blob:null}))}}
async function putHistoryRecord(item){try{const db=await openHistoryDB();await new Promise((resolve,reject)=>{const req=txStore(db,'readwrite').put(item);req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error)});return true}catch(e){console.error(e);return false}}
async function deleteHistoryRecord(id){try{const db=await openHistoryDB();await new Promise((resolve,reject)=>{const req=txStore(db,'readwrite').delete(id);req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error)});return true}catch(e){console.error(e);return false}}
async function migrateHistoryToIDB(){try{if(localStorage.getItem(HISTORY_MIGRATED_KEY)==='1')return;const old=loadLocalHistory();if(!old.length){localStorage.setItem(HISTORY_MIGRATED_KEY,'1');return}for(const item of old){if(item&&item.dataUrl){const saved=await putHistoryRecord({id:item.id||uid('hist'),title:item.title||'メニュー表',createdAt:item.createdAt||new Date().toISOString(),type:String(item.dataUrl).match(/^data:(.*?);/)?.[1]||'image/png',blob:dataURLToBlob(item.dataUrl)});if(!saved)return}}localStorage.setItem(HISTORY_MIGRATED_KEY,'1')}catch(e){console.warn('履歴移行に失敗しました',e)}}
function loadState(){try{const loaded=JSON.parse(localStorage.getItem(STORAGE_KEY))||JSON.parse(localStorage.getItem(LEGACY_KEY))||clone(defaultState);loaded.history=[];return loaded}catch(e){const st=clone(defaultState);st.history=[];return st}}
function saveState(){try{const copy={...state,history:[]};localStorage.setItem(STORAGE_KEY,JSON.stringify(copy));return true}catch(e){console.error(e);return false}}
function mutateAndSave(mutator){
  const previous={categories:clone(state.categories),menus:clone(state.menus)};
  mutator();
  if(saveState())return true;
  state.categories=previous.categories;
  state.menus=previous.menus;
  return false;
}
function migrateState(){let changed=false;if(!Array.isArray(state.categories)){state.categories=clone(defaultState.categories);changed=true}if(!Array.isArray(state.menus)){state.menus=clone(defaultState.menus);changed=true}if(!Array.isArray(state.history)){state.history=[];changed=true}state.menus.forEach((m,i)=>{if(m.seconds===undefined){m.seconds=Number(m.minutes||0)*60;changed=true}delete m.minutes;if(m.requiresSets===undefined){m.requiresSets=true;changed=true}if(m.order===undefined){m.order=i;changed=true}});if(changed)saveState();migrateHistoryToIDB().then(()=>{if(currentScreen==='history')renderHistoryScreen()})}
function clearToast(){if(toastTimer)clearTimeout(toastTimer);toastTimer=null;$('appToast').classList.remove('show','error');$('toastUndo').hidden=true;$('toastUndo').onclick=null}
function showToast(message,{error=false,undo=null,duration=3500}={}){
  clearToast();
  $('toastMessage').textContent=message;
  $('appToast').classList.toggle('error',error);
  if(undo){$('toastUndo').hidden=false;$('toastUndo').onclick=undo}
  $('appToast').classList.add('show');
  toastTimer=setTimeout(()=>{pendingUndo=null;clearToast()},duration);
}
function showSaveError(){showToast('保存できませんでした。空き容量を確認して再試行してください。',{error:true,duration:5000})}
function showScreen(name){
  const previousScreen=currentScreen;
  const direction=slideDirection(previousScreen,name);
  if(activeDrag)cleanupMenuDrag();
  if(activeCategoryDrag)cleanupCategoryDrag();
  if(name!=='list')reorderMode=false;
  if(name!=='categories')categoryEditMode=false;
  if(name!=='history')historyEditMode=false;
  if(name!==previousScreen){pendingUndo=null;clearToast()}
  currentScreen=name;
  if(name!=='history'){
    historyRenderToken+=1;
    closeHistoryPreview();
    revokeHistoryObjectUrls();
  }
  document.querySelectorAll('.screen').forEach(screen=>screen.classList.remove('active','slide-forward','slide-back'));
  $(`screen-${name}`).classList.add('active',direction==='back'?'slide-back':'slide-forward');
  closeDropdowns();
  if(name==='create')renderCreateScreen();
  if(name==='sets')renderSetScreen();
  if(name==='add')renderAddScreen();
  if(name==='list')renderListScreen();
  if(name==='history')renderHistoryScreen();
  if(name==='categories')renderCategoryListScreen();
}
function slideDirection(from,to){const order={home:0,create:1,add:1,list:1,categories:1,history:1,sets:2};return(order[to]??0)<(order[from]??0)?'back':'forward'}
function categoryName(id){return state.categories.find(category=>category.id===id)?.name||'未分類'}
function findMenu(id){return state.menus.find(menu=>menu.id===id)}
function categoryIndex(id){const index=state.categories.findIndex(category=>category.id===id);return index<0?999:index}
function sortedMenus(menus){return menus.slice().sort((a,b)=>categoryIndex(a.categoryId)-categoryIndex(b.categoryId)||(a.order??0)-(b.order??0)||a.name.localeCompare(b.name,'ja'))}
function escapeHTML(str){return String(str).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]))}
function formatSeconds(sec){const total=Math.max(0,Math.round(Number(sec)||0)),minutes=Math.floor(total/60),seconds=total%60;return `${minutes}分 ${seconds}秒`}
function formatCompactSeconds(sec){const total=Math.max(0,Math.round(Number(sec)||0)),minutes=Math.floor(total/60),seconds=total%60;if(!minutes)return `${seconds}秒`;if(!seconds)return `${minutes}分`;return `${minutes}分 ${seconds}秒`}
function closeDropdowns(){document.querySelectorAll('.drop-panel').forEach(panel=>panel.classList.remove('open'))}
function renderCategoryChips(el,selected,onPick,includeAll=false){
  el.innerHTML='';
  if(includeAll)addChip(el,'すべて',selected==='all',()=>onPick('all'));
  state.categories.forEach(category=>addChip(el,category.name,selected===category.id,()=>onPick(category.id)));
}
function addChip(el,text,active,onClick){
  const button=document.createElement('button');
  button.type='button';
  button.className='chip'+(active?' active':'');
  button.textContent=text;
  button.setAttribute('aria-pressed',String(active));
  if(el.getAttribute('role')==='tablist'){button.setAttribute('role','tab');button.setAttribute('aria-selected',String(active))}
  button.addEventListener('click',onClick);
  el.appendChild(button);
}
function renderCategoryPanel(){
  const panel=$('addCategoryPanel');
  panel.innerHTML='';
  state.categories.forEach(category=>{
    const button=document.createElement('button');
    button.className='drop-item'+(addCategoryId===category.id?' active':'');
    button.innerHTML=`<span>${escapeHTML(category.name)}</span>${addCategoryId===category.id?'<span>✓</span>':''}`;
    button.addEventListener('click',()=>{
      addCategoryId=category.id;
      closeDropdowns();
      renderAddScreen();
    });
    panel.appendChild(button);
  });
  const addButton=document.createElement('button');
  addButton.className='drop-item add-new';
  addButton.textContent='＋新規追加';
  addButton.addEventListener('click',()=>{
    const name=prompt('新しい分類名を入力してください');
    if(!name?.trim())return;
    const category={id:uid('cat'),name:name.trim()};
    if(!mutateAndSave(()=>state.categories.push(category))){showSaveError();return}
    addCategoryId=category.id;
    closeDropdowns();
    renderAddScreen();
  });
  panel.appendChild(addButton);
}
function renderCreateScreen(){
  renderCategoryChips($('createCategoryChips'),createCategory,id=>{createCategory=id;renderCreateScreen()},true);
  const selectedCount=selectedMenuIds.length;
  $('selectedMenuCount').textContent=`${selectedCount}件選択`;
  $('startSetBtn').disabled=selectedCount===0;
  $('startSetBtn').textContent=selectedCount?`次へ（${selectedCount}件）`:'メニューを選択';
  const list=$('menuSelectList');
  const menus=sortedMenus(state.menus.filter(menu=>createCategory==='all'||menu.categoryId===createCategory));
  list.innerHTML='';
  if(!menus.length){
    list.innerHTML='<div class="empty"><p>この分類にはメニューがありません</p><button type="button" class="secondary empty-action" data-go-empty="add">メニューを追加</button></div>';
    list.querySelector('[data-go-empty]')?.addEventListener('click',()=>{resetAddForm();showScreen('add')});
    return;
  }
  menus.forEach(menu=>{
    const order=selectedMenuIds.indexOf(menu.id)+1;
    const selected=order>0;
    const row=document.createElement('button');
    row.type='button';
    row.className='menu-row'+(selected?' selected':'');
    row.setAttribute('aria-pressed',String(selected));
    row.innerHTML=`<span class="select-mark ${selected?'selected':''}">${selected?order:''}</span><span><span class="row-name">${escapeHTML(menu.name)}</span><span class="row-meta">${escapeHTML(categoryName(menu.categoryId))} / ${formatCompactSeconds(menu.seconds)} / ${menu.requiresSets?'セットあり':'1回のみ'}</span></span>`;
    row.addEventListener('click',()=>toggleSelect(menu.id));
    list.appendChild(row);
  });
}
function toggleSelect(id){
  const index=selectedMenuIds.indexOf(id);
  if(index>=0)selectedMenuIds.splice(index,1);
  else selectedMenuIds.push(id);
  renderCreateScreen();
}
function startSetSelection(){if(!selectedMenuIds.length)return;currentSheetTitle=$('sheetTitle').value.trim()||'メニュー表';setPlan=selectedMenuIds.map(id=>{const menu=findMenu(id),old=setPlan.find(r=>r.menuId===id),sets=old?.sets||{};return{menuId:id,sets:{1:sets[1]??old?.sets1??(menu.requiresSets?1:0),2:sets[2]??old?.sets2??(menu.requiresSets?1:0),3:sets[3]??old?.sets3??(menu.requiresSets?1:0),4:sets[4]??old?.sets4??(menu.requiresSets?1:0),5:sets[5]??old?.sets5??(menu.requiresSets?1:0)}}});showScreen('sets')}
function renderPeopleSelect(){
  const el=$('peopleSelect');
  el.innerHTML='';
  [1,2,3,4,5].forEach(person=>{
    const active=selectedPeople.includes(person);
    const disabled=!active&&selectedPeople.length>=2;
    const button=document.createElement('button');
    button.type='button';
    button.className='chip'+(active?' active':'');
    button.textContent=`${person}人`;
    button.disabled=disabled;
    button.setAttribute('aria-pressed',String(active));
    button.addEventListener('click',()=>{
      if(active)selectedPeople=selectedPeople.filter(value=>value!==person);
      else selectedPeople.push(person);
      selectedPeople=selectedPeople.sort((a,b)=>a-b);
      renderSetScreen();
    });
    el.appendChild(button);
  });
}
function renderSetScreen(){
  selectedPeople=selectedPeople.slice().sort((a,b)=>a-b);renderPeopleSelect();$('setSheetTitle').textContent=currentSheetTitle;
  $('setHead').innerHTML=`<tr><th>メニュー</th>${selectedPeople.map(p=>`<th>${p}人</th>`).join('')}</tr>`;
  const tbody=$('setRows');tbody.innerHTML='';
  setPlan.forEach((row,i)=>{const menu=findMenu(row.menuId);if(!menu)return;const tr=document.createElement('tr');if(menu.requiresSets){tr.innerHTML=`<td><div class="set-name">${i+1}. ${escapeHTML(menu.name)}<small>${formatCompactSeconds(menu.seconds)} / 1set・1人</small></div></td>`+selectedPeople.map(p=>`<td>${stepperHTML(i,p,getSets(row,p))}</td>`).join('')}else{tr.innerHTML=`<td><div class="set-name">${i+1}. ${escapeHTML(menu.name)}<small>${formatCompactSeconds(menu.seconds)} / 1回のみ</small></div></td>`+(selectedPeople.length?`<td colspan="${selectedPeople.length}"><span class="once-pill">1回のみ</span></td>`:'')}tbody.appendChild(tr)});
  tbody.querySelectorAll('[data-step]').forEach(btn=>btn.addEventListener('click',()=>{const i=Number(btn.dataset.index),p=btn.dataset.person,delta=Number(btn.dataset.step);setPlan[i].sets[p]=Math.max(0,getSets(setPlan[i],p)+delta);renderSetScreen()}));
  const t=calcTotals(),exportBtn=$('exportImageBtn');
  if(t.noPeople){$('setTotalsLine').innerHTML='<span>未選択</span>';$('totalTime').textContent='0分 0秒';$('totalNote').textContent='';$('statusBox').className='status ng';$('statusBox').textContent='人数を1つ以上選択してください';if(exportBtn)exportBtn.disabled=true;return}
  if(exportBtn)exportBtn.disabled=false;
  $('setTotalsLine').innerHTML=selectedPeople.map(p=>`<span>${p}人：<b>${t.byPerson[p].peopleSets}</b> 人set</span>`).join('');
  $('totalTime').innerHTML=selectedPeople.map(p=>`<span>${p}人：<b>${formatSeconds(t.byPerson[p].seconds)}</b></span>`).join(' / ');
  const box=$('statusBox');
  if(t.mismatch){$('totalNote').textContent='人数パターンごとに、メニュー別の人setが一致していません。';box.className='status ng';box.textContent='注意：メニューごとの練習量が一致していません。'}else{$('totalNote').textContent='';box.className='status ok';box.textContent='出力可'}
}
function getSets(row,p){return Number(row.sets?.[p]??0)}
function stepperHTML(index,person,value){return `<span class="stepper"><button data-step="-1" data-index="${index}" data-person="${person}">−</button><span>${value} set</span><button data-step="1" data-index="${index}" data-person="${person}">＋</button></span>`}
function calculateTotals(people,plan,menus){
  if(!people.length)return{byPerson:{},mismatch:false,noPeople:true};
  const menuById=new Map(menus.map(menu=>[menu.id,menu]));
  const byPerson={},mismatchMenus=[];
  people.forEach(person=>byPerson[person]={rawSets:0,peopleSets:0,seconds:0});
  plan.forEach(row=>{
    const menu=menuById.get(row.menuId);
    if(!menu)return;
    if(menu.requiresSets){
      const peopleSets=people.map(person=>getSets(row,person)*person);
      if(peopleSets.some(value=>value!==peopleSets[0]))mismatchMenus.push(menu.name);
      people.forEach(person=>{
        const sets=getSets(row,person);
        byPerson[person].rawSets+=sets;
        byPerson[person].peopleSets+=sets*person;
        byPerson[person].seconds+=menu.seconds*sets*person;
      });
    }else{
      people.forEach(person=>byPerson[person].seconds+=menu.seconds);
    }
  });
  return{byPerson,mismatch:mismatchMenus.length>0,mismatchMenus,noPeople:false};
}
function calcTotals(){return calculateTotals(selectedPeople,setPlan,state.menus)}
function setFixedSwitch(on){
  const enabled=!!on;
  $('methodOnce').classList.toggle('active',enabled);
  $('methodSets').classList.toggle('active',!enabled);
  $('methodOnce').setAttribute('aria-pressed',String(enabled));
  $('methodSets').setAttribute('aria-pressed',String(!enabled));
}
function fixedMode(){return $('methodOnce').getAttribute('aria-pressed')==='true'}
function updateTimeLabel(){$('timeLabel').textContent=fixedMode()?'1回の時間':'1set・1人の時間'}
function clearFieldErrors(){
  [['menuName','menuNameError'],['addCategoryBtn','menuCategoryError'],['menuMinutes','menuMinutesError'],['menuSecondsPart','menuSecondsError']].forEach(([fieldId,errorId])=>{
    $(fieldId).removeAttribute('aria-invalid');
    $(errorId).textContent='';
  });
}
function setFieldError(fieldId,errorId,message){$(fieldId).setAttribute('aria-invalid','true');$(errorId).textContent=message}
function resetAddForm(){
  editingMenuId=null;
  $('menuName').value='';
  $('menuMinutes').value='';
  $('menuSecondsPart').value='';
  addCategoryId=state.categories[0]?.id||'';
  setFixedSwitch(false);
  clearFieldErrors();
  updateTimeLabel();
}
function renderAddScreen(){
  const editing=editingMenuId?findMenu(editingMenuId):null;
  $('addTitle').textContent=editing?'メニュー編集':'メニュー追加';
  $('saveMenuBtn').textContent=editing?'保存する':'追加する';
  if(editing){
    const totalSeconds=Math.max(0,Math.round(Number(editing.seconds)||0));
    $('menuName').value=editing.name;
    $('menuMinutes').value=Math.floor(totalSeconds/60);
    $('menuSecondsPart').value=totalSeconds%60;
    addCategoryId=editing.categoryId;
    setFixedSwitch(!editing.requiresSets);
  }
  $('addCategoryText').textContent=categoryName(addCategoryId)||'分類を選択';
  renderCategoryPanel();
  clearFieldErrors();
  updateTimeLabel();
}
function saveMenu(){
  const name=$('menuName').value.trim();
  const minuteValue=$('menuMinutes').value;
  const secondValue=$('menuSecondsPart').value;
  const minutes=Number(minuteValue||0);
  const secondsPart=Number(secondValue||0);
  clearFieldErrors();
  const errors=[];
  if(!name){setFieldError('menuName','menuNameError','名前を入力してください');errors.push('menuName')}
  if(!addCategoryId){setFieldError('addCategoryBtn','menuCategoryError','分類を選択してください');errors.push('addCategoryBtn')}
  if(minuteValue!==''&&(!Number.isInteger(minutes)||minutes<0)){setFieldError('menuMinutes','menuMinutesError','分は0以上の整数で入力してください');errors.push('menuMinutes')}
  if(secondValue!==''&&(!Number.isInteger(secondsPart)||secondsPart<0||secondsPart>59)){setFieldError('menuSecondsPart','menuSecondsError','秒は0〜59の整数で入力してください');errors.push('menuSecondsPart')}
  if(errors.length){$(errors[0]).focus();return}
  const seconds=minutes*60+secondsPart;
  const data={name,categoryId:addCategoryId,seconds,requiresSets:!fixedMode()};
  const menuId=editingMenuId;
  const editingMenu=menuId?findMenu(menuId):null;
  if(menuId&&!editingMenu){showToast('編集対象が見つかりません。画面を開き直してください。',{error:true});return}
  const saved=mutateAndSave(()=>{
    if(editingMenu)Object.assign(editingMenu,data);
    else state.menus.push({id:uid('menu'),order:state.menus.length,...data});
  });
  if(!saved){showSaveError();return}
  const message=editingMenu?'メニューを保存しました':'メニューを追加しました';
  resetAddForm();
  showScreen('list');
  showToast(message);
}
function renderCategoryListScreen(){
  const list=$('categoryList');
  list.innerHTML='';
  $('categoryEditToggle').textContent=categoryEditMode?'完了':'編集';
  $('categoryEditToggle').setAttribute('aria-pressed',String(categoryEditMode));
  const addButton=document.createElement('button');
  addButton.className='list-card add-list-card';
  addButton.innerHTML='<div><h3>＋ 分類を追加</h3></div><span class="chevron" aria-hidden="true">›</span>';
  addButton.addEventListener('click',addCategoryFromList);
  list.appendChild(addButton);
  if(!state.categories.length){list.insertAdjacentHTML('beforeend','<div class="empty">分類がありません</div>');return}
  state.categories.forEach(category=>{
    const used=state.menus.filter(menu=>menu.categoryId===category.id).length;
    const card=document.createElement(categoryEditMode?'div':'button');
    card.className='list-card category-card'+(categoryEditMode?' reorder-card':'');
    card.dataset.categoryId=category.id;
    card.innerHTML=`<div><h3>${escapeHTML(category.name)}</h3><p>登録メニュー ${used}件</p></div>${categoryEditMode?`<div class="list-actions"><button type="button" class="drag-handle" data-cat-handle="${category.id}" aria-label="「${escapeHTML(category.name)}」を並び替え">☰</button><button type="button" class="mini-btn delete" data-cat-delete="${category.id}">削除</button></div>`:'<span class="chevron" aria-hidden="true">›</span>'}`;
    if(!categoryEditMode){card.type='button';card.addEventListener('click',()=>openCategoryEditor(category.id,card))}
    list.appendChild(card);
  });
  if(categoryEditMode){
    setupCategoryDrag(list);
    list.querySelectorAll('[data-cat-delete]').forEach(button=>button.addEventListener('click',()=>deleteCategory(button.dataset.catDelete)));
  }
}
function addCategoryFromList(){
  const name=prompt('新しい分類名を入力してください');
  if(!name?.trim())return;
  const category={id:uid('cat'),name:name.trim()};
  if(!mutateAndSave(()=>state.categories.push(category))){showSaveError();return}
  addCategoryId=category.id;
  renderCategoryListScreen();
  renderCreateScreen();
  renderListScreen();
  showToast('分類を追加しました');
}
function openCategoryEditor(id,card){
  const category=state.categories.find(item=>item.id===id);
  if(!category)return;
  card.outerHTML=`<form class="category-editor" data-category-editor="${id}"><label class="sr-only" for="categoryName-${id}">分類名</label><input class="text-input" id="categoryName-${id}" value="${escapeHTML(category.name)}"><div class="list-actions"><button type="button" class="secondary" data-category-cancel>キャンセル</button><button type="submit" class="primary">保存</button></div></form>`;
  const form=$('categoryList').querySelector(`[data-category-editor="${id}"]`);
  const input=form.querySelector('input');
  input.focus();input.select();
  form.querySelector('[data-category-cancel]').addEventListener('click',renderCategoryListScreen);
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const name=input.value.trim();
    if(!name){input.setAttribute('aria-invalid','true');return}
    if(!mutateAndSave(()=>{category.name=name})){showSaveError();renderCategoryListScreen();return}
    renderCategoryListScreen();renderCreateScreen();renderListScreen();showToast('分類名を保存しました');
  });
}
function deleteCategory(id){
  const category=state.categories.find(item=>item.id===id);
  if(!category)return;
  const used=state.menus.filter(menu=>menu.categoryId===id).length;
  if(used>0){showToast('この分類にはメニューが登録されているため削除できません',{error:true,duration:5000});return}
  const index=state.categories.findIndex(item=>item.id===id);
  if(!mutateAndSave(()=>{state.categories.splice(index,1)})){showSaveError();return}
  if(addCategoryId===id)addCategoryId=state.categories[0]?.id||'';
  if(createCategory===id)createCategory='all';
  if(listCategory===id)listCategory='all';
  renderCategoryListScreen();
  renderCreateScreen();
  renderListScreen();
  pendingUndo={type:'category',item:clone(category),index};
  showToast(`「${category.name}」を削除しました`,{duration:5000,undo:()=>{
    const undo=pendingUndo;if(!undo||undo.type!=='category')return;
    if(!mutateAndSave(()=>state.categories.splice(Math.min(undo.index,state.categories.length),0,undo.item))){showSaveError();return}
    pendingUndo=null;renderCategoryListScreen();renderCreateScreen();renderListScreen();showToast('分類を元に戻しました');
  }});
}
function setupCategoryDrag(list){
  list.querySelectorAll('[data-cat-handle]').forEach(handle=>{
    handle.addEventListener('pointerdown',event=>startCategoryDrag(event,list));
    handle.addEventListener('keydown',event=>{if(!['ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();moveCategory(handle.dataset.catHandle,event.key==='ArrowUp'?-1:1,true)});
  });
}
function startCategoryDrag(event,list){
  if(activeCategoryDrag||event.button!==0)return;
  const handle=event.currentTarget,card=handle.closest('[data-category-id]');if(!card)return;
  event.preventDefault();handle.setPointerCapture?.(event.pointerId);
  activeCategoryDrag={pointerId:event.pointerId,sourceId:card.dataset.categoryId,targetId:null,position:null,handle,card,list};
  card.classList.add('dragging');document.body.classList.add('is-dragging');
  document.addEventListener('pointermove',updateCategoryDrag,{passive:false});document.addEventListener('pointerup',finishCategoryDrag);document.addEventListener('pointercancel',cancelCategoryDrag);
}
function updateCategoryDrag(event){
  if(!activeCategoryDrag||event.pointerId!==activeCategoryDrag.pointerId)return;event.preventDefault();clearDragTargets(activeCategoryDrag.list);
  const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('.category-card[data-category-id]');
  if(!target||target.dataset.categoryId===activeCategoryDrag.sourceId){activeCategoryDrag.targetId=null;return}
  const rect=target.getBoundingClientRect(),position=event.clientY<rect.top+rect.height/2?'before':'after';target.classList.add(position==='before'?'drop-before':'drop-after');activeCategoryDrag.targetId=target.dataset.categoryId;activeCategoryDrag.position=position;
}
function finishCategoryDrag(event){if(!activeCategoryDrag||event.pointerId!==activeCategoryDrag.pointerId)return;const{sourceId,targetId,position}=activeCategoryDrag;cleanupCategoryDrag();if(targetId&&position)moveCategoryRelative(sourceId,targetId,position)}
function cancelCategoryDrag(event){if(activeCategoryDrag&&event.pointerId===activeCategoryDrag.pointerId)cleanupCategoryDrag()}
function cleanupCategoryDrag(){if(!activeCategoryDrag)return;clearDragTargets(activeCategoryDrag.list);activeCategoryDrag.card.classList.remove('dragging');document.body.classList.remove('is-dragging');document.removeEventListener('pointermove',updateCategoryDrag);document.removeEventListener('pointerup',finishCategoryDrag);document.removeEventListener('pointercancel',cancelCategoryDrag);activeCategoryDrag=null}
function moveCategoryRelative(sourceId,targetId,position){
  const from=state.categories.findIndex(item=>item.id===sourceId),target=state.categories.findIndex(item=>item.id===targetId);if(from<0||target<0)return;
  const next=state.categories.slice(),[item]=next.splice(from,1);let to=next.findIndex(entry=>entry.id===targetId)+(position==='after'?1:0);next.splice(to,0,item);
  if(!mutateAndSave(()=>{state.categories=next})){showSaveError();return}renderCategoryListScreen();renderCreateScreen();renderListScreen();$('categoryReorderStatus').textContent=`${item.name}を${to+1}番目に移動しました`;
}
function moveCategory(id,direction,restoreFocus=false){const from=state.categories.findIndex(item=>item.id===id),to=from+direction;if(from<0||to<0||to>=state.categories.length)return;const next=state.categories.slice();[next[from],next[to]]=[next[to],next[from]];if(!mutateAndSave(()=>{state.categories=next})){showSaveError();return}renderCategoryListScreen();renderCreateScreen();renderListScreen();$('categoryReorderStatus').textContent=`${next[to].name}を${to+1}番目に移動しました`;if(restoreFocus)requestAnimationFrame(()=>document.querySelector(`[data-cat-handle="${id}"]`)?.focus())}
async function renderHistoryScreen(){
  const token=++historyRenderToken,list=$('historyList');
  if(!list)return;
  closeHistoryPreview();
  revokeHistoryObjectUrls();
  $('historyEditToggle').textContent=historyEditMode?'完了':'編集';
  $('historyEditToggle').setAttribute('aria-pressed',String(historyEditMode));
  list.innerHTML='<div class="empty">読み込み中…</div>';
  const hist=await getHistoryRecords();
  if(token!==historyRenderToken)return;
  state.history=hist.map(({blob,...rest})=>rest);
  list.innerHTML='';
  if(!hist.length){list.innerHTML='<div class="empty"><p>履歴がありません</p><button type="button" class="secondary empty-action">メニュー表を作成</button></div>';list.querySelector('button').addEventListener('click',()=>showScreen('create'));return}
  hist.slice().reverse().forEach(item=>{
    const title=item.title||'メニュー表';
    const imgUrl=item.blob?blobToObjectUrl(item.blob):item.dataUrl;
    if(item.blob)historyObjectUrls.push(imgUrl);
    const card=document.createElement('article');
    card.className='history-card';
    card.innerHTML=`<button class="history-open" type="button" aria-label="${escapeHTML(title)}を開く"><span class="history-thumb"><img alt=""></span><span class="history-card-content"><strong>${escapeHTML(title)}</strong><small>${new Date(item.createdAt).toLocaleString('ja-JP')}</small></span><span class="chevron" aria-hidden="true">›</span></button>${historyEditMode?`<button class="mini-btn delete history-delete" type="button" data-history-delete="${item.id}">削除</button>`:''}`;
    card.querySelector('img').src=imgUrl;
    card.querySelector('.history-open').addEventListener('click',event=>openHistoryPreview(item,imgUrl,event.currentTarget));
    card.querySelector('[data-history-delete]')?.addEventListener('click',event=>openDeleteModal(item.id,event.currentTarget));
    list.appendChild(card);
  });
}
function openHistoryPreview(item,imgUrl,trigger){modalReturnFocus=trigger||document.activeElement;historyPreviewId=item.id;$('historyPreviewTitle').textContent=item.title||'メニュー表';$('historyPreviewImg').src=imgUrl;$('historyPreviewWrap').classList.add('open');$('closeHistoryPreview').focus()}
function closeHistoryPreview(){const wrap=$('historyPreviewWrap');if(!wrap)return;const wasOpen=wrap.classList.contains('open');wrap.classList.remove('open');historyPreviewId='';if(wasOpen&&modalReturnFocus?.isConnected)modalReturnFocus.focus();modalReturnFocus=null}
async function addHistoryImage(){if(!lastImageDataUrl||lastPreviewHistorySaved)return true;const blob=lastHistoryBlob||dataURLToBlob(lastHistoryDataUrl||lastImageDataUrl);const item={id:uid('hist'),title:lastImageTitle||currentSheetTitle||'メニュー表',createdAt:new Date().toISOString(),type:blob.type||lastHistoryType||'image/jpeg',blob};const saved=await putHistoryRecord(item);if(saved)lastPreviewHistorySaved=true;return saved}
async function downloadHistoryImage(id){const hist=await getHistoryRecords();const item=hist.find(h=>h.id===id);if(!item)return;const objectUrl=item.blob?blobToObjectUrl(item.blob):'';triggerDownload(objectUrl||item.dataUrl,uniqueImageFileName(item.title,historyExt(item)));if(objectUrl)setTimeout(()=>URL.revokeObjectURL(objectUrl),1000)}
async function deleteHistoryImage(id){const deleted=await deleteHistoryRecord(id);closeDeleteModal();if(!deleted){showToast('履歴を削除できませんでした。再試行してください。',{error:true});return}closeHistoryPreview();await renderHistoryScreen();showToast('履歴を削除しました')}
function renderListScreen(){
  renderCategoryChips($('categoryChips'),listCategory,id=>{listCategory=id;renderListScreen()},true);
  const toggle=$('reorderToggle');
  toggle.textContent=reorderMode?'完了':'編集';
  toggle.classList.toggle('active',reorderMode);
  toggle.setAttribute('aria-pressed',String(reorderMode));
  $('reorderHint').hidden=!reorderMode;
  const list=$('menuList');
  const menus=sortedMenus(state.menus.filter(menu=>listCategory==='all'||menu.categoryId===listCategory));
  $('listCount').textContent=`${menus.length}件`;
  list.innerHTML='';
  if(!menus.length){list.innerHTML='<div class="empty"><p>メニューがありません</p><button type="button" class="secondary empty-action">メニューを追加</button></div>';list.querySelector('button').addEventListener('click',()=>{resetAddForm();showScreen('add')});return}
  menus.forEach(menu=>{
    const card=document.createElement(reorderMode?'div':'button');
    const mode=menu.requiresSets?`${formatCompactSeconds(menu.seconds)} / セットあり`:`${formatCompactSeconds(menu.seconds)} / 1回のみ`;
    const siblings=sortedMenus(state.menus.filter(item=>item.categoryId===menu.categoryId));
    const actions=reorderMode
      ? `<button type="button" class="drag-handle" data-drag-handle="${menu.id}" aria-label="「${escapeHTML(menu.name)}」を並び替え" title="ドラッグして並び替え" ${siblings.length<2?'disabled':''}>☰</button><button type="button" class="mini-btn delete" data-delete="${menu.id}">削除</button>`
      : '<span class="chevron" aria-hidden="true">›</span>';
    card.className='list-card'+(reorderMode?' reorder-card':'');
    if(!reorderMode)card.type='button';
    card.dataset.menuId=menu.id;
    card.dataset.categoryId=menu.categoryId;
    card.innerHTML=`<div><h3>${escapeHTML(menu.name)}</h3><p>${escapeHTML(categoryName(menu.categoryId))} / ${mode}</p></div><div class="list-actions">${actions}</div>`;
    if(!reorderMode)card.addEventListener('click',()=>{editingMenuId=menu.id;showScreen('add')});
    list.appendChild(card);
  });
  if(reorderMode){
    setupMenuDrag(list);
    list.querySelectorAll('[data-delete]').forEach(button=>button.addEventListener('click',()=>deleteMenu(button.dataset.delete)));
  }
}
function setupMenuDrag(list){
  list.querySelectorAll('[data-drag-handle]').forEach(handle=>{
    handle.addEventListener('pointerdown',event=>startMenuDrag(event,list));
    handle.addEventListener('keydown',event=>{
      if(event.key!=='ArrowUp'&&event.key!=='ArrowDown')return;
      event.preventDefault();
      moveMenu(handle.dataset.dragHandle,event.key==='ArrowUp'?-1:1,true);
    });
  });
}
function startMenuDrag(event,list){
  if(activeDrag||event.button!==0)return;
  const handle=event.currentTarget;
  const card=handle.closest('[data-menu-id]');
  if(!card)return;
  event.preventDefault();
  handle.setPointerCapture?.(event.pointerId);
  activeDrag={
    pointerId:event.pointerId,
    sourceId:card.dataset.menuId,
    categoryId:card.dataset.categoryId,
    targetId:null,
    position:null,
    handle,
    card,
    list
  };
  card.classList.add('dragging');
  document.body.classList.add('is-dragging');
  document.addEventListener('pointermove',updateMenuDrag,{passive:false});
  document.addEventListener('pointerup',finishMenuDrag);
  document.addEventListener('pointercancel',cancelMenuDrag);
}
function updateMenuDrag(event){
  if(!activeDrag||event.pointerId!==activeDrag.pointerId)return;
  event.preventDefault();
  const listRect=activeDrag.list.getBoundingClientRect();
  if(event.clientY<listRect.top+44)activeDrag.list.scrollTop-=12;
  else if(event.clientY>listRect.bottom-44)activeDrag.list.scrollTop+=12;
  clearDragTargets(activeDrag.list);
  const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('.list-card[data-menu-id]');
  if(!target||target.dataset.menuId===activeDrag.sourceId||target.dataset.categoryId!==activeDrag.categoryId){
    activeDrag.targetId=null;
    activeDrag.position=null;
    return;
  }
  const rect=target.getBoundingClientRect();
  const position=event.clientY<rect.top+rect.height/2?'before':'after';
  target.classList.add(position==='before'?'drop-before':'drop-after');
  activeDrag.targetId=target.dataset.menuId;
  activeDrag.position=position;
}
function finishMenuDrag(event){
  if(!activeDrag||event.pointerId!==activeDrag.pointerId)return;
  const {sourceId,targetId,position}=activeDrag;
  cleanupMenuDrag();
  if(targetId&&position)moveMenuRelative(sourceId,targetId,position);
}
function cancelMenuDrag(event){
  if(!activeDrag||event.pointerId!==activeDrag.pointerId)return;
  cleanupMenuDrag();
}
function cleanupMenuDrag(){
  if(!activeDrag)return;
  clearDragTargets(activeDrag.list);
  activeDrag.card.classList.remove('dragging');
  if(activeDrag.handle.hasPointerCapture?.(activeDrag.pointerId))activeDrag.handle.releasePointerCapture(activeDrag.pointerId);
  document.body.classList.remove('is-dragging');
  document.removeEventListener('pointermove',updateMenuDrag);
  document.removeEventListener('pointerup',finishMenuDrag);
  document.removeEventListener('pointercancel',cancelMenuDrag);
  activeDrag=null;
}
function clearDragTargets(list){
  list.querySelectorAll('.drop-before,.drop-after').forEach(card=>card.classList.remove('drop-before','drop-after'));
}
function moveMenuRelative(menuId,targetId,position){
  const menu=findMenu(menuId);
  const target=findMenu(targetId);
  if(!menu||!target||menu.id===target.id||menu.categoryId!==target.categoryId)return;
  const siblings=sortedMenus(state.menus.filter(item=>item.categoryId===menu.categoryId));
  const originalIds=siblings.map(item=>item.id);
  const ids=originalIds.filter(id=>id!==menuId);
  let insertIndex=ids.indexOf(targetId);
  if(insertIndex<0)return;
  if(position==='after')insertIndex+=1;
  ids.splice(insertIndex,0,menuId);
  if(ids.every((id,index)=>id===originalIds[index]))return;
  if(!mutateAndSave(()=>ids.forEach((id,index)=>{const item=findMenu(id);if(item)item.order=index}))){showSaveError();return}
  renderListScreen();
  $('reorderStatus').textContent=`${menu.name}を${insertIndex+1}番目に移動しました`;
}
function moveMenu(menuId,direction,restoreFocus=false){
  const menu=findMenu(menuId);
  if(!menu)return;
  const siblings=sortedMenus(state.menus.filter(item=>item.categoryId===menu.categoryId));
  const from=siblings.findIndex(item=>item.id===menuId);
  const to=from+direction;
  if(from<0||to<0||to>=siblings.length)return;
  const ids=siblings.map(item=>item.id);
  [ids[from],ids[to]]=[ids[to],ids[from]];
  if(!mutateAndSave(()=>ids.forEach((id,index)=>{const item=findMenu(id);if(item)item.order=index}))){showSaveError();return}
  renderListScreen();
  $('reorderStatus').textContent=`${menu.name}を${to+1}番目に移動しました`;
  if(restoreFocus)requestAnimationFrame(()=>document.querySelector(`[data-drag-handle="${menuId}"]`)?.focus());
}
function openDeleteModal(id,trigger){
  deleteTargetId=id;
  modalReturnFocus=trigger||document.activeElement;
  $('confirmText').textContent='削除した画像は元に戻せません。';
  $('confirmModal').classList.add('open');
  $('cancelDelete').focus();
}
function closeDeleteModal(){
  const wasOpen=$('confirmModal').classList.contains('open');
  $('confirmModal').classList.remove('open');
  deleteTargetId=null;
  if(wasOpen&&modalReturnFocus?.isConnected)modalReturnFocus.focus();
  modalReturnFocus=null;
}
function deleteMenu(id){
  const index=state.menus.findIndex(menu=>menu.id===id),menu=state.menus[index];if(index<0||!menu)return;
  if(!mutateAndSave(()=>{state.menus.splice(index,1)})){showSaveError();return}
  selectedMenuIds=selectedMenuIds.filter(menuId=>menuId!==id);
  setPlan=setPlan.filter(row=>row.menuId!==id);
  renderListScreen();
  renderCreateScreen();
  pendingUndo={type:'menu',item:clone(menu),index};
  showToast(`「${menu.name}」を削除しました`,{duration:5000,undo:()=>{
    const undo=pendingUndo;if(!undo||undo.type!=='menu')return;
    if(!mutateAndSave(()=>state.menus.splice(Math.min(undo.index,state.menus.length),0,undo.item))){showSaveError();return}
    pendingUndo=null;renderListScreen();renderCreateScreen();showToast('メニューを元に戻しました');
  }});
}
function exportImage(){const t=calcTotals();if(t.noPeople)return;const rows=setPlan.map(r=>({row:r,menu:findMenu(r.menuId)})).filter(x=>x.menu),w=1080,rowH=72,tableY=t.mismatch?350:305,h=Math.max(860,tableY+rows.length*rowH+100),c=document.createElement('canvas');c.width=w;c.height=h;const showTime=$('showImageTime').checked,solo=selectedPeople.length===1&&selectedPeople[0]===1;const ctx=c.getContext('2d'),peopleSummary=selectedPeople.map(p=>`${p}人：${t.byPerson[p].peopleSets}人set`).join('　'),timeSummary=selectedPeople.map(p=>`${p}人：${formatSeconds(t.byPerson[p].seconds)}`).join('　');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);drawText(ctx,'#17823b','800 34px sans-serif','練習メニュー表',60,70,960);drawText(ctx,'#16201a','900 54px sans-serif',currentSheetTitle,60,145,960);drawText(ctx,'#6a756f','800 24px sans-serif',solo?`セット数: ${t.byPerson[1].rawSets} set`:`合計人set　${peopleSummary}`,60,195,960);drawText(ctx,'#6a756f','800 24px sans-serif',solo?`所要時間: ${formatSeconds(t.byPerson[1].seconds)}`:`所要時間　${timeSummary}`,60,235,960);if(t.mismatch)drawText(ctx,'#d94141','900 24px sans-serif','注意：人数パターンごとに、メニュー別の人setが一致していません。',60,285,960);let y=tableY;drawText(ctx,'#6a756f','800 24px sans-serif','No.',60,y);drawText(ctx,'#6a756f','800 24px sans-serif','メニュー',145,y);const colXs=selectedPeople.length===1?[showTime?720:820]:showTime?[590,815]:[720,880];selectedPeople.forEach((p,idx)=>drawText(ctx,'#6a756f','800 24px sans-serif',`${p}人`,colXs[idx],y,120));y+=26;ctx.strokeStyle='#dce6df';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(60,y);ctx.lineTo(1020,y);ctx.stroke();y+=48;rows.forEach((x,i)=>{const{row,menu}=x;ctx.fillStyle=i%2?'#f7faf8':'#fff';ctx.fillRect(50,y-36,980,rowH);drawText(ctx,'#17823b','900 28px sans-serif',String(i+1),70,y+10,50);drawText(ctx,'#16201a','900 30px sans-serif',menu.name,145,y+10,colXs[0]-165);if(menu.requiresSets)selectedPeople.forEach((p,idx)=>drawText(ctx,'#16201a',showTime?'700 22px sans-serif':'900 30px sans-serif',showTime?`${formatSeconds(menu.seconds).replace(' ','')} × ${getSets(row,p)}set`:`${getSets(row,p)} set`,colXs[idx],y+10,showTime?(selectedPeople.length===1?300:205):120));else drawText(ctx,'#6a756f','800 26px sans-serif',`1回 ${formatCompactSeconds(menu.seconds)}`,colXs[0],y+10,selectedPeople.length===1?180:250);y+=rowH});lastImageDataUrl=c.toDataURL('image/png');lastHistoryDataUrl=c.toDataURL('image/jpeg',0.82);lastHistoryBlob=dataURLToBlob(lastHistoryDataUrl);lastHistoryType='image/jpeg';lastImageTitle=currentSheetTitle;lastPreviewHistorySaved=false;$('addHistoryOnSave').checked=true;$('previewImg').src=lastImageDataUrl;previewReturnFocus=document.activeElement;$('previewWrap').classList.add('open');$('closePreviewTop').focus()}
function fitText(ctx,text,maxWidth){const value=String(text);if(!maxWidth||ctx.measureText(value).width<=maxWidth)return value;let end=value.length;while(end>0&&ctx.measureText(`${value.slice(0,end)}…`).width>maxWidth)end-=1;return `${value.slice(0,end)}…`}function drawText(ctx,color,font,text,x,y,maxWidth){ctx.fillStyle=color;ctx.font=font;ctx.fillText(fitText(ctx,text,maxWidth),x,y)}
function closePreview(){const wrap=$('previewWrap'),wasOpen=wrap.classList.contains('open');wrap.classList.remove('open');if(wasOpen&&previewReturnFocus?.isConnected)previewReturnFocus.focus();previewReturnFocus=null}
async function downloadImage(){
  if(!lastImageDataUrl)return;
  const button=$('downloadImage');button.disabled=true;
  triggerDownload(lastImageDataUrl,uniqueImageFileName(currentSheetTitle,'png'));
  if($('addHistoryOnSave').checked&&!lastPreviewHistorySaved){
    const saved=await addHistoryImage();
    showToast(saved?'画像を保存し、履歴に追加しました':'画像は保存しましたが、履歴に追加できませんでした',{error:!saved,duration:5000});
  }else showToast('画像を保存しました');
  button.disabled=false;
}
document.querySelectorAll('[data-go]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.go==='add')resetAddForm();showScreen(button.dataset.go)}));
$('addCategoryBtn').addEventListener('click',event=>{event.stopPropagation();$('addCategoryPanel').classList.toggle('open')});
document.addEventListener('click',event=>{if(!event.target.closest('.field-block'))closeDropdowns()});
$('startSetBtn').addEventListener('click',startSetSelection);
$('methodSets').addEventListener('click',()=>{setFixedSwitch(false);updateTimeLabel()});
$('methodOnce').addEventListener('click',()=>{setFixedSwitch(true);updateTimeLabel()});
$('saveMenuBtn').addEventListener('click',saveMenu);
$('exportImageBtn').addEventListener('click',exportImage);
$('cancelDelete').addEventListener('click',closeDeleteModal);
$('confirmDelete').addEventListener('click',()=>{if(deleteTargetId)deleteHistoryImage(deleteTargetId)});
$('closePreview').addEventListener('click',closePreview);
$('closePreviewTop').addEventListener('click',closePreview);
$('downloadImage').addEventListener('click',downloadImage);
$('closeHistoryPreview').addEventListener('click',closeHistoryPreview);
$('closeHistoryPreviewBottom').addEventListener('click',closeHistoryPreview);
$('downloadHistoryPreview').addEventListener('click',()=>{if(historyPreviewId)downloadHistoryImage(historyPreviewId)});
$('historyPreviewWrap').addEventListener('click',event=>{if(event.target===$('historyPreviewWrap'))closeHistoryPreview()});
$('previewWrap').addEventListener('click',event=>{if(event.target===$('previewWrap'))closePreview()});
document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if($('confirmModal').classList.contains('open'))closeDeleteModal();else if($('historyPreviewWrap').classList.contains('open'))closeHistoryPreview();else if($('previewWrap').classList.contains('open'))closePreview()});
$('reorderToggle').addEventListener('click',()=>{if(activeDrag)cleanupMenuDrag();reorderMode=!reorderMode;renderListScreen()});
$('categoryEditToggle').addEventListener('click',()=>{if(activeCategoryDrag)cleanupCategoryDrag();categoryEditMode=!categoryEditMode;renderCategoryListScreen()});
$('historyEditToggle').addEventListener('click',()=>{historyEditMode=!historyEditMode;renderHistoryScreen()});
$('menuAddTopBtn').addEventListener('click',()=>{resetAddForm();showScreen('add')});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(error=>console.warn('Service Worker の登録に失敗しました',error)));
renderCreateScreen();
renderAddScreen();
renderListScreen();
renderCategoryListScreen();
})();
