const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const files = ['assets/orders.js', 'assets/risk.js', 'assets/app.js', 'assets/risk-ui.js', 'assets/dashboard.js', 'assets/csv.js', 'assets/data-ui.js', 'assets/order-ui.js'];
const base = { name: '虚构测试客户', country: '日本', amount: 100, payment: '100% T/T 预付', years: 3, overdue: 0, date: '2026-01-01', notes: '' };
function boot(storage = new Map()) {
  const nodes = new Map();
  const element = id => { if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', listeners: {}, addEventListener(event, cb) { this.listeners[event] = cb; }, setAttribute() {}, focus() {} }); return nodes.get(id); };
  const ctx = vm.createContext({ crypto, Intl, URLSearchParams, setTimeout, clearTimeout, location: { hash: '' }, localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) }, document: { getElementById: element, querySelectorAll: () => [], addEventListener() {}, body: { classList: { remove() {} } } }, window: { addEventListener() {} } });
  files.forEach(file => vm.runInContext(fs.readFileSync(file, 'utf8'), ctx));
  return { ctx, element, store: vm.runInContext('OrderStore', ctx), engine: vm.runInContext('RiskEngine', ctx), render(hash) { ctx.location.hash = hash; vm.runInContext('render()', ctx); return element('main').innerHTML; } };
}
test('所有金额、年限、逾期边界以及五种付款方式', () => {
  const { engine } = boot();
  for (const [field, cases] of Object.entries({ amount: [[0, 5], [49999.99, 5], [50000, 5], [50000.01, 15], [100000, 15], [100000.01, 25]], years: [[0, 20], [1, 10], [2, 10], [3, 0], [200, 0]], overdue: [[0, 0], [1, 15], [2, 15], [3, 30], [100, 30]], payment: [['100% T/T 预付', 0], ['30% T/T 预付', 15], ['L/C', 10], ['D/P', 25], ['O/A', 35]] })) {
    for (const [value, expected] of cases) assert.equal(engine.evaluate({ ...base, [field]: value }).details.find(d => d.field === field).points, expected, `${field}=${value}`);
  }
  for (const [score, level] of [[0, 'low'], [29, 'low'], [30, 'medium'], [59, 'medium'], [60, 'high'], [100, 'high']]) assert.equal(engine.levelFor(score).key, level);
  assert.throws(() => engine.levelFor(NaN));
  assert.throws(() => engine.levelFor(101));
  assert.throws(() => engine.evaluate({ ...base, payment: '未知方式' }));
});
test('135种组合与独立预期一致；原始110分封顶100分', () => {
  const { engine } = boot();
  for (const [amount, a] of [[50000, 5], [100000, 15], [100001, 25]])
    for (const [payment, p] of [['100% T/T 预付', 0], ['30% T/T 预付', 15], ['L/C', 10], ['D/P', 25], ['O/A', 35]])
      for (const [years, y] of [[0, 20], [2, 10], [3, 0]])
        for (const [overdue, d] of [[0, 0], [2, 15], [3, 30]]) {
          const result = engine.evaluate({ ...base, amount, payment, years, overdue });
          const expected = Math.min(100, a + p + y + d);
          assert.equal(result.score, expected);
          assert.equal(result.level, expected < 30 ? 'low' : expected < 60 ? 'medium' : 'high');
          assert.equal(result.details.length, 4);
          assert.equal(result.advice.length, 4);
        }
  const max = engine.evaluate({ ...base, amount: 100001, payment: 'O/A', years: 0, overdue: 3 });
  assert.equal(max.rawScore, 110);
  assert.equal(max.score, 100);
  assert.equal(max.factors[0].title, '付款方式');
  assert.match(max.priority, /优先复核/);
  const low = engine.evaluate(base);
  assert.equal(low.factors.length, 0);
  assert.match(low.priority, /不代表交易安全/);
  assert.equal(engine.evaluate({ ...base, country: '其他地区', notes: '任意内容' }).score, low.score);
});
test('编辑后详情、列表、首页与刷新结果一致，删除后高风险数量下降', () => {
  const storage = new Map();
  const app = boot(storage);
  const added = app.store.save(base);
  let html = app.render(`#reports?id=${added.id}`);
  assert.match(html, /最终 5 分/);
  app.store.save({ ...base, amount: 100001, payment: 'O/A', years: 0, overdue: 3 }, added.id);
  html = app.render(`#reports?id=${added.id}`);
  assert.match(html, /原始合计 25 \+ 35 \+ 20 \+ 30 = 110 分/);
  assert.match(html, /最终 100 分/);
  assert.match(html, /多次历史逾期/);
  assert.match(html, /核查未结清款项/);
  assert.match(app.render('#orders'), /order-results/);
  assert.match(app.element('order-results').innerHTML, /100 分/);
  const before = app.store.getAll().filter(o => app.engine.evaluate(o).level === 'high').length;
  assert.ok(app.render('#dashboard').includes(`<strong>${before}<span>笔</span>`));
  assert.match(boot(storage).render(`#reports?id=${added.id}`), /最终 100 分/);
  app.store.remove(added.id);
  assert.ok(app.render('#dashboard').includes(`<strong>${before - 1}<span>笔</span>`));
  assert.match(app.render(`#reports?id=${added.id}`), /不存在或已删除/);
  for (const row of app.store.getAll()) app.store.remove(row.id);
  assert.match(app.render('#dashboard'), /0.0<span>%/);
  assert.match(app.render('#reports'), /暂无匹配订单/);
});
test('报告转义不可信文本，规则说明来自同一配置', () => {
  const app = boot();
  const order = app.store.save({ ...base, name: '<img src=x onerror=alert(1)>', notes: '</p><script>bad()</script>' });
  const html = app.render(`#reports?id=${order.id}`);
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;script&gt;'));
  const rules = app.render('#rules');
  assert.match(rules, /模拟规则 v1.0/);
  for (const group of app.engine.config.groups) for (const band of group.bands) assert.ok(rules.includes(`${band.label}：${band.points} 分`));
});
test('表单保存后跳转对应评估，编辑保存沿用订单编号', () => {
  const app = boot();
  app.ctx.FormData = class { constructor(form) { return Object.entries(form.values); } };
  app.ctx.setTimeout = () => 1;
  app.ctx.clearTimeout = () => {};
  app.render('#assessment');
  app.element('order-form').listeners.submit({ preventDefault() {}, currentTarget: { values: base } });
  const id = new URLSearchParams(app.ctx.location.hash.split('?')[1]).get('id');
  assert.ok(id);
  assert.equal(app.store.getAll().length, 19);
  assert.match(app.render(`#reports?id=${id}`), /最终 5 分/);
  app.ctx.editId = id;
  vm.runInContext('editingId = editId', app.ctx);
  app.render('#assessment');
  app.element('order-form').listeners.submit({ preventDefault() {}, currentTarget: { values: { ...base, payment: 'O/A' } } });
  assert.equal(app.store.getAll().length, 19);
  assert.match(app.render(`#reports?id=${id}`), /最终 40 分/);
  assert.equal(app.element('form-error').textContent, '');
});
test('仅有效报告显示打印入口，点击调用浏览器打印', () => {
  const app = boot();
  let calls = 0;
  app.ctx.window.print = () => { calls++; };
  const html = app.render('#reports?id=TG-DEMO-001');
  assert.match(html, /打印 \/ 保存 PDF/);
  assert.match(html, /TradeGuard｜订单风险评估报告/);
  app.element('print-report').listeners.click();
  assert.equal(calls, 1);
  assert.ok(!app.render('#reports?id=missing').includes('id="print-report"'));
});
