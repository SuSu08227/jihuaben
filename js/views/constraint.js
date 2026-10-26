/**
 * 约束（constraint）：自定义自我约束项、快捷记录、撤销、编辑删除
 */
(function (root) {
  'use strict';
  var DK = root.DK;
  var store = DK.store, calc = DK.calc, D = DK.date, esc = DK.ui.esc;

  var TYPE_OPTIONS = [
    { value: 'count', label: '次数（杯/次/个…）' },
    { value: 'money', label: '金额（元）' },
    { value: 'duration', label: '时长（小时）' }
  ];
  var TYPE_DEFAULT_UNIT = { count: '次', money: '元', duration: '小时' };
  var TYPE_DEFAULT_STEP = { count: 1, money: 10, duration: 1 };

  function render() {
    var now = new Date();
    var settings = store.getSettings();
    var list = store.getConstraints();
    var cards = list.map(function (c) { return calc.constraintCard(c, settings.alertRatio, now); });
    var order = { danger: 0, warn: 1, safe: 2 };
    cards.sort(function (a, b) {
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return a.name.localeCompare(b.name, 'zh');
    });

    var week = cards.filter(function (c) { return c.period === 'week'; });
    var month = cards.filter(function (c) { return c.period === 'month'; });
    var dangerCount = cards.filter(function (c) { return c.status === 'danger'; }).length;

    var html = '';

    html += '<div class="sum-card">' +
      '<div><b>' + week.length + '</b><span>周约束</span></div><i class="sum-line"></i>' +
      '<div><b>' + month.length + '</b><span>月约束</span></div><i class="sum-line"></i>' +
      '<div><b class="' + (dangerCount ? 't-danger' : '') + '">' + dangerCount + '</b><span>已超限</span></div>' +
    '</div>';

    if (!cards.length) {
      html += '<section class="card empty-card">' +
        '<div class="empty-title">给自己划几条红线</div>' +
        '<div class="empty-desc">比如「本周奶茶不超过 2 杯」「本月餐饮不超过 3000 元」<br>超了会变红并置顶提醒</div>' +
        '<button class="btn btn-primary empty-btn" data-act="addConstraint">新建约束项</button>' +
      '</section>';
    }

    function block(title, arr) {
      if (!arr.length) return '';
      var s = '<h3 class="section-title">' + title + '</h3>';
      arr.forEach(function (c) {
        var raw = list.filter(function (x) { return x.id === c.id; })[0] || {};
        var hasLogs = (raw.logs || []).length > 0;
        s += '<section class="c-card c-' + c.status + '">' +
          '<div class="c-head">' +
            '<b class="c-name">' + esc(c.name) + '</b>' +
            '<span class="tag tag-' + c.status + '">' + c.statusText + '</span>' +
          '</div>' +
          '<div class="c-nums">' +
            '<b class="c-cur t-' + c.status + '">' + c.current + '</b>' +
            '<span class="c-target">/ ' + c.target + ' ' + esc(c.unit) + '</span>' +
            '<span class="c-tip t-' + c.status + '">' + c.tip + '</span>' +
          '</div>' +
          '<div class="bar"><i class="bar-' + c.status + '" style="width:' + c.percent + '%"></i></div>' +
          '<div class="c-foot">' +
            '<span class="c-range">' + c.rangeText + (c.bindCategory ? ' · 自动统计消费' : '') + '</span>' +
            '<div class="c-btns">' +
              (hasLogs ? '<button class="btn-mini" data-act="undoLog" data-id="' + esc(c.id) + '">撤销</button>' : '') +
              (c.canLog ? '<button class="btn-mini primary" data-act="quickLog" data-id="' + esc(c.id) + '">+' + c.step + esc(c.unit) + '</button>' : '') +
              '<button class="btn-mini" data-act="editConstraint" data-id="' + esc(c.id) + '">编辑</button>' +
            '</div>' +
          '</div>' +
        '</section>';
      });
      return s;
    }

    html += block('本周约束', week);
    html += block('本月约束', month);

    html += '<button class="fab" data-act="addConstraint" aria-label="新建约束">＋</button>';
    return html;
  }

  function openForm(item) {
    var budget = store.getBudget(D.monthKeyOf(new Date()));
    var catOptions = [{ value: '', label: '不绑定（手动记录）' }].concat(
      (budget.categories || []).map(function (c) { return { value: c.id, label: '自动统计「' + c.name + '」消费' }; })
    );

    DK.ui.form({
      title: item ? '编辑约束项' : '新建约束项',
      desc: '周期到点自动归零：本周约束每周一重置，本月约束每月 1 日重置',
      fields: [
        { key: 'name', label: '约束名称', type: 'text', value: item ? item.name : '', placeholder: '如：奶茶 / 加班 / 本月花费', required: true },
        { key: 'type', label: '类型', type: 'select', value: item ? item.type : 'count', options: TYPE_OPTIONS },
        { key: 'period', label: '周期', type: 'select', value: item ? item.period : 'week', options: [{ value: 'week', label: '本周（每周重置）' }, { value: 'month', label: '本月（每月重置）' }] },
        { key: 'target', label: '上限（目标值）', type: 'number', value: item ? item.target : '', placeholder: '如 2', required: true, half: true },
        { key: 'unit', label: '单位', type: 'text', value: item ? item.unit : '次', placeholder: '杯 / 次 / 元', half: true },
        { key: 'step', label: '每次记录量', type: 'number', value: item ? item.step : 1, hint: '点「+1」按钮时增加的值', half: true },
        {
          key: 'warnRatio', label: '预警阈值', type: 'select', value: item ? item.warnRatio : 0.8, half: true,
          options: [{ value: 0.7, label: '70% 就提醒' }, { value: 0.8, label: '80% 就提醒' }, { value: 0.9, label: '90% 才提醒' }]
        },
        { key: 'bindCategory', label: '自动统计（仅金额类）', type: 'select', value: item ? item.bindCategory : '', options: catOptions, hint: '绑到预算分类后，记一笔账就自动计入，不用手动点' }
      ],
      danger: item ? '删除' : '',
      onReady: function (panel) {
        var typeSel = panel.querySelector('[name="type"]');
        var unitInput = panel.querySelector('[name="unit"]');
        var stepInput = panel.querySelector('[name="step"]');
        typeSel.addEventListener('change', function () {
          unitInput.value = TYPE_DEFAULT_UNIT[typeSel.value] || '次';
          stepInput.value = TYPE_DEFAULT_STEP[typeSel.value] || 1;
        });
      },
      onSubmit: function (v) {
        var list = store.getConstraints();
        var payload = {
          name: String(v.name).trim(),
          type: v.type,
          period: v.period,
          target: Number(v.target),
          unit: String(v.unit || '').trim(),
          step: Number(v.step) || 1,
          warnRatio: Number(v.warnRatio) || 0.8,
          bindCategory: v.type === 'money' ? (v.bindCategory || '') : ''
        };
        if (!payload.target) { DK.ui.toast('上限要大于 0'); return false; }

        if (item) {
          list.forEach(function (c) { if (c.id === item.id) Object.assign(c, payload); });
        } else {
          list.push(Object.assign({ id: store.uid('c'), logs: [], createdAt: Date.now() }, payload));
        }
        store.saveConstraints(list);
        DK.ui.toast('已保存');
        DK.app.refresh();
      },
      onDanger: function () {
        DK.ui.confirm({
          title: '删除约束项？', content: item ? item.name : '', danger: true, okText: '删除',
          onOk: function () {
            store.saveConstraints(store.getConstraints().filter(function (c) { return c.id !== item.id; }));
            DK.ui.toast('已删除');
            DK.app.refresh();
          }
        });
      }
    });
  }

  var actions = {
    addConstraint: function () { openForm(null); },
    editConstraint: function (ds) {
      var item = store.getConstraints().filter(function (c) { return c.id === ds.id; })[0];
      if (item) openForm(item);
    },
    quickLog: function (ds) {
      var list = store.getConstraints();
      var target = list.filter(function (c) { return c.id === ds.id; })[0];
      if (!target) return;
      target.logs = target.logs || [];
      target.logs.push({ ts: Date.now(), value: Number(target.step) || 1 });
      store.saveConstraints(list);
      if (navigator.vibrate) navigator.vibrate(12);

      var card = calc.constraintCard(target, store.getSettings().alertRatio);
      if (card.status === 'danger') {
        DK.ui.toast('⚠ ' + target.name + ' 已超限！');
      } else if (card.status === 'warn') {
        DK.ui.toast('注意：' + target.name + ' ' + card.tip);
      } else {
        DK.ui.toast('已记录 +' + (Number(target.step) || 1) + (target.unit || ''));
      }
      DK.app.refresh();
    },
    undoLog: function (ds) {
      var list = store.getConstraints();
      var target = list.filter(function (c) { return c.id === ds.id; })[0];
      if (!target || !(target.logs || []).length) return;
      target.logs.pop();
      store.saveConstraints(list);
      DK.ui.toast('已撤销最后一次记录');
      DK.app.refresh();
    }
  };

  DK.views = DK.views || {};
  DK.views.constraint = { render: render, actions: actions, title: '自我约束' };
  DK.actions = Object.assign(DK.actions || {}, actions);
})(window);
