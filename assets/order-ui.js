'use strict';
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let editingId = '';
let filters = { query: '', payment: '', country: '' };
let pendingDelete = '';
let toastTimer;
function orderTable(rows = OrderStore.filter()) {
  if (!rows.length) return '<div class="empty-state"><h2>暂无匹配订单</h2><p>请调整筛选条件，或新建一笔虚构订单。</p><a class="button secondary" href="#assessment">＋ 新建订单</a></div>';
  return `<p class="table-hint">左右滑动表格，查看风险分数与操作按钮。</p><div class="table-scroll" tabindex="0" role="region" aria-label="订单列表，可横向滚动"><table><caption class="sr-only">订单列表</caption><thead><tr><th>客户 / 地区</th><th>订单金额</th><th>付款方式</th><th>创建日期</th><th>合作 / 逾期</th><th>风险评估</th><th>操作</th></tr></thead><tbody>${rows.map((o, i) => `<tr><td><div class="customer"><span class="customer-icon c${i % 3}">${escapeHTML(o.name.slice(0, 1))}</span><div><strong>${escapeHTML(o.name)}</strong><small>${escapeHTML(o.country)} · ${escapeHTML(o.id)}</small></div></div></td><td class="numeric">${money(o.amount)}</td><td>${escapeHTML(o.payment)}</td><td class="muted">${o.date}</td><td>${o.years} 年 / ${o.overdue} 次</td><td>${badge(RiskEngine.evaluate(o))} <strong>${RiskEngine.evaluate(o).score} 分</strong></td><td><div class="row-actions"><a class="text-button" href="#reports?id=${o.id}" aria-label="查看 ${escapeHTML(o.name)} 的评估">查看评估</a><button class="text-button" data-edit="${o.id}" aria-label="编辑 ${escapeHTML(o.name)}">编辑</button><button class="text-button delete" data-delete="${o.id}" aria-label="删除 ${escapeHTML(o.name)}">删除</button></div></td></tr>`).join('')}</tbody></table></div>`;
}
function dashboard() {
  const orders = OrderStore.getAll();
  const data = DashboardData.build(orders, dashboardYear);
  const high = data.high;
  const total = data.total;
  return heading('RISK INTELLIGENCE', '风险总览', '查看订单表现，优先复核值得关注的交易。', '<a class="button primary" href="#assessment">＋ 新建风险评估</a>') + phaseNotice + `<div class="stats"><article class="stat"><div>订单总数量</div><strong>${orders.length}<span>笔</span></strong><small>本浏览器已保存订单</small></article><article class="stat"><div>订单总金额</div><strong>${money(total)}</strong><small>计价币种 USD</small></article><article class="stat"><div>高风险订单</div><strong>${high}<span>笔</span></strong><small>建议优先人工复核</small></article><article class="stat"><div>高风险占比</div><strong>${orders.length ? (high / orders.length * 100).toFixed(1) : '0.0'}<span>%</span></strong><small>占全部订单的比例</small></article></div>${dashboardChartsHTML(data)}<section class="panel"><div class="panel-heading"><div><h2>近期订单</h2><p>按创建日期倒序 · 最近 6 笔</p></div><a class="text-link" href="#orders">查看全部订单 →</a></div>${orderTable(OrderStore.filter().slice(0, 6))}</section>`;
}
function ordersPage() {
  const countries = [...new Set(OrderStore.getAll().map(o => o.country))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  return heading('ORDER MANAGEMENT', '订单管理', '集中查看客户与订单，建立清晰的风险台账。', '<a class="button primary" href="#assessment">＋ 新建订单</a>') + phaseNotice + dataToolbar() + `<section class="panel"><div class="filters"><label>搜索订单<input id="search-orders" type="search" placeholder="客户、地区、编号或备注" value="${escapeHTML(filters.query)}"></label><label>付款方式<select id="filter-payment"><option value="">全部付款方式</option>${OrderStore.payments.map(p => `<option ${filters.payment === p ? 'selected' : ''}>${p}</option>`).join('')}</select></label><label>国家或地区<select id="filter-country"><option value="">全部地区</option>${countries.map(c => `<option ${filters.country === c ? 'selected' : ''}>${escapeHTML(c)}</option>`).join('')}</select></label><button class="button secondary" id="clear-filters">清空筛选</button></div><p class="result-count" id="result-count" role="status"></p><div id="order-results"></div></section>`;
}
function updateResults() {
  const rows = OrderStore.filter(filters);
  document.getElementById('order-results').innerHTML = orderTable(rows);
  document.getElementById('result-count').textContent = `共 ${OrderStore.getAll().length} 笔订单，当前匹配 ${rows.length} 笔`;
}
function assessmentForm() {
  const o = OrderStore.getAll().find(o => o.id === editingId) || { name: '', country: '', amount: '', payment: OrderStore.payments[0], years: 0, overdue: 0, date: OrderStore.today(), notes: '' };
  const field = (label, name, type, extra = '') => `<label>${label}<input name="${name}" type="${type}" value="${escapeHTML(o[name])}" ${extra} required></label>`;
  return heading('ORDER DETAILS', editingId ? '编辑订单' : '新建风险评估', '保存后自动计算风险评分，并展示各项依据与复核建议。') + phaseNotice + `<section class="panel form-panel"><form id="order-form"><h2>客户与订单信息</h2><p class="muted">除备注外均为必填项。请勿输入真实客户资料。</p><div class="form-grid">${field('客户名称', 'name', 'text', 'maxlength="100" autocomplete="off"')}${field('国家或地区', 'country', 'text', 'maxlength="60" autocomplete="off"')}${field('订单金额（美元）', 'amount', 'number', 'min="0" max="1000000000000" step="0.01"')}<label>付款方式<select name="payment" required>${OrderStore.payments.map(p => `<option ${o.payment === p ? 'selected' : ''}>${p}</option>`).join('')}</select></label>${field('合作年限（整年；0 表示首次合作）', 'years', 'number', 'min="0" max="200" step="1"')}${field('历史逾期次数', 'overdue', 'number', 'min="0" max="100000" step="1"')}${field('订单创建日期', 'date', 'date', `min="1900-01-01" max="${OrderStore.today()}"`)}<label class="full-width">备注（选填）<textarea name="notes" maxlength="1000" rows="4" placeholder="例如：待核对合同付款条款">${escapeHTML(o.notes)}</textarea></label></div><p id="form-error" class="error-message" role="alert"></p><div class="form-actions"><a class="button secondary" href="#orders">取消并返回</a><button class="button primary" type="submit">保存并查看评估</button></div><p class="storage-hint">数据仅保存在当前浏览器。清除网站数据会移除订单；更换浏览器或访问地址不会同步。</p></form></section>`;
}
function toast(message) {
  clearTimeout(toastTimer);
  const node = document.getElementById('toast');
  node.textContent = message;
  node.hidden = false;
  toastTimer = setTimeout(() => { node.hidden = true; }, 4500);
}
function render() {
  const requested = location.hash.slice(1).split('?')[0] || 'dashboard';
  const page = Object.hasOwn(titles, requested) ? requested : 'dashboard';
  DashboardCharts.destroy();
  document.title = `${titles[page]} · TradeGuard`;
  document.getElementById('breadcrumb-title').textContent = editingId && page === 'assessment' ? '编辑订单' : titles[page];
  document.querySelectorAll('[data-page]').forEach(link => { if (link.dataset.page === page) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  document.getElementById('main').innerHTML = page === 'dashboard' ? dashboard() : page === 'orders' ? ordersPage() : page === 'assessment' ? assessmentForm() : page === 'rules' ? riskRulesPage() : page === 'about' ? about() : reportsPage();
  const warning = OrderStore.getWarning();
  if (warning) document.getElementById('main').insertAdjacentHTML('afterbegin', `<div class="notice error-message" role="alert">${escapeHTML(warning)}</div>`);
  if (page === 'dashboard') {
    const data = DashboardData.build(OrderStore.getAll(), dashboardYear);
    DashboardCharts.mount(data);
    document.getElementById('chart-view').addEventListener('change', e => {
      for (const key of ['monthly', 'risk', 'payment']) document.getElementById(key + '-panel').hidden = key !== e.target.value;
      DashboardCharts.resize();
    });
    document.getElementById('trend-year').addEventListener('change', e => { dashboardYear = e.target.value; render(); document.getElementById('trend-year').focus(); });
  }
  document.getElementById('main').setAttribute('data-print-report', String(page === 'reports' && OrderStore.getAll().some(o => o.id === new URLSearchParams(location.hash.split('?')[1] || '').get('id'))));
  const printButton = document.getElementById('print-report');
  if (page === 'reports' && printButton) printButton.addEventListener('click', () => window.print());
  if (page === 'orders') {
    bindDataTools();
    updateResults();
    for (const [id, field, event] of [['search-orders', 'query', 'input'], ['filter-payment', 'payment', 'change'], ['filter-country', 'country', 'change']]) document.getElementById(id).addEventListener(event, e => { filters[field] = e.target.value; updateResults(); });
    document.getElementById('clear-filters').addEventListener('click', () => { filters = { query: '', payment: '', country: '' }; render(); document.getElementById('search-orders').focus(); });
  }
  if (page === 'assessment') document.getElementById('order-form').addEventListener('submit', e => {
    e.preventDefault();
    try {
      const saved = OrderStore.save(Object.fromEntries(new FormData(e.currentTarget)), editingId);
      editingId = '';
      filters = { query: '', payment: '', country: '' };
      location.hash = `reports?id=${saved.id}`;
      toast('订单已保存，风险评估已更新。');
    } catch (error) { document.getElementById('form-error').textContent = error.message; }
  });
  document.body.classList.remove('nav-open');
  document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false'); document.getElementById('menu-toggle').setAttribute('aria-label', '展开导航');
  document.getElementById('announcement').textContent = `已切换至${titles[page]}`;
}
document.getElementById('main').addEventListener('click', e => {
  const edit = e.target.closest('[data-edit]');
  const remove = e.target.closest('[data-delete]');
  if (edit) { editingId = edit.dataset.edit; location.hash = 'assessment'; }
  if (remove) {
    pendingDelete = remove.dataset.delete;
    const order = OrderStore.getAll().find(o => o.id === pendingDelete);
    document.getElementById('delete-description').textContent = `${order.name} · ${money(order.amount)}`;
    document.getElementById('delete-error').textContent = '';
    document.getElementById('delete-dialog').showModal();
    document.getElementById('cancel-delete').focus();
  }
});
document.getElementById('cancel-delete').addEventListener('click', () => document.getElementById('delete-dialog').close());
document.getElementById('confirm-delete').addEventListener('click', () => {
  try {
    OrderStore.remove(pendingDelete);
    document.getElementById('delete-dialog').close();
    render();
    toast('订单已删除，统计已更新。');
    (document.getElementById('search-orders') || document.getElementById('main')).focus();
  } catch (error) { document.getElementById('delete-error').textContent = error.message; }
});
document.getElementById('menu-toggle').addEventListener('click', e => { const open = document.body.classList.toggle('nav-open'); e.currentTarget.setAttribute('aria-expanded', String(open)); e.currentTarget.setAttribute('aria-label', open ? '关闭导航' : '展开导航'); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { document.body.classList.remove('nav-open'); document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false'); } });
window.addEventListener('hashchange', () => { if (location.hash !== '#assessment') editingId = ''; render(); document.getElementById('main').focus(); window.scrollTo(0, 0); });
bindDataDialogs();
document.getElementById('skip-main').addEventListener('click', e => { e.preventDefault(); document.getElementById('main').focus(); });
render();
