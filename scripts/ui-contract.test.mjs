import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const [html,css,app,worker]=await Promise.all([
  readFile(new URL('../index.html',import.meta.url),'utf8'),
  readFile(new URL('../styles.css',import.meta.url),'utf8'),
  readFile(new URL('../app.js',import.meta.url),'utf8'),
  readFile(new URL('../sw.js',import.meta.url),'utf8')
]);

test('keeps the three-step flow and accessible inline errors',()=>{
  assert.match(html,/1 メニュー/);
  assert.match(html,/2 セット/);
  assert.match(html,/3 出力/);
  assert.match(html,/id="menuName"[^>]+aria-describedby="menuNameError"/);
  assert.match(html,/id="menuMinutes"[^>]+aria-describedby="menuMinutesError"/);
  assert.match(html,/id="menuSecondsPart"[^>]+aria-describedby="menuSecondsError"/);
  assert.doesNotMatch(`${html}\n${app}`,/固定時間|セット数なし|alert\s*\(/);
});

test('calculates set-based and one-time menu durations correctly',()=>{
  const start=app.indexOf('function calculateTotals');
  const end=app.indexOf('function calcTotals',start);
  assert.ok(start>=0&&end>start,'calculateTotals implementation should be present');
  const context={result:null};
  vm.runInNewContext(`
    function getSets(row,p){return Number(row.sets?.[p]??0)}
    ${app.slice(start,end)}
    result=calculateTotals(
      [4,5],
      [
        {menuId:'sets',sets:{4:2,5:2}},
        {menuId:'once',sets:{4:99,5:99}}
      ],
      [
        {id:'sets',name:'セット練習',seconds:120,requiresSets:true},
        {id:'once',name:'一回練習',seconds:600,requiresSets:false}
      ]
    );
  `,context);
  assert.equal(context.result.byPerson[4].peopleSets,8);
  assert.equal(context.result.byPerson[5].peopleSets,10);
  assert.equal(context.result.byPerson[4].seconds,16*60+10*60);
  assert.equal(context.result.byPerson[5].seconds,20*60+10*60);
  assert.equal(context.result.mismatch,true);
});

test('keeps mobile, safe-area, history, undo, and PWA update contracts',()=>{
  assert.match(css,/max-width:\s*480px/);
  assert.match(css,/max-width:\s*340px/);
  assert.match(css,/safe-area-inset-bottom/);
  assert.match(css,/overflow-x:\s*hidden/);
  assert.match(app,/duration:5000,undo:/);
  assert.match(app,/addHistoryOnSave/);
  assert.match(app,/URL\.revokeObjectURL/);
  assert.match(worker,/training-menu-pwa-v20260909-layout-7/);
  assert.match(worker,/skipWaiting\(\)/);
  assert.match(worker,/clients\.claim\(\)/);
});

test('category changes preserve unsaved menu fields',()=>{
  const source=app.slice(app.indexOf('function renderAddScreen('),app.indexOf('function saveMenu('));
  for(const editingMenuId of [null,'existing']){
    const fields={menuName:{value:'入力中'},menuMinutes:{value:'7'},menuSecondsPart:{value:'30'},addTitle:{},saveMenuBtn:{}};
    const context={editingMenuId,addCategoryId:'new-category',findMenu:()=>({name:'保存済み',seconds:60,categoryId:'old-category',requiresSets:true}),$:id=>fields[id],renderCategoryPanel(){},clearFieldErrors(){},updateTimeLabel(){},setFixedSwitch(){}};
    vm.runInNewContext(`${source}\nrenderAddScreen(false);`,context);
    assert.equal(context.addCategoryId,'new-category');
    assert.equal(fields.menuName.value,'入力中');
    assert.equal(fields.menuMinutes.value,'7');
    assert.equal(fields.menuSecondsPart.value,'30');
  }
});

test('editing saves the selected category and follows it in the list',()=>{
  const source=app.slice(app.indexOf('function saveMenu('),app.indexOf('function renderCategoryListScreen('));
  const menu={id:'m',categoryId:'old'};
  const fields={addCategoryBtn:{value:'new'},menuName:{value:'練習'},menuMinutes:{value:'2'},menuSecondsPart:{value:'30'}};
  const context={state:{categories:[{id:'old'},{id:'new'}],menus:[menu]},editingMenuId:'m',listCategory:'old',addCategoryId:'old',$:id=>fields[id],clearFieldErrors(){},fixedMode:()=>false,findMenu:()=>menu,mutateAndSave:fn=>{fn();return true},resetAddForm(){},showScreen(){},showToast(){}};
  vm.runInNewContext(`${source}\nsaveMenu();`,context);
  assert.equal(menu.categoryId,'new');
  assert.equal(menu.seconds,150);
  assert.equal(context.listCategory,'new');
});

test('adding a menu starts in the requested list category',()=>{
  const source=app.slice(app.indexOf('function resetAddForm('),app.indexOf('function renderAddScreen('));
  const context={state:{categories:[{id:'first'},{id:'selected'}]},$:()=>({}),setFixedSwitch(){},clearFieldErrors(){},updateTimeLabel(){}};
  vm.runInNewContext(`${source}\nresetAddForm('selected');`,context);
  assert.equal(context.addCategoryId,'selected');
  vm.runInNewContext("resetAddForm('all');",context);
  assert.equal(context.addCategoryId,'first');
});

test('image time toggle and solo summary render the requested text',()=>{
  const exportSource=app.slice(app.indexOf('function exportImage()'),app.indexOf('function fitText'));
  for(const enabled of [false,true]){
    const labels=[];
    const elements=new Map();
    const context={
      selectedPeople:[1],setPlan:[{menuId:'m',sets:{1:2}}],currentSheetTitle:'テスト',
      calcTotals:()=>({byPerson:{1:{rawSets:2,peopleSets:2,seconds:180}},mismatch:false}),
      findMenu:()=>({name:'練習',seconds:90,requiresSets:true}),
      formatCompactSeconds:s=>s%60?`${Math.floor(s/60)}分 ${s%60}秒`:`${Math.floor(s/60)}分`,getSets:(row,p)=>row.sets[p],formatSeconds:s=>`${Math.floor(s/60)}分 ${s%60}秒`,
      drawText:(_ctx,_color,_font,label)=>labels.push(label),
      dataURLToBlob:()=>({}),
      document:{activeElement:null,createElement:()=>({getContext:()=>new Proxy({},{get:()=>()=>{},set:()=>true}),toDataURL:()=>''})},
      $:id=>{if(!elements.has(id))elements.set(id,{checked:enabled,classList:{add(){}},focus(){}});return elements.get(id)}
    };
    vm.runInNewContext(`${exportSource}\nexportImage();`,context);
    assert.ok(labels.includes('セット数: 2 set'));
    assert.ok(labels.includes('所要時間: 3分 0秒'));
    assert.ok(labels.includes(enabled?'1分30秒 × 2set':'2 set'));
  }
});
