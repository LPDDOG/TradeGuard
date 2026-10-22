'use strict';
let pendingImport = null;
function dataToolbar() {
  return `<section class="panel data-panel"><div><h2>数据管理</h2></div><div class="data-actions"><button class="button secondary" id="export-csv">导出全部 CSV</button><button class="button secondary" id="download-template">下载 CSV 模板</button><label class="button secondary file-button">选择 CSV 导入<input id="import-csv" type="file" accept=".csv,text/csv" aria-label="选择 CSV 导入"></label><button class="button secondary" id="restore-demo">恢复演示数据</button></div><p class="storage-hint">UTF-8 CSV，最多 2 MB / 2000 条；订单编号可留空自动生成。与现有编号重复将整批拒绝。筛选不影响导出范围。</p><p id="data-message" class="error-message" role="alert"></p></section>`;
}
function downloadCSV(content, filename) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function bindDataTools() {
  const message = document.getElementById('data-message');
  document.getElementById('export-csv').addEventListener('click', () => {
    if (OrderStore.getWarning()) { message.textContent = '本地数据读取异常，无法导出有效备份。请先检查浏览器存储。'; return; }
    downloadCSV(OrderCSV.stringify(OrderStore.getAll()), `TradeGuard-orders-${OrderStore.today()}.csv`);
  });
  document.getElementById('download-template').addEventListener('click', () => downloadCSV(OrderCSV.template(), 'TradeGuard-template.csv'));
  document.getElementById('import-csv').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    pendingImport = null;
    message.textContent = '';
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('文件超过 2 MB，请分批导入。');
      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); }
      catch { throw new Error('文件读取失败或不是 UTF-8 编码，请另存为 CSV UTF-8 后重试。'); }
      const rows = OrderCSV.parse(text);
      const existing = new Set(OrderStore.getAll().map(o => o.id));
      if (rows.some(o => o.id && existing.has(o.id))) throw new Error('文件含已有订单编号，未导入任何数据。若需新增，请将对应编号留空。');
      if (OrderStore.getAll().length + rows.length > 10000) throw new Error('导入后总订单数不能超过 10000 笔。');
      if (OrderStore.getWarning()) throw new Error(OrderStore.getWarning());
      pendingImport = rows;
      document.getElementById('import-summary').textContent = `已验证 ${rows.length} 笔订单，合计 ${money(rows.reduce((sum, o) => sum + o.amount, 0))}。确认后追加到现有订单；取消不会保存。首笔客户：${rows[0].name}`;
      document.getElementById('import-error').textContent = '';
      document.getElementById('import-dialog').showModal();
      document.getElementById('cancel-import').focus();
    } catch (error) { message.textContent = error.message; }
    finally { e.target.value = ''; }
  });
  document.getElementById('restore-demo').addEventListener('click', () => {
    document.getElementById('restore-error').textContent = '';
    document.getElementById('restore-dialog').showModal();
    document.getElementById('cancel-restore').focus();
  });
}
function bindDataDialogs() {
  document.getElementById('cancel-import').addEventListener('click', () => { pendingImport = null; document.getElementById('import-dialog').close(); });
  document.getElementById('import-dialog').addEventListener('cancel', () => { pendingImport = null; });
  document.getElementById('confirm-import').addEventListener('click', () => {
    try {
      if (!pendingImport) throw new Error('没有待导入数据，请重新选择文件。');
      const count = OrderStore.importBatch(pendingImport);
      pendingImport = null;
      document.getElementById('import-dialog').close();
      filters = { query: '', payment: '', country: '' }; render(); toast(`成功导入 ${count} 笔订单，评分与统计已更新。`);
    } catch (error) { document.getElementById('import-error').textContent = error.message; }
  });
  document.getElementById('cancel-restore').addEventListener('click', () => document.getElementById('restore-dialog').close());
  document.getElementById('confirm-restore').addEventListener('click', () => {
    try {
      OrderStore.restoreDemo();
      document.getElementById('restore-dialog').close();
      filters = { query: '', payment: '', country: '' }; render(); toast('已恢复 18 笔虚构演示订单。');
    } catch (error) { document.getElementById('restore-error').textContent = error.message; }
  });
}
