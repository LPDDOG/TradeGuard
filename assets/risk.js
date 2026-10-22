'use strict';
// 唯一规则源：计算、规则说明及明细共用。分数实时计算，不写入订单存储。
const RiskEngine = (() => {
  const config = {
    version: '模拟规则 v1.0', cap: 100,
    levels: [{ max: 29, key: 'low', label: '低风险' }, { max: 59, key: 'medium', label: '中风险' }, { max: 100, key: 'high', label: '高风险' }],
    groups: [
      { field: 'amount', title: '订单金额', bands: [
        { max: 50000, points: 5, label: '不超过 $50,000', advice: '核对订单金额、币种与合同是否一致。' },
        { max: 100000, points: 15, label: '超过 $50,000 至 $100,000', factor: '订单金额较大，需关注单笔交易敞口。', advice: '复核交易敞口，评估是否分批履约。' },
        { max: Infinity, points: 25, label: '超过 $100,000', factor: '大额订单带来较高的单笔交易敞口。', advice: '建议业务负责人复核金额与履约计划，讨论分批出货或增加收款保障。' }
      ] },
      { field: 'payment', title: '付款方式', bands: [
        { value: '100% T/T 预付', points: 0, label: '100% T/T 预付', advice: '核实预付款实际到账及付款方信息后，再安排履约。' },
        { value: '30% T/T 预付', points: 15, label: '30% T/T 预付', factor: '仍有 70% 尾款尚未收取。', advice: '复核尾款支付节点、放单条件与合同约定，确认预付款到账。' },
        { value: 'L/C', points: 10, label: 'L/C', factor: '信用证交易仍需关注条款和交单条件。', advice: '由熟悉信用证业务的人员复核开证行信息、有效期和单据要求。' },
        { value: 'D/P', points: 25, label: 'D/P', factor: '付款交单仍存在客户拒付或不提货的风险。', advice: '复核托收、交单及拒付处置安排，核实客户提货意愿。' },
        { value: 'O/A', points: 35, label: 'O/A', factor: '赊销条件下存在应收账款回收敞口。', advice: '核对账期、额度与回款记录，评估预付或其他收款保障安排。' }
      ] },
      { field: 'years', title: '合作年限', bands: [
        { max: 0, points: 20, label: '首次合作（0 年）', factor: '首次合作，缺少既往履约记录。', advice: '核验客户主体、联系人与履约能力，可考虑小额试单。' },
        { max: 2, points: 10, label: '合作 1—2 年', factor: '合作时间较短，可参考的历史记录有限。', advice: '整理既往订单履约、沟通与回款记录，确认是否存在异常变化。' },
        { max: Infinity, points: 0, label: '合作 3 年及以上', advice: '结合近期实际履约情况复核，避免仅依赖长期合作关系。' }
      ] },
      { field: 'overdue', title: '历史逾期', bands: [
        { max: 0, points: 0, label: '0 次', advice: '保持日常回款跟踪，核对历史记录的完整性。' },
        { max: 2, points: 15, label: '1—2 次', factor: '存在历史逾期付款记录。', advice: '核对逾期原因、持续天数和是否结清，复核本次付款条件。' },
        { max: Infinity, points: 30, label: '3 次及以上', factor: '存在多次历史逾期付款记录。', advice: '优先核查未结清款项与逾期原因，审慎复核账期及新增交易敞口。' }
      ] }
    ]
  };
  function freeze(value) { Object.values(value).forEach(v => { if (v && typeof v === 'object') freeze(v); }); return Object.freeze(value); }
  freeze(config);
  function levelFor(score) {
    if (!Number.isFinite(score) || score < 0 || score > config.cap) throw new Error('风险分数超出有效范围。');
    return config.levels.find(l => score <= l.max);
  }
  function evaluate(input) {
    const order = OrderStore.validate(input);
    const details = config.groups.map(g => ({ field: g.field, title: g.title, value: order[g.field], ...g.bands.find(b => g.field === 'payment' ? b.value === order[g.field] : order[g.field] <= b.max) }));
    const rawScore = details.reduce((sum, d) => sum + d.points, 0);
    const score = Math.min(config.cap, rawScore);
    const level = levelFor(score).key;
    const factors = details.filter(d => d.factor).sort((a, b) => b.points - a.points).map(d => ({ title: d.title, text: d.factor, points: d.points }));
    const priority = { low: '常规复核：本模拟分数较低，仍需核实信息与合同，不代表交易安全。', medium: '重点复核：建议逐项核实风险因素，确认付款与履约安排后再作业务决策。', high: '优先复核：建议提交业务负责人审阅，核实收款保障与交易敞口后再决定后续安排。' }[level];
    return { score, rawScore, level, details, factors, priority, advice: details.map(d => ({ title: d.title, text: d.advice })), version: config.version };
  }
  return { config, evaluate, levelFor };
})();
