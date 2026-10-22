const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const sample = { id: 'TG-CSV-TEST', name: '虚构,客户"甲"', country: '新加坡', amount: 50000.01, payment: 'L/C', years: 2, overdue: 1, date: '2026-01-01', notes: '首行\n第二行,包含"引号"' };
function boot() {
  const storage = new Map(); let fail = false;
  const ctx = vm.createContext({ crypto, localStorage: { getItem: k => storage.get(k) ?? null, setItem(k, v) { if (fail) throw new Error('quota'); storage.set(k, v); } } });
  for (const file of ['orders', 'csv']) vm.runInContext(fs.readFileSync(`assets/${file}.js`, 'utf8'), ctx);
  return { store: vm.runInContext('OrderStore', ctx), csv: vm.runInContext('OrderCSV', ctx), storage, fail: () => { fail = true; } };
}
test('CSV中文、BOM、逗号、引号、换行及文本公式防护可往返', () => {
  const { csv } = boot();
  const text = csv.stringify([sample]);
  assert.equal(text.charCodeAt(0), 0xfeff);
  assert.equal(csv.parse(text)[0].notes, sample.notes);
  assert.equal(csv.parse(text)[0].name, sample.name);
  for (const name of ['=1+1', '+SUM(1,2)', '-2+3', '@SUM(A1)', "'=文本", "''普通单引号"]) {
    const safe = csv.stringify([{ ...sample, name }]);
    assert.ok(safe.includes('"\''));
    assert.equal(csv.parse(safe)[0].name, name);
  }
  assert.equal(csv.parse(text.replace(/\r\n/g, '\n'))[0].amount, 50000.01);
});
test('错误表头、列数、引号、编码提示条件及业务异常拒绝导入', () => {
  const { csv } = boot();
  for (const value of ['', '客户名称,金额\na,1', csv.stringify([]), csv.stringify([sample]).replace('"客户名称"', '"名称"'), csv.stringify([sample]).replace('"50000.01"', '"-1"'), csv.stringify([sample]).replace('"2026-01-01"', '"2026-02-30"'), csv.stringify([sample]).replace('"L/C"', '"未知"'), csv.stringify([sample]).replace('"新加坡"', '"新加坡","多余列"'), '"未闭合', csv.stringify([sample]).replace('"新加坡"', '"新加坡"abc')]) assert.throws(() => csv.parse(value));
  assert.throws(() => csv.parse('a'.repeat(2 * 1024 * 1024 + 1)), /2 MB/);
  assert.throws(() => csv.parse(csv.stringify(Array.from({ length: 2001 }, (_, i) => ({ ...sample, id: `TG-${i}` })))), /2000/);
  assert.throws(() => csv.parse(csv.stringify([sample, sample])), /重复/);
  assert.match(csv.stringify([]), /订单编号/);
});
test('整批追加、自动编号、重复检查、失败不写入及恢复演示', () => {
  const app = boot();
  const before = JSON.stringify(app.store.getAll());
  assert.throws(() => app.store.importBatch([sample, { ...sample, id: 'TG-OTHER', amount: -1 }]));
  assert.equal(JSON.stringify(app.store.getAll()), before);
  assert.throws(() => app.store.importBatch([{ ...sample, id: 'TG-DEMO-001' }]));
  assert.equal(app.store.importBatch(app.csv.parse(app.csv.template())), 1);
  assert.ok(app.store.getAll()[18].id.startsWith('TG-'));
  assert.equal(app.store.importBatch([sample]), 1);
  assert.equal(app.store.getAll().length, 20);
  assert.throws(() => app.store.importBatch([sample]), /重复/);
  app.store.restoreDemo();
  assert.equal(app.store.getAll().length, 18);
  assert.equal(JSON.stringify(app.store.getAll()), before);
  app.fail();
  assert.throws(() => app.store.importBatch([sample]), /保存失败/);
  assert.equal(app.store.getAll().length, 18);
  assert.throws(() => app.store.restoreDemo(), /保存失败/);
});
