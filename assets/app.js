'use strict';

const titles = { dashboard: '风险总览', orders: '订单管理', assessment: '新建风险评估', reports: '风险报告', rules: '评分规则说明', about: '关于项目' };
const labels = { low: '低风险', medium: '中风险', high: '高风险' };
const money = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
const badge = o => `<span class="badge ${o.level}"><i></i>${labels[o.level]}</span>`;
const heading = (eyebrow, title, description, action = '') => `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="subtitle">${description}</p></div>${action}</div>`;
const phaseNotice = '<p class="demo-disclaimer">虚构数据演示 · 模拟规则不代表真实信用评级，不具备征信、制裁筛查或法律合规判断能力。</p>';

function about() {
  return heading('ABOUT TRADEGUARD', '用技术，连接法律与业务。', '面向跨境贸易场景的合规与订单风险评估个人作品集。') + `<section class="panel about-panel"><h2>从业务问题出发，建立完整的风险复核流程</h2><p>TradeGuard 旨在展示法律学习者利用 AI 辅助开发工具，将风险管理思路转化为可交互产品的能力。项目以透明的 JavaScript 规则模拟订单评分，辅助理解贸易付款条件和交易历史对复核优先级的影响。</p><div class="about-columns"><div><h3>技术方案</h3><p>HTML · CSS · JavaScript<br>localStorage 本地保存 · Chart.js 交互式图表<br>静态部署，无需账号或后端</p></div><div><h3>能力边界</h3><p>所有客户与订单均为虚构。<br>不接入真实 AI 模型或信用数据库。<br>不提供制裁筛查或法律判断。</p></div></div><h3>当前进度</h3><p>已完成订单管理、透明风险评分、交互图表、CSV 导入导出与打印入口，并持续进行功能和移动端验收。已通过 GitHub Pages 发布；普通浏览器 PDF 保存成品尚未验证。</p><h3>AI 辅助说明</h3><p>项目代码、界面与开发文档由 OpenAI Codex 辅助创建；作品集展示时应如实说明 AI 的参与，并结合自身理解解释业务规则与局限。</p></section>`;
}
