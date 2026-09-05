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
  assert.match(worker,/training-menu-pwa-v20260905-ui-spec-1/);
  assert.match(worker,/skipWaiting\(\)/);
  assert.match(worker,/clients\.claim\(\)/);
});
