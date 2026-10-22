'use strict';
const OrderCSV = (() => {
  const fields = ['id', 'name', 'country', 'amount', 'payment', 'years', 'overdue', 'date', 'notes'];
  const headers = ['订单编号', '客户名称', '国家或地区', '订单金额（美元）', '付款方式', '合作年限', '历史逾期次数', '订单创建日期', '备注'];
  const textFields = new Set(['name', 'country', 'notes']);
  const dangerous = value => /^\s*[=+@-]/.test(value) || /^[\t\r\n]/.test(value);
  // 防止电子表格将文本执行为公式；前导单引号也转义，以保证本平台往返还原。
  function encodeText(value) { return dangerous(value) || value.startsWith("'") ? "'" + value : value; }
  function decodeText(value) { return value.startsWith("'") && (dangerous(value.slice(1)) || value[1] === "'") ? value.slice(1) : value; }
  function stringify(rows) {
    const quote = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    return '\uFEFF' + [headers, ...rows.map(o => fields.map(f => textFields.has(f) ? encodeText(String(o[f] ?? '')) : o[f]))].map(row => row.map(quote).join(',')).join('\r\n') + '\r\n';
  }
  function parse(text) {
    if (typeof text !== 'string' || text.length > 2 * 1024 * 1024) throw new Error('CSV 不能为空或超过 2 MB。');
    text = text.replace(/^\uFEFF/, '');
    const rows = []; let row = [], cell = '', state = 'start';
    const finishCell = () => { row.push(cell); cell = ''; state = 'start'; };
    const finishRow = () => { finishCell(); if (row.some(v => v !== '')) rows.push(row); row = []; if (rows.length > 2001) throw new Error('每次最多导入 2000 条订单。'); };
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (state === 'quoted') {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else state = 'closed'; }
        else cell += c;
      } else if (c === ',') finishCell();
      else if (c === '\r' || c === '\n') { if (c === '\r' && text[i + 1] === '\n') i++; finishRow(); }
      else if (c === '"' && state === 'start') state = 'quoted';
      else { if (state === 'closed' || c === '"') throw new Error(`第 ${rows.length + 1} 条 CSV 记录引号格式错误。请使用模板。`); cell += c; state = 'plain'; }
    }
    if (state === 'quoted') throw new Error('CSV 存在未闭合的双引号。');
    finishRow();
    if (!rows.length || rows[0].length !== headers.length || rows[0].some((v, i) => v !== headers[i])) throw new Error('CSV 表头不匹配。请下载模板，保留全部列名及顺序，使用 UTF-8 编码和英文逗号。');
    if (rows.length < 2) throw new Error('CSV 只有表头，没有可导入的订单。');
    const ids = new Set();
    return rows.slice(1).map((values, index) => {
      try {
        if (values.length !== fields.length) throw new Error('列数不正确，含逗号或换行的字段须用双引号包裹。');
        const data = Object.fromEntries(fields.map((f, i) => [f, textFields.has(f) ? decodeText(values[i]) : values[i]]));
        const id = data.id.trim();
        if (id && (!/^[A-Za-z0-9-]{1,80}$/.test(id) || ids.has(id))) throw new Error('订单编号无效或文件内重复。');
        if (id) ids.add(id);
        return { ...OrderStore.validate(data), id };
      } catch (error) { throw new Error(`第 ${index + 1} 条订单（不含表头）：${error.message}`); }
    });
  }
  const template = () => stringify([{ id: '', name: '虚构示例客户', country: '新加坡', amount: 25000, payment: 'L/C', years: 1, overdue: 0, date: OrderStore.today(), notes: '虚构示例；请替换为演示订单。' }]);
  return { stringify, parse, template };
})();
