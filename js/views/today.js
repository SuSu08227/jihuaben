/**
 * 今日（overview）：本周进度、今日打卡、约束预警、预算概览
 */
(function (root) {
  'use strict';
  var DK = root.DK;
  var store = DK.store, calc = DK.calc, D = DK.date, esc = DK.ui.esc;

  function greeting(h) {
    if (h < 6) return '夜深了，早点睡';
    if (h < 11) return '早上好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    if (h < 23) return '晚上好';
    return '夜深了，早点睡';
  }

  function render() {
    var now = new Date();
    var weekKey = D.weekKeyOf(now);
    var plan = store.getWeekPlan(weekKey);
    var items = plan.items || [];

    var doneCount = items.filter(function (i) { return i.done; }).length;
    var wd = D.weekdayIndex(now);
    var todayItems = items.filter(function (i) { return i.weekday === wd; })
      .sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
    var todayDone = todayItems.filter(function (i) { return i.done; }).length;

    var settings = store.getSettings();
    var constraints = store.getConstraints();
    var cards = constraints.map(function (c) { return calc.constraintCard(c, settings.alertRatio, now); });
    var order = { danger: 0, warn: 1, safe: 2 };
    cards.sort(function (a, b) { return order[a.status] - order[b.status]; });
    var alerts = cards.filter(function (c) { return c.status !== 'safe'; });

    var mk = D.monthKeyOf(now);
    var brief = calc.budgetSummary(store.getBudget(mk), mk);
    var weekPercent = items.length ? Math.round(doneCount / items.length * 100) : 0;

    var html = '';

    /* 顶部总览 */
    html += '<section class="hero">' +
      '<div class="hero-date">' + (now.getMonth() + 1) + '月' + now.getDate() + '日 · ' +
        ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][wd - 1] + '</div>' +
      '<div class="hero-title">' + greeting(now.getHours()) + '</div>' +
      '<div class="hero-stats">' +
        '<div class="hstat"><b>' + doneCount + '<i>/' + items.length + '</i></b><span>本周任务</span></div>' +
        '<div class="hstat"><b>' + todayDone + '<i>/' + todayItems.length + '</i></b><span>今日完成</span></div>' +
        '<div class="hstat"><b class="money">¥' + calc.fmtMoney(brief.remain) + '</b><span>本月可用</span></div>' +
      '</div>' +
      '<div class="bar bar-light"><i style="width:' + weekPercent + '%"></i></div>' +
      '<div class="hero-week">' + D.weekLabel(weekKey) + ' · 完成 ' + weekPercent + '%</div>' +
    '</section>';

    /* 预警条 */
    alerts.forEach(function (a) {
      html += '<div class="alert alert-' + a.status + '" data-act="go" data-page="constraint">' +
        '<span class="alert-tag">' + a.statusText + '</span>' +
        '<div class="alert-main"><b>' + esc(a.name) + '</b><span>' + a.current + ' / ' + a.target + esc(a.unit) + ' · ' + a.tip + '</span></div>' +
        '<span class="alert-arrow">›</span>' +
      '</div>';
    });

    /* 今日安排 */
    html += '<section class="card">' +
      '<header class="card-head"><h2>今日安排</h2><button class="link" data-act="go" data-page="plan">全部 ›</button></header>';
    if (!todayItems.length) {
      html += '<div class="empty">今天还没安排，去「计划」加两条</div>';
    } else {
      todayItems.forEach(function (t) {
        html += '<div class="task" data-act="toggleTask" data-id="' + esc(t.id) + '">' +
          '<span class="check' + (t.done ? ' on' : '') + '">' + (t.done ? '✓' : '') + '</span>' +
          '<div class="task-main"><div class="task-title' + (t.done ? ' done' : '') + '">' + esc(t.title) + '</div>' +
          (t.note ? '<div class="task-note">' + esc(t.note) + '</div>' : '') + '</div>' +
        '</div>';
      });
    }
    html += '</section>';

    /* 约束进度 */
    html += '<section class="card">' +
      '<header class="card-head"><h2>约束进度</h2><button class="link" data-act="go" data-page="constraint">管理 ›</button></header>';
    if (!cards.length) {
      html += '<div class="empty">还没有约束项，去「约束」设个上限<br>（奶茶、加班、花销都能设）</div>';
    } else {
      cards.slice(0, 6).forEach(function (c) {
        html += '<div class="c-item">' +
          '<div class="c-top"><b>' + esc(c.name) + '</b><span class="t-' + c.status + '">' + c.current + '/' + c.target + esc(c.unit) + '</span></div>' +
          '<div class="bar"><i class="bar-' + c.status + '" style="width:' + c.percent + '%"></i></div>' +
          '<div class="c-bottom"><span class="t-' + c.status + '">' + c.periodText + ' · ' + c.tip + '</span>' +
            (c.canLog ? '<button class="chip-btn" data-act="quickLog" data-id="' + esc(c.id) + '">+' + c.step + esc(c.unit) + '</button>' : '') +
          '</div>' +
        '</div>';
      });
    }
    html += '</section>';

    /* 预算概览 */
    html += '<section class="card" data-act="go" data-page="budget">' +
      '<header class="card-head"><h2>本月预算</h2><span class="link">明细 ›</span></header>' +
      '<div class="bud-row">' +
        '<div><b>¥' + calc.fmtMoney(brief.disposable) + '</b><span>可支配</span></div>' +
        '<div><b>¥' + calc.fmtMoney(brief.spent) + '</b><span>已支出</span></div>' +
        '<div><b class="' + (brief.negative ? 't-danger' : '') + '">¥' + calc.fmtMoney(brief.remain) + '</b><span>剩余</span></div>' +
      '</div>' +
      '<div class="bar"><i class="' + (brief.spentPercent >= 100 ? 'bar-danger' : '') + '" style="width:' + brief.spentPercent + '%"></i></div>' +
    '</section>';

    return html;
  }

  DK.views = DK.views || {};
  DK.views.today = { render: render, title: '今日' };
})(window);
