/**
 * 计算层：进度、预警、预算汇总。所有页面共用同一套口径，避免多处算法分叉。
 */
(function (root) {
  'use strict';
  var DK = root.DK = root.DK || {};
  var store = DK.store;
  var dateUtil = DK.date;

  /** 约束三态：<warnRatio 安全；≥warnRatio 警戒；≥1 超限 */
  function statusOf(ratio, warnRatio) {
    var r = Number(ratio) || 0;
    var w = Number(warnRatio) || 0.8;
    if (r >= 1) return 'danger';
    if (r >= w) return 'warn';
    return 'safe';
  }

  function fmtNum(n) {
    var v = Math.round((Number(n) || 0) * 100) / 100;
    return String(v);
  }

  function fmtMoney(n) {
    var v = Math.round((Number(n) || 0) * 100) / 100;
    return v.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  /** 约束周期起止（周 / 月） */
  function periodRange(c, now) {
    var d = now || new Date();
    if (c.period === 'month') return dateUtil.monthRange(dateUtil.monthKeyOf(d));
    return dateUtil.weekRange(dateUtil.weekKeyOf(d));
  }

  function sumRecordsByCategory(start, end, catId) {
    var sum = 0;
    dateUtil.monthKeysBetween(start, end).forEach(function (mk) {
      var b = store.getBudget(mk);
      (b.records || []).forEach(function (r) {
        if (r.catId === catId && r.date >= start && r.date <= end) sum += Number(r.amount) || 0;
      });
    });
    return Math.round(sum * 100) / 100;
  }

  /**
   * 约束当前值：
   *  - 绑定预算分类（金额类）→ 聚合消费记录，记一笔账自动计入；
   *  - 未绑定 → 累加 logs 中落在本周/本月的记录（周期外自动不计，实现"自动归零"）。
   */
  function constraintCurrent(c, now) {
    var range = periodRange(c, now);
    if (c.bindCategory) return sumRecordsByCategory(range.start, range.end, c.bindCategory);

    var weekKey = dateUtil.weekKeyOf(now || new Date());
    var monthKey = dateUtil.monthKeyOf(now || new Date());
    var sum = 0;
    (c.logs || []).forEach(function (l) {
      var d = new Date(l.ts);
      var day = dateUtil.toDateStr(d);
      var hit = c.period === 'month' ? day.slice(0, 7) === monthKey : dateUtil.weekKeyOf(d) === weekKey;
      if (hit) sum += Number(l.value) || 0;
    });
    return Math.round(sum * 100) / 100;
  }

  /** 生成约束展示卡片 */
  function constraintCard(c, warnRatio, now) {
    var current = constraintCurrent(c, now);
    var target = Number(c.target) || 0;
    var ratio = target > 0 ? current / target : 0;
    var status = statusOf(ratio, warnRatio || c.warnRatio);
    var remain = Math.round((target - current) * 100) / 100;

    var tip;
    if (status === 'danger') tip = '已超出 ' + fmtNum(-remain) + (c.unit || '');
    else if (status === 'warn') tip = '接近上限，还剩 ' + fmtNum(remain) + (c.unit || '');
    else tip = '还剩 ' + fmtNum(remain) + (c.unit || '');

    var range = periodRange(c, now);
    return {
      id: c.id,
      name: c.name,
      unit: c.unit || '',
      current: fmtNum(current),
      target: fmtNum(target),
      ratio: ratio,
      percent: target > 0 ? Math.min(100, Math.round(ratio * 100)) : (current > 0 ? 100 : 0),
      status: status,
      tip: tip,
      step: Number(c.step) || 1,
      period: c.period,
      periodText: c.period === 'month' ? '本月' : '本周',
      rangeText: range.start.slice(5) + ' ~ ' + range.end.slice(5),
      statusText: status === 'danger' ? '已超限' : (status === 'warn' ? '接近上限' : '正常'),
      bindCategory: c.bindCategory || '',
      canLog: !c.bindCategory
    };
  }

  /** 预算汇总：monthKey 传入时只统计归属该月的记录（防跨月补记串账） */
  function budgetSummary(budget, monthKey) {
    var income = Number(budget.income) || 0;
    var fixedTotal = (budget.fixed || []).reduce(function (s, f) { return s + (Number(f.amount) || 0); }, 0);
    var disposable = income - fixedTotal;
    var allocated = (budget.categories || []).reduce(function (s, c) { return s + (Number(c.budget) || 0); }, 0);
    var spent = (budget.records || []).filter(function (r) {
      return !monthKey || String(r.date || '').slice(0, 7) === monthKey;
    }).reduce(function (s, r) { return s + (Number(r.amount) || 0); }, 0);

    var remain = disposable - spent;
    return {
      income: income,
      fixedTotal: fixedTotal,
      disposable: disposable,
      allocated: allocated,
      unallocated: disposable - allocated,
      spent: spent,
      remain: remain,
      negative: remain < 0,
      spentPercent: disposable > 0 ? Math.min(100, Math.round(spent / disposable * 100)) : 0,
      overAllocated: allocated > disposable
    };
  }

  /** 分类执行情况 */
  function categoryStats(budget, monthKey) {
    var used = {};
    (budget.records || []).forEach(function (r) {
      if (monthKey && String(r.date || '').slice(0, 7) !== monthKey) return;
      used[r.catId] = (used[r.catId] || 0) + (Number(r.amount) || 0);
    });
    return (budget.categories || []).map(function (c) {
      var b = Number(c.budget) || 0;
      var u = used[c.id] || 0;
      var ratio = b > 0 ? u / b : (u > 0 ? 1.2 : 0);
      return {
        id: c.id,
        name: c.name,
        budget: b,
        used: u,
        remain: b - u,
        over: b - u < 0,
        overAmount: Math.round((u - b) * 100) / 100,
        percent: b > 0 ? Math.min(100, Math.round(ratio * 100)) : (u > 0 ? 100 : 0),
        status: statusOf(ratio, 0.8)
      };
    });
  }

  function sortedRecords(budget) {
    return (budget.records || []).slice().sort(function (a, b) {
      if (a.date === b.date) return (b.ts || 0) - (a.ts || 0);
      return a.date < b.date ? 1 : -1;
    });
  }

  /** 今日提醒文案；返回 null 表示无需提醒 */
  function dailyTipText(weekPlan, constraints, warnRatio, now) {
    var wd = dateUtil.weekdayIndex(now || new Date());
    var items = (weekPlan.items || []).filter(function (i) { return i.weekday === wd; });
    var undone = items.filter(function (i) { return !i.done; }).length;
    var dangers = constraints.filter(function (c) {
      return constraintCard(c, warnRatio, now).status === 'danger';
    }).map(function (c) { return c.name; });

    var parts = [];
    if (undone > 0) parts.push('今天还有 ' + undone + ' 项计划没完成');
    if (dangers.length) parts.push('已超限：' + dangers.join('、'));
    return parts.length ? parts.join('；') : null;
  }

  DK.calc = {
    statusOf: statusOf,
    fmtNum: fmtNum,
    fmtMoney: fmtMoney,
    periodRange: periodRange,
    sumRecordsByCategory: sumRecordsByCategory,
    constraintCurrent: constraintCurrent,
    constraintCard: constraintCard,
    budgetSummary: budgetSummary,
    categoryStats: categoryStats,
    sortedRecords: sortedRecords,
    dailyTipText: dailyTipText
  };
})(typeof window !== 'undefined' ? window : globalThis);
