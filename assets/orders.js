'use strict';

// 数据结构与持久化独立于界面；后续评分引擎直接使用同一份订单。
const OrderStore = (() => {
  const key = 'tradeguard.orders.v1';
  const payments = ['100% T/T 预付', '30% T/T 预付', 'L/C', 'D/P', 'O/A'];
  const text = value => String(value ?? '').trim();
  const today = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  function validate(input) {
    const order = { name: text(input.name), country: text(input.country), amount: Number(input.amount), payment: text(input.payment), years: Number(input.years), overdue: Number(input.overdue), date: text(input.date), notes: text(input.notes) };
    const errors = [];
    if (!order.name || order.name.length > 100) errors.push('客户名称须为 1—100 个字符。');
    if (!order.country || order.country.length > 60) errors.push('国家或地区须为 1—60 个字符。');
    if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(text(input.amount)) || !Number.isFinite(order.amount) || order.amount < 0 || order.amount > 1e12) errors.push('订单金额须为 0—1 万亿美元之间的普通数字，最多两位小数。');
    if (!payments.includes(order.payment)) errors.push('请选择有效的付款方式。');
    for (const [field, label] of [['years', '合作年限'], ['overdue', '历史逾期次数']]) {
      if (text(input[field]) === '' || !Number.isSafeInteger(order[field]) || order[field] < 0 || order[field] > (field === 'years' ? 200 : 100000)) errors.push(`${label}须为合理范围内的非负整数。`);
    }
    const date = new Date(`${order.date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(order.date) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== order.date || order.date < '1900-01-01' || order.date > today()) errors.push('请选择 1900 年起至今天之间的有效创建日期。');
    if (order.notes.length > 1000) errors.push('备注不能超过 1000 个字符。');
    if (errors.length) throw new Error(errors.join('\n'));
    return order;
  }
  function demo() {
    const names = ['Northstar Home Ltd.', '青岚生活株式会社', 'Atlas Retail GmbH', 'Meridian Trading LLC', '南屿家居有限公司', 'Cedar Goods Inc.', 'Solana Textiles SL', 'Harbor Supply Pty Ltd.', '晨曦商贸有限公司', 'Maple Living Inc.', 'Aurora Design SAS', 'Pacific Home Ltd.', '蓝桥贸易有限公司', 'Terra Goods SpA', 'Orion Retail BV', 'Silver Fern Imports', 'Lumen Market AB', 'Westwood Trading Ltd.'];
    const countries = ['英国', '日本', '德国', '阿联酋', '新加坡', '加拿大', '西班牙', '澳大利亚', '马来西亚', '加拿大', '法国', '美国', '泰国', '意大利', '荷兰', '新西兰', '瑞典', '英国'];
    return names.map((name, i) => ({ id: `TG-DEMO-${String(i + 1).padStart(3, '0')}`, name, country: countries[i], amount: [128000, 42500, 86000, 156000, 38000, 67500, 50000, 100000, 100001, 12000, 76000, 245000, 9800, 54000, 63000, 27000, 135000, 48500][i], payment: payments[i % 5], years: [0, 3, 1, 0, 4, 2][i % 6], overdue: [3, 0, 1, 2, 0, 0][i % 6], date: `2026-${String(5 + Math.floor(i / 3)).padStart(2, '0')}-${String(3 + i).padStart(2, '0')}`, notes: '虚构演示数据，仅用于作品集展示。' }));
  }
  let orders = [];
  let warning = '';
  let blocked = false;
  let lastStored = null;
  function load() {
    try {
      const raw = localStorage.getItem(key);
      lastStored = raw;
      if (raw === null) { orders = demo(); persist(orders); return; }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length > 10000) throw new Error('数据结构无效');
      const ids = new Set();
      orders = parsed.map(row => {
        if (!row || typeof row.id !== 'string' || !/^[A-Za-z0-9-]{1,80}$/.test(row.id) || ids.has(row.id)) throw new Error('订单编号无效');
        ids.add(row.id);
        return { ...validate(row), id: row.id };
      });
    } catch (error) {
      orders = [];
      warning = '无法读取本地数据，可能是浏览器禁止存储或数据已损坏。为保护原数据，未自动覆盖；请尝试在原浏览器正常模式打开。';
      blocked = true;
    }
  }
  function persist(next, force = false) {
    let current;
    try { current = localStorage.getItem(key); }
    catch { throw new Error('无法读取浏览器存储，请保留当前表单并重试。'); }
    if (!force && current !== lastStored) throw new Error('数据已在其他页面更新。为避免覆盖，本次未保存；请记录当前输入，刷新页面后重试。');
    const serialized = JSON.stringify(next);
    try { localStorage.setItem(key, serialized); }
    catch { throw new Error('保存失败：浏览器存储不可用或空间已满。请保留当前表单，在正常浏览模式下重试。'); }
    lastStored = serialized;
  }
  function save(input, id = '') {
    if (blocked) throw new Error(warning);
    if (!id && orders.length >= 10000) throw new Error('总订单数不能超过 10000 笔，请先导出备份并整理订单。');
    const clean = validate(input);
    if (id && !orders.some(o => o.id === id)) throw new Error('该订单已不存在，请返回列表重试。');
    const order = { ...clean, id: id || `TG-${crypto.randomUUID()}` };
    const next = id ? orders.map(o => o.id === id ? order : o) : [...orders, order];
    persist(next);
    orders = next;
    return order;
  }
  function remove(id) {
    if (blocked) throw new Error(warning);
    if (!orders.some(o => o.id === id)) throw new Error('该订单已不存在。');
    const next = orders.filter(o => o.id !== id);
    persist(next);
    orders = next;
  }
  function importBatch(rows) {
    if (blocked) throw new Error(warning);
    if (!Array.isArray(rows) || !rows.length || rows.length > 2000 || orders.length + rows.length > 10000) throw new Error('每次可导入 1—2000 笔，总订单数不能超过 10000 笔。');
    const ids = new Set(orders.map(o => o.id));
    const batch = rows.map((row, i) => {
      const id = row.id || `TG-${crypto.randomUUID()}`;
      if (!/^[A-Za-z0-9-]{1,80}$/.test(id) || ids.has(id)) throw new Error(`第 ${i + 1} 条记录：订单编号无效或重复。已有订单不会被覆盖。`);
      ids.add(id);
      return { ...validate(row), id };
    });
    const next = [...orders, ...batch];
    persist(next);
    orders = next;
    return batch.length;
  }
  function restoreDemo() {
    const next = demo();
    persist(next, true);
    orders = next;
    blocked = false;
    warning = '';
  }
  function filter({ query = '', payment = '', country = '' } = {}) {
    const q = query.trim().toLocaleLowerCase();
    return orders.filter(o => (!q || [o.name, o.country, o.id, o.notes].some(v => v.toLocaleLowerCase().includes(q))) && (!payment || o.payment === payment) && (!country || o.country === country)).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  }
  load();
  return { payments, today, validate, save, remove, importBatch, restoreDemo, filter, getAll: () => orders.map(o => ({ ...o })), getWarning: () => warning };
})();
