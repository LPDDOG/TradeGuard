const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const source = fs.readFileSync('assets/orders.js', 'utf8');
function boot(storage = new Map(), failWrite = false) {
  const ctx = vm.createContext({ crypto, localStorage: { getItem: k => storage.get(k) ?? null, setItem(k, v) { if (failWrite) throw Error('quota'); storage.set(k, v); } } });
  vm.runInContext(source, ctx);
  return vm.runInContext('OrderStore', ctx);
}
const input = { name: '测试虚构客户', country: '中国', amount: '12345.67', payment: 'L/C', years: '0', overdue: '0', date: '2026-01-01', notes: '测试备注' };
test('首次加载18条演示数据，新增、编辑、删除在刷新后保留；空列表不重新填充', () => {
  const storage = new Map();
  let store = boot(storage);
  assert.equal(store.getAll().length, 18);
  const added = store.save(input);
  assert.equal(boot(storage).getAll().length, 19);
  store.save({ ...input, amount: '765.43', years: '3', notes: '已修改' }, added.id);
  store = boot(storage);
  assert.equal(store.getAll().find(o => o.id === added.id).amount, 765.43);
  assert.equal(store.getAll().find(o => o.id === added.id).years, 3);
  store.remove(added.id);
  assert.equal(boot(storage).getAll().length, 18);
  for (const order of store.getAll()) store.remove(order.id);
  assert.equal(boot(storage).getAll().length, 0);
});
test('金额、整数、日期、必填及长度验证', () => {
  const store = boot();
  for (const patch of [{ amount: -1 }, { amount: '' }, { amount: 'Infinity' }, { amount: '1.001' }, { amount: '1.00001' }, { years: -1 }, { years: 1.5 }, { overdue: '' }, { overdue: -1 }, { date: '2026-02-30' }, { date: '2099-01-01' }, { date: '' }, { name: '   ' }, { country: '' }, { payment: '未知' }, { notes: 'x'.repeat(1001) }]) assert.throws(() => store.save({ ...input, ...patch }));
  assert.equal(store.validate({ ...input, amount: 0 }).amount, 0);
  assert.equal(store.validate({ ...input, date: '2024-02-29' }).date, '2024-02-29');
});
test('搜索忽略大小写、匹配备注，组合筛选与不存在的订单处理', () => {
  const store = boot();
  assert.equal(store.filter({ query: 'northSTAR' }).length, 1);
  assert.equal(store.filter({ query: '虚构演示数据' }).length, 18);
  assert.equal(store.filter({ country: '英国', payment: '100% T/T 预付' }).length, 1);
  assert.equal(store.filter({ query: '不存在的客户' }).length, 0);
  assert.throws(() => store.save(input, 'missing'));
  assert.throws(() => store.remove('missing'));
});
test('拒绝微小多位小数与非十进制金额，保留合法分币', () => {
  const store = boot();
  for (const amount of ['0.0000000001', '100.0000000001', '1e3', '0x10', true, '1.999']) assert.throws(() => store.validate({ ...input, amount }));
  for (const amount of ['0.01', '.50', '1000000000000', '999999999999.99']) assert.equal(store.validate({ ...input, amount }).amount, Number(amount));
});
test('检测其他标签页已更新，拒绝用旧列表覆盖；刷新后可继续', () => {
  const storage = new Map();
  const first = boot(storage);
  const stale = boot(storage);
  const order = first.save(input);
  assert.throws(() => stale.save({ ...input, name: '旧页面新增' }), /其他页面更新/);
  assert.throws(() => stale.remove(stale.getAll()[0].id), /其他页面更新/);
  assert.throws(() => stale.importBatch([{ ...input, id: 'STALE-IMPORT' }]), /其他页面更新/);
  assert.equal(boot(storage).getAll().length, 19);
  assert.equal(boot(storage).getAll().find(o => o.id === order.id).name, input.name);
  boot(storage).save({ ...input, name: '刷新后新增' });
  assert.equal(boot(storage).getAll().length, 20);
});
test('存储写入失败不修改内存；损坏数据不被自动覆盖', () => {
  const storage = new Map();
  boot(storage);
  const store = boot(storage, true);
  assert.throws(() => store.save(input), /保存失败/);
  assert.throws(() => store.remove(store.getAll()[0].id), /保存失败/);
  assert.equal(store.getAll().length, 18);
  const corrupted = new Map([['tradeguard.orders.v1', '{bad json']]);
  const damaged = boot(corrupted);
  assert.match(damaged.getWarning(), /无法读取/);
  assert.throws(() => damaged.save(input));
  assert.equal(corrupted.get('tradeguard.orders.v1'), '{bad json');
});
test('页面渲染、统计更新及用户输入转义', () => {
  const nodes = new Map();
  const element = id => { if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', addEventListener() {}, setAttribute() {}, focus() {} }); return nodes.get(id); };
  const storage = new Map();
  const ctx = vm.createContext({ crypto, Intl, URLSearchParams, setTimeout, clearTimeout, location: { hash: '' }, localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v) }, document: { getElementById: element, querySelectorAll: () => [], addEventListener() {}, body: { classList: { remove() {} } } }, window: { addEventListener() {} } });
  for (const file of ['assets/orders.js', 'assets/risk.js', 'assets/app.js', 'assets/risk-ui.js', 'assets/dashboard.js', 'assets/csv.js', 'assets/data-ui.js', 'assets/order-ui.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
  for (const page of ['dashboard', 'orders', 'assessment', 'reports', 'rules', 'about', 'invalid']) { ctx.location.hash = '#' + page; vm.runInContext('render()', ctx); assert.ok(element('main').innerHTML.length > 100); }
  ctx.location.hash = '#dashboard';
  vm.runInContext(`OrderStore.save(${JSON.stringify({ ...input, name: '<img src=x onerror=alert(1)>', amount: 100 })}); render()`, ctx);
  assert.match(element('main').innerHTML, /19<span>笔/);
  assert.equal(vm.runInContext("orderTable().includes('<img src=x')", ctx), false);
  assert.equal(vm.runInContext("orderTable().includes('&lt;img')", ctx), true);
  vm.runInContext('OrderStore.remove(OrderStore.getAll()[0].id); render()', ctx);
  assert.match(element('main').innerHTML, /18<span>笔/);
});
