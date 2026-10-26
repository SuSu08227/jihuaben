/**
 * 应用入口：hash 路由、事件委托、每日提醒检查
 */
(function (root) {
  'use strict';
  var DK = root.DK;
  var store = DK.store, calc = DK.calc, D = DK.date;

  var ROUTES = ['today', 'plan', 'constraint', 'budget', 'settings'];

  function currentRoute() {
    var h = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return ROUTES.indexOf(h) >= 0 ? h : 'today';
  }

  function render() {
    var route = currentRoute();
    var view = DK.views[route];
    if (!view) return;

    var el = document.getElementById('view');
    el.innerHTML = view.render();
    document.body.dataset.route = route;
    document.title = view.title + ' · 计划本';

    Array.prototype.forEach.call(document.querySelectorAll('#tabbar a'), function (a) {
      a.classList.toggle('active', a.dataset.page === route);
    });
    window.scrollTo(0, 0);
  }

  var refresh = render;

  /* ---------------- 事件委托 ---------------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var fn = DK.actions[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    e.stopPropagation();
    fn(el.dataset, el);
  });

  /* ---------------- 通用动作 ---------------- */
  DK.actions = DK.actions || {};

  DK.actions.go = function (ds) {
    if (!ds.page) return;
    location.hash = '#/' + ds.page;
  };

  DK.actions.toggleTask = function (ds) {
    var weekKey = ds.week || D.weekKeyOf(new Date());
    var plan = store.getWeekPlan(weekKey);
    var hit = false;
    (plan.items || []).forEach(function (i) {
      if (i.id === ds.id) { i.done = !i.done; i.doneAt = i.done ? Date.now() : 0; hit = true; }
    });
    if (!hit) return;
    store.saveWeekPlan(weekKey, plan);
    if (navigator.vibrate) navigator.vibrate(10);
    refresh();
  };

  /* ---------------- 每日提醒 ---------------- */
  function showReminderBar(text) {
    var old = document.getElementById('reminder-bar');
    if (old) old.remove();

    var bar = document.createElement('div');
    bar.id = 'reminder-bar';
    bar.className = 'reminder-bar';
    bar.innerHTML = '<span class="rb-icon">!</span><div class="rb-text">' + DK.ui.esc(text) + '</div>' +
      '<button class="rb-close" aria-label="关闭">×</button>';
    bar.querySelector('.rb-close').addEventListener('click', function () { bar.remove(); });

    var topbar = document.getElementById('topbar');
    topbar.parentNode.insertBefore(bar, topbar.nextSibling);
  }

  function checkRemind() {
    var s = store.getSettings();
    if (!s.remindEnabled) return;

    var today = D.todayStr();
    if (s.lastTipDate === today) return;          // 每天只提示一次
    if (D.nowHM() < (s.remindTime || '21:00')) return; // 未到提醒时间

    var text = calc.dailyTipText(
      store.getWeekPlan(D.weekKeyOf(new Date())),
      store.getConstraints(),
      s.alertRatio,
      new Date()
    );
    store.saveSettings({ lastTipDate: today });
    if (!text) return;

    showReminderBar(text);

    if (s.notifyEnabled && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('今日提醒', { body: text, icon: 'assets/icons/icon-192.png', tag: 'dk-daily' });
      } catch (e) { /* 部分浏览器要求 ServiceWorker 通知，忽略 */ }
    }
  }

  function onVisible() {
    if (document.visibilityState === 'visible') checkRemind();
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    store.cleanFlags();
    if (!store.getSettings().inited) store.saveSettings({ inited: true });
    render();
    setTimeout(checkRemind, 600);
    setInterval(checkRemind, 60000);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('hashchange', render);

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  DK.app = { refresh: refresh, render: render, init: init, currentRoute: currentRoute };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
