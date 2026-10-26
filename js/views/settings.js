/**
 * 我的（settings）：提醒设置、预警阈值、数据备份/恢复/清空、关于
 */
(function (root) {
  'use strict';
  var DK = root.DK;
  var store = DK.store, calc = DK.calc, D = DK.date, esc = DK.ui.esc;

  function stats() {
    var plans = store.getAllPlans();
    var planCount = 0;
    Object.keys(plans).forEach(function (k) { planCount += (plans[k].items || []).length; });

    var mk = D.monthKeyOf(new Date());
    var budget = store.getBudget(mk);

    return {
      planCount: planCount,
      constraintCount: store.getConstraints().length,
      recordCount: (budget.records || []).length,
      usage: store.usageKB()
    };
  }

  function render() {
    var s = store.getSettings();
    var st = stats();
    var notifyOn = s.notifyEnabled && ('Notification' in window) && Notification.permission === 'granted';

    var html = '';

    html += '<div class="sum-card">' +
      '<div><b>' + st.planCount + '</b><span>计划条目</span></div><i class="sum-line"></i>' +
      '<div><b>' + st.constraintCount + '</b><span>约束项</span></div><i class="sum-line"></i>' +
      '<div><b>' + st.recordCount + '</b><span>本月记录</span></div>' +
    '</div>';

    /* 提醒 */
    html += '<section class="card">' +
      '<header class="card-head"><h2>每日提醒</h2>' +
        '<button class="link" data-act="remindHelp">怎么用 ›</button></header>' +

      '<div class="row-line">' +
        '<div class="row-main"><div>提醒时间</div><div class="t-hint">每天到点提醒你复盘</div></div>' +
        '<button class="pill" data-act="setRemindTime">' + esc(s.remindTime) + ' ›</button>' +
      '</div>' +

      '<div class="row-line">' +
        '<div class="row-main"><div>打开时检查</div><div class="t-hint">过点打开应用即弹今日待办与超限项</div></div>' +
        '<button class="pill ' + (s.remindEnabled ? 'on' : '') + '" data-act="toggleRemind">' + (s.remindEnabled ? '已开启' : '已关闭') + '</button>' +
      '</div>' +

      '<div class="row-line">' +
        '<div class="row-main"><div>浏览器通知</div><div class="t-hint">' + (notifyOn ? '已授权，应用开着时可弹系统通知' : '未授权（应用完全关闭时仍无法推送）') + '</div></div>' +
        '<button class="pill ' + (notifyOn ? 'on' : '') + '" data-act="enableNotify">' + (notifyOn ? '已授权' : '去授权') + '</button>' +
      '</div>' +

      '<div class="divider"></div>' +
      '<button class="btn btn-primary btn-block" data-act="exportICS">加入手机日历（每天准时提醒）</button>' +
      '<div class="note">网页应用关掉后无法自己定时推送，系统日历是手机上唯一「关掉也能响」的本地能力。' +
        '点上面按钮生成一个每日重复的日历事件，导入后每天 ' + esc(s.remindTime) + ' 自动提醒，一次搞定、永久有效。</div>' +
    '</section>';

    /* 阈值 */
    html += '<section class="card">' +
      '<header class="card-head"><h2>预警阈值</h2></header>' +
      '<div class="row-line">' +
        '<div class="row-main"><div>达到上限的多少比例开始变橙</div><div class="t-hint">默认 80%，单项可在约束里单独设</div></div>' +
        '<button class="pill" data-act="setRatio">' + Math.round((s.alertRatio || 0.8) * 100) + '% ›</button>' +
      '</div>' +
    '</section>';

    /* 数据 */
    html += '<section class="card">' +
      '<header class="card-head"><h2>数据管理</h2><span class="t-hint">本地占用 ' + st.usage + ' KB</span></header>' +
      '<div class="row-line" data-act="exportJSON">' +
        '<div class="row-main"><div>导出备份文件</div><div class="t-hint">下载 JSON 存到网盘/文件</div></div><span class="alert-arrow">›</span></div>' +
      '<div class="row-line" data-act="copyJSON">' +
        '<div class="row-main"><div>复制备份到剪贴板</div><div class="t-hint">粘到聊天窗口或备忘录</div></div><span class="alert-arrow">›</span></div>' +
      '<div class="row-line" data-act="importJSON">' +
        '<div class="row-main"><div>从备份文件恢复</div><div class="t-hint">选择之前导出的 JSON</div></div><span class="alert-arrow">›</span></div>' +
      '<div class="row-line" data-act="clearAll">' +
        '<div class="row-main"><div class="t-danger">清空全部数据</div><div class="t-hint">不可恢复，先备份</div></div><span class="alert-arrow">›</span></div>' +
    '</section>';

    /* 关于 */
    html += '<section class="card">' +
      '<div class="row-line" data-act="about">' +
        '<div class="row-main"><div>关于</div><div class="t-hint">v1.0.0 · 纯本地 · 无需账号</div></div><span class="alert-arrow">›</span></div>' +
    '</section>';

    html += '<div class="foot-tip">数据保存在这台设备的浏览器里。<br>清浏览器数据 / 换设备前，请先导出备份。</div>';
    return html;
  }

  var actions = {
    setRemindTime: function () {
      var s = store.getSettings();
      DK.ui.form({
        title: '提醒时间',
        fields: [{ key: 'remindTime', label: '每天几点提醒', type: 'time', value: s.remindTime }],
        onSubmit: function (v) {
          store.saveSettings({ remindTime: v.remindTime || '21:00' });
          DK.ui.toast('已设为 ' + (v.remindTime || '21:00'));
          DK.app.refresh();
        }
      });
    },

    toggleRemind: function () {
      var s = store.getSettings();
      store.saveSettings({ remindEnabled: !s.remindEnabled });
      DK.ui.toast(!s.remindEnabled ? '已开启提醒' : '已关闭提醒');
      DK.app.refresh();
    },

    setRatio: function () {
      var s = store.getSettings();
      DK.ui.form({
        title: '预警阈值',
        fields: [{
          key: 'ratio', label: '达到上限的比例', type: 'select', value: s.alertRatio || 0.8,
          options: [{ value: 0.7, label: '70%' }, { value: 0.8, label: '80%' }, { value: 0.9, label: '90%' }]
        }],
        onSubmit: function (v) {
          store.saveSettings({ alertRatio: Number(v.ratio) || 0.8 });
          DK.ui.toast('已保存');
          DK.app.refresh();
        }
      });
    },

    enableNotify: function () {
      if (!('Notification' in window)) {
        DK.ui.confirm({
          title: '这台设备不支持网页通知',
          content: '用下面「加入手机日历」的方式实现每日提醒更可靠。',
          okText: '知道了'
        });
        return;
      }
      Notification.requestPermission().then(function (p) {
        if (p === 'granted') {
          store.saveSettings({ notifyEnabled: true });
          DK.ui.toast('已授权通知');
        } else {
          DK.ui.toast('未授权，可改用日历提醒');
        }
        DK.app.refresh();
      });
    },

    exportICS: function () {
      var s = store.getSettings();
      var content = DK.ics.build({
        time: s.remindTime,
        title: '每日复盘 · 计划本',
        desc: '打开计划本，看看今天的计划和约束完成情况。'
      });
      DK.ui.download('每日提醒.ics', content, 'text/calendar;charset=utf-8');
      DK.ui.confirm({
        title: '日历文件已生成',
        content: '1) 打开下载的文件，选择「日历」导入\n2) 保存后每天 ' + s.remindTime + ' 会自动提醒\n3) 想改时间，回来改完重新导入一次',
        okText: '知道了'
      });
    },

    exportJSON: function () {
      var data = store.exportAll();
      var name = '计划本备份-' + D.todayStr() + '.json';
      DK.ui.download(name, JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
      DK.ui.toast('已导出备份文件');
    },

    copyJSON: function () {
      var data = store.exportAll();
      DK.ui.copyText(JSON.stringify(data)).then(function () {
        DK.ui.toast('已复制，建议粘到聊天窗口保存');
      });
    },

    importJSON: function () {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var payload = JSON.parse(String(reader.result));
            DK.ui.confirm({
              title: '确认恢复？',
              content: '当前数据会被备份内容覆盖。',
              danger: true, okText: '恢复',
              onOk: function () {
                var n = store.importAll(payload);
                DK.ui.toast('已恢复 ' + n + ' 项数据');
                DK.app.refresh();
              }
            });
          } catch (e) {
            DK.ui.confirm({ title: '恢复失败', content: e.message || '文件格式不正确', okText: '知道了' });
          }
        };
        reader.readAsText(file);
      });
      input.click();
    },

    clearAll: function () {
      DK.ui.confirm({
        title: '清空全部数据？',
        content: '计划、约束、预算都会删除，且无法恢复。建议先导出备份。',
        danger: true, okText: '仍然清空',
        onOk: function () {
          store.clearAll();
          store.saveSettings({ inited: true });
          DK.ui.toast('已清空');
          DK.app.refresh();
        }
      });
    },

    remindHelp: function () {
      DK.ui.confirm({
        title: '关于每日提醒',
        content: '微信/浏览器出于安全限制，网页应用关掉后无法自己定时弹通知（这不是本应用的问题，所有网页应用都一样）。\n\n所以提供两种方式：\n① 打开应用时检查 —— 过点后打开，自动弹今日未完成与超限项；\n② 加入手机日历 —— 生成每日重复的日历事件，关掉应用也能准时提醒（推荐）。',
        okText: '明白了'
      });
    },

    about: function () {
      DK.ui.confirm({
        title: '计划本 v1.0.0',
        content: '纯本地个人管理工具：每周计划 + 自我约束 + 预算管理 + 进度预警。\n不联网、不上传、不需要账号，所有数据只存在这台设备。\n\n建议：添加到手机主屏幕使用；定期导出备份。',
        okText: '知道了'
      });
    }
  };

  DK.views = DK.views || {};
  DK.views.settings = { render: render, actions: actions, title: '我的' };
  DK.actions = Object.assign(DK.actions || {}, actions);
})(window);
