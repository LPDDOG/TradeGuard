const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const row = { name: '虚构测试', country: '测试地区', amount: 0.1, payment: '100% T/T 预付', years: 3, overdue: 0, date: '2025-01-01', notes: '' };
function boot(withChart = true) {
  const created = [];
  const nodes = new Map();
  const el = id => { if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', hidden: true, listeners: {}, setAttribute() {}, focus() {}, addEventListener(event, cb) { this.listeners[event] = cb; } }); return nodes.get(id); };
  class Chart { constructor(canvas, config) { this.canvas = canvas; this.config = config; this.destroyed = false; created.push(this); } destroy() { this.destroyed = true; } resize() { this.resized = true; } }
  const storage = new Map();
  const ctx = vm.createContext({ crypto, Intl, URLSearchParams, setTimeout, clearTimeout, ...(withChart ? { Chart } : {}), location: { hash: '' }, localStorage: { getItem: k => storage.get(k) ?? '[]', setItem: (k,v) => storage.set(k,v) }, document: { getElementById: el, querySelectorAll: () => [], addEventListener() {}, body: { classList: { remove() {} } } }, window: { addEventListener() {} } });
  for (const file of ['orders', 'risk', 'app', 'risk-ui', 'dashboard', 'csv', 'data-ui', 'order-ui']) vm.runInContext(fs.readFileSync(`assets/${file}.js`, 'utf8'), ctx);
  return { ctx, el, created, store: vm.runInContext('OrderStore', ctx), build: vm.runInContext('DashboardData.build', ctx), render(hash = '#dashboard') { ctx.location.hash = hash; vm.runInContext('render()', ctx); } };
}
test('跨年分组、无订单月份补零、整数美分汇总与风险/付款数量', () => {
  const app = boot();
  const data = app.build([row, { ...row, amount: 0.2, date: '2025-01-31' }, { ...row, amount: 100001, payment: 'O/A', years: 0, overdue: 3, date: '2024-12-31' }], '2025');
  assert.equal(data.total, 100001.3);
  assert.equal(data.monthly[0], 0.3);
  assert.equal(data.monthly[1], 0);
  assert.equal(data.monthly.length, 12);
  assert.equal(data.risk.find(r => r.key === 'high').count, 1);
  assert.equal(data.payments.find(p => p.label === 'O/A').count, 1);
  assert.equal(data.payments.reduce((s, p) => s + p.count, 0), 3);
  assert.equal(app.build([row], '不存在').year, '2025');
});
test('新增/编辑/删除更新三张图，页面切换先销毁实例', () => {
  const app = boot();
  const added = app.store.save(row);
  app.render();
  let charts = app.created.slice(-3);
  assert.equal(charts[0].config.type, 'doughnut');
  assert.equal(charts[1].config.type, 'bar');
  assert.equal(charts[2].config.type, 'line');
  assert.equal(charts[0].config.data.datasets[0].data[0], 1);
  assert.equal(charts[2].config.data.datasets[0].data[0], 0.1);
  app.store.save({ ...row, amount: 100001, payment: 'O/A', years: 0, overdue: 3, date: '2025-03-01' }, added.id);
  app.render();
  assert.ok(charts.every(c => c.destroyed));
  charts = app.created.slice(-3);
  assert.equal(charts[0].config.data.datasets[0].data[2], 1);
  assert.equal(charts[1].config.data.datasets[0].data[4], 1);
  assert.equal(charts[2].config.data.datasets[0].data[0], 0);
  assert.equal(charts[2].config.data.datasets[0].data[2], 100001);
  app.render('#orders');
  assert.ok(charts.every(c => c.destroyed));
  app.store.remove(added.id);
  app.render();
  assert.ok(app.created.slice(-3)[0].config.data.datasets[0].data.every(n => n === 0));
  assert.match(app.el('main').innerHTML, /暂无订单/);
});
test('年份选择改变趋势，其他统计保持全量；组件缺失提供数据表', () => {
  const app = boot();
  app.store.save(row);
  app.store.save({ ...row, amount: 2, date: '2024-12-31' });
  app.render();
  app.el('trend-year').listeners.change({ target: { value: '2024' } });
  const charts = app.created.slice(-3);
  assert.equal(charts[2].config.data.labels[11], '2024-12');
  assert.equal(charts[2].config.data.datasets[0].data[11], 2);
  assert.equal(charts[0].config.data.datasets[0].data[0], 2);
  const fallback = boot(false);
  assert.equal(fallback.el('chart-status').hidden, false);
  assert.match(fallback.el('chart-status').textContent, /未能加载/);
  assert.match(fallback.el('main').innerHTML, /查看月度金额数据表/);
});
test('本地Chart.js固定版本加载、所有脚本使用存在的相对路径', () => {
  const Chart = require('../assets/vendor/chart.umd.min.js');
  assert.equal(Chart.version, '4.5.1');
  const html = fs.readFileSync('index.html', 'utf8');
  const sources = [...html.matchAll(/(?:src|href)="(\.\/[^\"]+)"/g)].map(m => m[1]);
  sources.forEach(path => assert.ok(fs.existsSync(path), path));
  assert.ok(html.indexOf('vendor/chart.umd.min.js') < html.indexOf('assets/dashboard.js'));
  assert.ok(fs.existsSync('assets/vendor/Chart.js-LICENSE.md'));
});
test('分析图表按需切换，一次仅展示选定图表并调整画布尺寸', () => {
  const app = boot();
  app.el('chart-view').listeners.change({ target: { value: 'risk' } });
  assert.equal(app.el('risk-panel').hidden, false);
  assert.equal(app.el('monthly-panel').hidden, true);
  assert.equal(app.el('payment-panel').hidden, true);
  assert.ok(app.created.slice(-3).every(c => c.resized));
  app.el('chart-view').listeners.change({ target: { value: 'payment' } });
  assert.equal(app.el('risk-panel').hidden, true);
  assert.equal(app.el('payment-panel').hidden, false);
});
