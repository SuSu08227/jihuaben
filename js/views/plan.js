/**
 * 计划（plan）：周切换、7 天分组、打卡、增删改、复制上周
 */
(function (root) {
  'use strict';
  var DK = root.DK;
  var store = DK.store, D = DK.date, esc = DK.ui.esc;
  var WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  var state = { weekKey: null };

  function currentWeek() {
    if (!state.weekKey) state.weekKey = D.weekKeyOf(new Date());
    return state.weekKey;
  }

  function render() {
    var weekKey = currentWeek();
    var plan = store.getWeekPlan(weekKey);
    var items = (plan.items || []).slice().sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
    var days = D.weekDays(weekKey);
    var isCurrent = weekKey === D.weekKeyOf(new Date());
    var done = items.filter(function (i) { return i.done; }).length;
    var percent = items.length ? Math.round(done / items.length * 100) : 0;

    var html = '';

    html += '<div class="weekbar">' +
      '<button class="wk-arrow" data-act="shiftWeek" data-n="-1" aria-label="上一周">‹</button>' +
      '<div class="wk-center"><b>' + D.weekLabel(weekKey) + '</b>' +
        (isCurrent ? '<span class="wk-cur">本周</span>'
                   : '<button class="wk-back" data-act="thisWeek">回到本周</button>') +
      '</div>' +
      '<button class="wk-arrow" data-act="shiftWeek" data-n="1" aria-label="下一周">›</button>' +
    '</div>';

    html += '<section class="card stat-card">' +
      '<div class="between">' +
        '<div class="stat-inline"><b>' + done + '/' + items.length + '</b><span>已完成 · ' + percent + '%</span></div>' +
        '<button class="btn btn-sm btn-ghost" data-act="copyLastWeek">复制上周</button>' +
      '</div>' +
      '<div class="bar mt12"><i style="width:' + percent + '%"></i></div>' +
    '</section>';

    days.forEach(function (d) {
      var dayItems = items.filter(function (i) { return i.weekday === d.weekday; });
      var dayDone = dayItems.filter(function (i) { return i.done; }).length;

      html += '<section class="day-block' + (d.isToday ? ' is-today' : '') + '">' +
        '<header class="day-head">' +
          '<div class="day-left">' +
            '<b class="' + (d.isToday ? 'today' : '') + '">' + d.name + '</b>' +
            '<span class="day-date">' + d.month + '/' + d.day + '</span>' +
            (d.isToday ? '<span class="tag tag-safe">今天</span>' : '') +
          '</div>' +
          '<div class="day-right">' +
            (dayItems.length ? '<span class="day-count">' + dayDone + '/' + dayItems.length + '</span>' : '') +
            '<button class="day-add" data-act="addTask" data-weekday="' + d.weekday + '" aria-label="添加">＋</button>' +
          '</div>' +
        '</header>';

      if (!dayItems.length) {
        html += '<div class="day-empty">暂无安排</div>';
      } else {
        dayItems.forEach(function (t) {
          html += '<div class="task">' +
            '<span class="check' + (t.done ? ' on' : '') + '" data-act="toggleTask" data-id="' + esc(t.id) + '" data-week="' + weekKey + '">' + (t.done ? '✓' : '') + '</span>' +
            '<div class="task-main" data-act="editTask" data-id="' + esc(t.id) + '">' +
              '<div class="task-title' + (t.done ? ' done' : '') + '">' + esc(t.title) + '</div>' +
              (t.note ? '<div class="task-note">' + esc(t.note) + '</div>' : '') +
            '</div>' +
            '<button class="task-more" data-act="editTask" data-id="' + esc(t.id) + '" aria-label="编辑">···</button>' +
          '</div>';
        });
      }
      html += '</section>';
    });

    html += '<button class="fab" data-act="addTask" data-weekday="0" aria-label="添加安排">＋</button>';
    return html;
  }

  /* ---------------- 交互 ---------------- */

  function openTaskForm(weekday, task) {
    var weekKey = currentWeek();
    var days = D.weekDays(weekKey);
    var todayWd = D.weekdayIndex(new Date());
    var initWeekday = task ? task.weekday : (Number(weekday) || todayWd);

    DK.ui.form({
      title: task ? '编辑安排' : '添加安排',
      desc: D.weekLabel(weekKey),
      fields: [
        { key: 'title', label: '做什么', type: 'text', value: task ? task.title : '', placeholder: '如：跑步 3 公里', required: true },
        {
          key: 'weekday', label: '安排在哪天', type: 'select', value: initWeekday,
          options: days.map(function (d) {
            return { value: d.weekday, label: d.name + ' ' + d.month + '/' + d.day + (d.isToday ? '（今天）' : '') };
          })
        },
        { key: 'note', label: '备注（可选）', type: 'textarea', value: task ? task.note : '', placeholder: '补充说明' }
      ],
      danger: task ? '删除' : '',
      onSubmit: function (v) {
        var plan = store.getWeekPlan(weekKey);
        plan.items = plan.items || [];
        if (task) {
          plan.items.forEach(function (i) {
            if (i.id === task.id) {
              i.title = String(v.title).trim();
              i.note = String(v.note || '').trim();
              i.weekday = Number(v.weekday);
            }
          });
        } else {
          plan.items.push({
            id: store.uid('t'),
            title: String(v.title).trim(),
            note: String(v.note || '').trim(),
            weekday: Number(v.weekday),
            done: false, doneAt: 0, createdAt: Date.now()
          });
        }
        store.saveWeekPlan(weekKey, plan);
        DK.ui.toast('已保存');
        DK.app.refresh();
      },
      onDanger: function () {
        DK.ui.confirm({
          title: '删除这条安排？', content: task ? task.title : '', danger: true, okText: '删除',
          onOk: function () {
            var plan = store.getWeekPlan(weekKey);
            plan.items = (plan.items || []).filter(function (i) { return i.id !== task.id; });
            store.saveWeekPlan(weekKey, plan);
            DK.ui.toast('已删除');
            DK.app.refresh();
          }
        });
      }
    });
  }

  var actions = {
    shiftWeek: function (ds) {
      state.weekKey = D.shiftWeekKey(currentWeek(), Number(ds.n));
      DK.app.refresh();
    },
    thisWeek: function () {
      state.weekKey = D.weekKeyOf(new Date());
      DK.app.refresh();
    },
    addTask: function (ds) { openTaskForm(ds.weekday, null); },
    editTask: function (ds) {
      var plan = store.getWeekPlan(currentWeek());
      var task = (plan.items || []).filter(function (i) { return i.id === ds.id; })[0];
      if (task) openTaskForm(task.weekday, task);
    },
    copyLastWeek: function () {
      var weekKey = currentWeek();
      var lastKey = D.shiftWeekKey(weekKey, -1);
      var n = store.copyWeekPlan(lastKey, weekKey);
      DK.ui.toast(n ? '已复制 ' + n + ' 条安排' : '上周没有可复制的安排');
      DK.app.refresh();
    }
  };

  DK.views = DK.views || {};
  DK.views.plan = { render: render, actions: actions, title: '周计划' };
  DK.actions = Object.assign(DK.actions || {}, actions);
})(window);
