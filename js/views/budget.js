/**
 * 预算（budget）：收入、固定支出、可支配、分类分配、记账、执行进度
 */
(function (root) {
  'use strict';
  var DK = root.DK;
  var store = DK.store, calc = DK.calc, D = DK.date, esc = DK.ui.esc;

  var state = { monthKey: null };

  function currentMonth() {
    if (!state.monthKey) state.monthKey = D.monthKeyOf(new Date());
    return state.monthKey;
  }

  function render() {
    var mk = currentMonth();
    var budget = store.getBudget(mk);
    var sum = calc.budgetSummary(budget, mk);
    var cats = calc.categoryStats(budget, mk);
    var records = calc.sortedRecords(budget).filter(function (r) {
      return String(r.date || '').slice(0, 7) === mk;
    });
    var isCurrent = mk === D.monthKeyOf(new Date());

    var catName = {};
    (budget.categories || []).forEach(function (c) { catName[c.id] = c.name; });

    var html = '';

    html += '<div class="weekbar">' +
      '<button class="wk-arrow" data-act="shiftMonth" data-n="-1" aria-label="上一月">‹</button>' +
      '<div class="wk-center"><b>' + D.monthLabel(mk) + '</b>' +
        (isCurrent ? '<span class="wk-cur">本月</span>' : '<button class="wk-back" data-act="thisMonth">回到本月</button>') +
      '</div>' +
      '<button class="wk-arrow" data-act="shiftMonth" data-n="1" aria-label="下一月">›</button>' +
    '</div>';

    /* 汇总 */
    html += '<section class="hero-bud">' +
      '<div class="hb-label">本月可支配</div>' +
      '<div class="hb-num">¥' + calc.fmtMoney(sum.disposable) + '</div>' +
      '<div class="hb-row">' +
        '<div><b>¥' + calc.fmtMoney(sum.income) + '</b><span>总收入</span></div>' +
        '<div><b>¥' + calc.fmtMoney(sum.fixedTotal) + '</b><span>固定支出</span></div>' +
        '<div><b>¥' + calc.fmtMoney(sum.spent) + '</b><span>已消费</span></div>' +
        '<div><b class="' + (sum.negative ? 'neg' : '') + '">¥' + calc.fmtMoney(sum.remain) + '</b><span>剩余</span></div>' +
      '</div>' +
      '<div class="bar bar-light mt16"><i style="width:' + sum.spentPercent + '%"></i></div>' +
      '<div class="hb-tip">已消费占可支配 ' + sum.spentPercent + '%' +
        (sum.negative ? ' · 已透支' : '') + '</div>' +
    '</section>';

    /* 收入与固定支出 */
    html += '<section class="card">' +
      '<header class="card-head"><h2>收入与固定支出</h2><button class="link" data-act="editIncome">改收入 ›</button></header>' +
      '<div class="row-line"><span>本月总收入</span><b>¥' + calc.fmtMoney(sum.income) + '</b></div>';
    if (!budget.fixed.length) {
      html += '<div class="empty">还没填固定支出（房租、房贷、会员订阅…）</div>';
    } else {
      budget.fixed.forEach(function (f) {
        html += '<div class="row-line">' +
          '<span>' + esc(f.name) + '</span>' +
          '<span class="row-right"><b class="t-gray">-¥' + calc.fmtMoney(f.amount) + '</b>' +
            '<button class="btn-x" data-act="removeFixed" data-id="' + esc(f.id) + '" aria-label="删除">×</button>' +
          '</span>' +
        '</div>';
      });
    }
    html += '<button class="btn btn-ghost btn-block mt12" data-act="addFixed">＋ 添加固定支出</button>' +
    '</section>';

    /* 分类预算 */
    html += '<section class="card">' +
      '<header class="card-head"><h2>分类预算</h2><button class="link" data-act="addRecord">记一笔 ›</button></header>';
    cats.forEach(function (c) {
      html += '<div class="cat-item" data-act="editCatBudget" data-id="' + esc(c.id) + '">' +
        '<div class="cat-top"><b>' + esc(c.name) + '</b>' +
          '<span class="t-' + c.status + '">¥' + calc.fmtMoney(c.used) + ' / ' + calc.fmtMoney(c.budget) + '</span></div>' +
        '<div class="bar"><i class="bar-' + c.status + '" style="width:' + c.percent + '%"></i></div>' +
        '<div class="cat-foot"><span>' + (c.over ? '超支 ¥' + calc.fmtMoney(c.overAmount) : '剩 ¥' + calc.fmtMoney(c.remain)) + '</span>' +
          '<span class="t-hint">' + (c.budget > 0 ? c.percent + '%' : '未设预算') + '</span></div>' +
      '</div>';
    });
    html += '<div class="divider"></div>' +
      '<div class="row-line"><span class="t-hint">已分配 ¥' + calc.fmtMoney(sum.allocated) + ' / 可支配 ¥' + calc.fmtMoney(sum.disposable) + '</span>' +
        '<b class="' + (sum.overAllocated ? 't-danger' : 't-safe') + '">' +
        (sum.overAllocated ? '超出 ¥' + calc.fmtMoney(-sum.unallocated) : '待分配 ¥' + calc.fmtMoney(sum.unallocated)) + '</b>' +
      '</div>' +
    '</section>';

    /* 消费记录 */
    html += '<section class="card">' +
      '<header class="card-head"><h2>消费记录</h2><span class="t-hint">' + records.length + ' 笔</span></header>';
    if (!records.length) {
      html += '<div class="empty">这个月还没有记录</div>';
    } else {
      records.forEach(function (r) {
        html += '<div class="row-line">' +
          '<div class="row-main">' +
            '<div>' + esc(catName[r.catId] || '其他') + (r.note ? ' · ' + esc(r.note) : '') + '</div>' +
            '<div class="t-hint">' + esc(r.date) + '</div>' +
          '</div>' +
          '<span class="row-right"><b>-¥' + calc.fmtMoney(r.amount) + '</b>' +
            '<button class="btn-x" data-act="removeRecord" data-id="' + esc(r.id) + '" aria-label="删除">×</button>' +
          '</span>' +
        '</div>';
      });
    }
    html += '</section>';

    html += '<button class="fab" data-act="addRecord" aria-label="记一笔">＋</button>';
    return html;
  }

  /* ---------------- 交互 ---------------- */

  function saveAndRefresh(mk, budget, msg) {
    store.saveBudget(mk, budget);
    if (msg) DK.ui.toast(msg);
    DK.app.refresh();
  }

  var actions = {
    shiftMonth: function (ds) {
      state.monthKey = D.shiftMonthKey(currentMonth(), Number(ds.n));
      DK.app.refresh();
    },
    thisMonth: function () {
      state.monthKey = D.monthKeyOf(new Date());
      DK.app.refresh();
    },

    editIncome: function () {
      var mk = currentMonth();
      var budget = store.getBudget(mk);
      DK.ui.form({
        title: '本月总收入',
        desc: D.monthLabel(mk),
        fields: [{ key: 'income', label: '税后到手金额（元）', type: 'number', value: budget.income || '', placeholder: '如 12000', required: true }],
        onSubmit: function (v) {
          budget.income = Number(v.income) || 0;
          saveAndRefresh(mk, budget, '已保存');
        }
      });
    },

    addFixed: function () {
      var mk = currentMonth();
      DK.ui.form({
        title: '添加固定支出',
        fields: [
          { key: 'name', label: '名称', type: 'text', placeholder: '房租 / 房贷 / 会员订阅', required: true },
          { key: 'amount', label: '每月金额（元）', type: 'number', placeholder: '如 3000', required: true }
        ],
        onSubmit: function (v) {
          var budget = store.getBudget(mk);
          budget.fixed.push({ id: store.uid('f'), name: String(v.name).trim(), amount: Number(v.amount) || 0 });
          saveAndRefresh(mk, budget, '已添加');
        }
      });
    },

    removeFixed: function (ds) {
      var mk = currentMonth();
      var budget = store.getBudget(mk);
      var item = budget.fixed.filter(function (f) { return f.id === ds.id; })[0];
      DK.ui.confirm({
        title: '删除这项固定支出？', content: item ? item.name : '', danger: true, okText: '删除',
        onOk: function () {
          budget.fixed = budget.fixed.filter(function (f) { return f.id !== ds.id; });
          saveAndRefresh(mk, budget, '已删除');
        }
      });
    },

    editCatBudget: function (ds) {
      var mk = currentMonth();
      var budget = store.getBudget(mk);
      var cat = (budget.categories || []).filter(function (c) { return c.id === ds.id; })[0];
      if (!cat) return;
      var stat = calc.categoryStats(budget, mk).filter(function (c) { return c.id === ds.id; })[0];
      DK.ui.form({
        title: cat.name + ' · 预算',
        desc: '本月已花 ¥' + calc.fmtMoney(stat.used),
        fields: [{ key: 'budget', label: '本月预算（元）', type: 'number', value: cat.budget || '', placeholder: '如 1500', required: true }],
        onSubmit: function (v) {
          budget.categories.forEach(function (c) { if (c.id === ds.id) c.budget = Number(v.budget) || 0; });
          saveAndRefresh(mk, budget, '已保存');
        }
      });
    },

    addRecord: function () {
      var mk = currentMonth();
      var budget = store.getBudget(mk);
      var cats = budget.categories || [];
      DK.ui.form({
        title: '记一笔',
        fields: [
          { key: 'amount', label: '金额（元）', type: 'number', placeholder: '0.00', required: true },
          {
            key: 'catId', label: '分类', type: 'select', value: cats[0] ? cats[0].id : 'other',
            options: cats.map(function (c) { return { value: c.id, label: c.name }; })
          },
          { key: 'date', label: '日期', type: 'date', value: D.todayStr() },
          { key: 'note', label: '备注（可选）', type: 'text', placeholder: '如 公司楼下的奶茶' }
        ],
        onSubmit: function (v) {
          var amount = Number(v.amount) || 0;
          if (amount <= 0) { DK.ui.toast('金额要大于 0'); return false; }
          var dateStr = v.date || D.todayStr();
          var targetMonth = dateStr.slice(0, 7);        // 按日期归属月份归档，跨月补记不会串账
          var target = store.getBudget(targetMonth);
          target.records.push({
            id: store.uid('r'),
            catId: v.catId,
            amount: amount,
            note: String(v.note || '').trim(),
            date: dateStr,
            ts: Date.now()
          });
          store.saveBudget(targetMonth, target);
          DK.ui.toast(targetMonth === mk ? '已记录' : '已归档到 ' + D.monthLabel(targetMonth));
          DK.app.refresh();
        }
      });
    },

    removeRecord: function (ds) {
      var mk = currentMonth();
      var budget = store.getBudget(mk);
      var rec = (budget.records || []).filter(function (r) { return r.id === ds.id; })[0];
      DK.ui.confirm({
        title: '删除这笔记录？',
        content: rec ? ('¥' + calc.fmtMoney(rec.amount) + (rec.note ? ' · ' + rec.note : '')) : '',
        danger: true, okText: '删除',
        onOk: function () {
          budget.records = budget.records.filter(function (r) { return r.id !== ds.id; });
          saveAndRefresh(mk, budget, '已删除');
        }
      });
    }
  };

  DK.views = DK.views || {};
  DK.views.budget = { render: render, actions: actions, title: '预算' };
  DK.actions = Object.assign(DK.actions || {}, actions);
})(window);
