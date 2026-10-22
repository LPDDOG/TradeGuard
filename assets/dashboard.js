'use strict';

// 以整数美分汇总金额，避免小数累加误差；年份仅影响趋势图。
const DashboardData = (() => {
  function build(orders, selectedYear = '') {
    const now = OrderStore.today();
    const currentYear = now.slice(0, 4);
    const years = [...new Set(orders.map(o => o.date.slice(0, 4)))].sort().reverse();
    if (!years.length) years.push(currentYear);
    const year = years.includes(String(selectedYear)) ? String(selectedYear) : years[0];
    const months = Array.from({ length: year === currentYear ? Number(now.slice(5, 7)) : 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    const monthlyCents = months.map(() => 0);
    const risk = RiskEngine.config.levels.map(l => ({ key: l.key, label: l.label, count: 0 }));
    const payments = OrderStore.payments.map(label => ({ label, count: 0 }));
    let totalCents = 0;
    for (const order of orders) {
      const cents = Math.round(order.amount * 100);
      totalCents += cents;
      risk.find(r => r.key === RiskEngine.evaluate(order).level).count++;
      payments.find(p => p.label === order.payment).count++;
      const month = months.indexOf(order.date.slice(0, 7));
      if (month >= 0) monthlyCents[month] += cents;
    }
    const high = risk.find(r => r.key === 'high').count;
    return { count: orders.length, total: totalCents / 100, high, highPercent: orders.length ? high / orders.length * 100 : 0, risk, payments, years, year, months, monthly: monthlyCents.map(c => c / 100) };
  }
  return { build };
})();

let dashboardYear = '';
function dashboardChartsHTML(data) {
  const table = (caption, headers, rows) => `<details class="chart-data"><summary>查看${caption}数据表</summary><div class="table-scroll"><table><caption class="sr-only">${caption}</caption><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(v => `<td>${escapeHTML(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
  const canvas = (id, name) => `<div class="chart-canvas"><canvas id="${id}" role="img" aria-label="${name}，具体数值可在下方数据表查看">请使用下方数据表查看数值。</canvas></div>`;
  return `<div id="chart-status" class="notice" role="status" hidden></div>${data.count ? '' : '<div class="notice">暂无订单。统计均为零；新增虚构订单后图表会自动生成。</div>'}<div class="dashboard-charts"><section class="panel chart-panel"><div class="panel-heading"><div><h2>风险等级分布</h2><p>全部 ${data.count} 笔订单 · 按当前规则计算</p></div><a class="text-link" href="#rules">评分规则 →</a></div>${canvas('risk-chart', '风险等级订单数量分布')}<div class="chart-legend">${data.risk.map(r => `<span>${badge({ level: r.key })} <strong>${r.count} 笔</strong></span>`).join('')}</div>${table('风险等级', ['风险等级', '订单数量', '占比'], data.risk.map(r => [r.label, `${r.count} 笔`, `${data.count ? (r.count / data.count * 100).toFixed(1) : '0.0'}%`]))}</section><section class="panel chart-panel"><div class="panel-heading"><div><h2>付款方式分布</h2><p>全部订单 · 单位：笔</p></div></div>${canvas('payment-chart', '不同付款方式的订单数量')}${table('付款方式', ['付款方式', '订单数量'], data.payments.map(p => [p.label, `${p.count} 笔`]))}</section><section class="panel chart-panel trend-panel"><div class="panel-heading"><div><h2>每月订单金额趋势</h2><p>按创建日期汇总 · USD · 无订单月份记为 0</p></div><label class="year-filter">年份<select id="trend-year" aria-label="月度金额趋势年份">${data.years.map(y => `<option ${data.year === y ? 'selected' : ''}>${y}</option>`).join('')}</select></label></div>${canvas('monthly-chart', `${data.year}年月度订单金额趋势`)}<p class="chart-note">当前年份仅显示至本月。年份选择只影响本趋势图，其他统计包含全部订单。</p>${table('月度金额', ['月份', '订单金额（美元）'], data.months.map((m, i) => [m, money(data.monthly[i])]))}</section></div><p class="dashboard-hint">将鼠标移至图形或轻触数据点查看数值；可点击风险图例切换显示，完整统计见各图下方数据表。</p>`;
}

const DashboardCharts = (() => {
  let instances = [];
  function destroy() { instances.forEach(chart => chart.destroy()); instances = []; }
  function mount(data) {
    destroy();
    const status = document.getElementById('chart-status');
    if (typeof Chart === 'undefined') {
      status.hidden = false;
      status.textContent = '图表组件未能加载，请展开下方数据表查看完整统计。订单管理与评分仍可使用。';
      return;
    }
    const number = n => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(n);
    const common = { responsive: true, maintainAspectRatio: false, animation: false, color: '#657289', font: { family: '"Segoe UI", "Microsoft YaHei", sans-serif' }, plugins: { legend: { display: false } } };
    const axes = { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } }, y: { beginAtZero: true, grid: { color: '#edf1f6' }, border: { display: false } } };
    try {
      instances.push(new Chart(document.getElementById('risk-chart'), { type: 'doughnut', data: { labels: data.risk.map(r => r.label), datasets: [{ data: data.risk.map(r => r.count), backgroundColor: ['#479d87', '#edb953', '#da7480'], borderWidth: 3, borderColor: '#fff', hoverOffset: 5 }] }, options: { ...common, cutout: '72%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } }, tooltip: { callbacks: { label: ctx => `${ctx.label}：${ctx.raw} 笔（${data.count ? (ctx.raw / data.count * 100).toFixed(1) : '0.0'}%）` } } } } }));
      instances.push(new Chart(document.getElementById('payment-chart'), { type: 'bar', data: { labels: data.payments.map(p => p.label), datasets: [{ label: '订单数量', data: data.payments.map(p => p.count), backgroundColor: '#537db5', borderRadius: 5, maxBarThickness: 30 }] }, options: { ...common, indexAxis: 'y', scales: { x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#edf1f6' } }, y: { grid: { display: false } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `订单数量：${ctx.parsed.x} 笔` } } } } }));
      instances.push(new Chart(document.getElementById('monthly-chart'), { type: 'line', data: { labels: data.months, datasets: [{ label: '订单金额（USD）', data: data.monthly, borderColor: '#315f9b', backgroundColor: '#315f9b12', fill: true, tension: 0, pointRadius: 4, pointHoverRadius: 6, borderWidth: 2 }] }, options: { ...common, interaction: { mode: 'index', intersect: false }, scales: { ...axes, y: { ...axes.y, ticks: { callback: value => '$' + number(value) } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `订单金额：${money(ctx.parsed.y)}` } } } } }));
    } catch {
      destroy();
      status.hidden = false;
      status.textContent = '图表暂时无法绘制，请使用下方数据表查看统计。';
    }
  }
  return { mount, destroy };
})();
