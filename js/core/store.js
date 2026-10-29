/**
 * 数据层：全部数据写在 localStorage，不上传、不联网、不需要账号。
 *
 * 分片策略（避免单个 key 无限增长，localStorage 总量约 5MB）：
 *   dk:settings        设置
 *   dk:plans           { '2026-10-26'(周一日期): { items:[...] } }
 *   dk:constraints     约束项数组
 *   dk:budget:2026-10  当月预算（含消费记录）
 *   dk:flags           当天已提示标记（自动清理）
 */
(function (root) {
  'use strict';
  var DK = root.DK = root.DK || {};
  var P = 'dk:';

  var DEFAULT_CATEGORIES = [
    { id: 'food', name: '餐饮' },
    { id: 'traffic', name: '交通' },
    { id: 'shopping', name: '购物' },
    { id: 'fun', name: '娱乐' },
    { id: 'daily', name: '日用' },
    { id: 'other', name: '其他' }
  ];

  function read(key, def) {
    try {
      var raw = localStorage.getItem(P + key);
      if (raw === null || raw === '') return def;
      return JSON.parse(raw);
    } catch (e) {
      console.error('[store] read fail', key, e);
      return def;
    }
  }

  function write(key, val) {
    try {
      localStorage.setItem(P + key, JSON.stringify(val));
      return true;
    } catch (e) {
      console.error('[store] write fail', key, e);
      if (DK.ui && DK.ui.toast) DK.ui.toast('保存失败：本地存储空间不足');
      return false;
    }
  }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* ---------- 设置 ---------- */
  var SETTINGS_DEF = {
    inited: false,
    remindEnabled: true,
    remindTime: '21:00',
    alertRatio: 0.8,
    notifyEnabled: false,
    lastTipDate: ''
  };

  function getSettings() {
    return Object.assign({}, SETTINGS_DEF, read('settings', {}));
  }

  function saveSettings(patch) {
    var s = Object.assign(getSettings(), patch || {});
    write('settings', s);
    return s;
  }

  /* ---------- 每周计划 ---------- */
  function getAllPlans() { return read('plans', {}) || {}; }

  function getWeekPlan(weekKey) {
    var all = getAllPlans();
    return all[weekKey] || { items: [] };
  }

  function saveWeekPlan(weekKey, plan) {
    var all = getAllPlans();
    all[weekKey] = plan;
    write('plans', all);
  }

  function copyWeekPlan(srcKey, dstKey) {
    var src = getWeekPlan(srcKey);
    var dst = getWeekPlan(dstKey);
    dst.items = dst.items || [];
    var exist = {};
    dst.items.forEach(function (i) { exist[i.title + '|' + i.weekday] = true; });
    var added = 0;
    (src.items || []).forEach(function (i) {
      var sig = i.title + '|' + i.weekday;
      if (exist[sig]) return;
      dst.items.push({
        id: uid('t'), title: i.title, note: i.note || '',
        weekday: i.weekday, done: false, doneAt: 0, createdAt: Date.now()
      });
      exist[sig] = true;
      added++;
    });
    saveWeekPlan(dstKey, dst);
    return added;
  }

  /* ---------- 约束 ---------- */
  function getConstraints() { return read('constraints', []) || []; }
  function saveConstraints(list) { write('constraints', list || []); }

  /* ---------- 预算 ---------- */
  function emptyBudget() {
    return {
      income: 0,
      fixed: [],
      savingFixed: 0,   // 每月固定存款（独立于固定支出）
      savingExtra: 0,   // 本月结余转存
      categories: DEFAULT_CATEGORIES.map(function (c) { return { id: c.id, name: c.name, budget: 0 }; }),
      records: []
    };
  }

  function getBudget(monthKey) {
    var data = read('budget:' + monthKey, null);
    if (!data) return emptyBudget();
    return {
      income: Number(data.income) || 0,
      fixed: data.fixed || [],
      savingFixed: Number(data.savingFixed) || 0,
      savingExtra: Number(data.savingExtra) || 0,
      categories: (data.categories && data.categories.length) ? data.categories : emptyBudget().categories,
      records: data.records || []
    };
  }

  function saveBudget(monthKey, budget) { write('budget:' + monthKey, budget); }

  /** 存款总金额：跨所有月份分片累计（固定存款 + 结余转存） */
  function totalSavings() {
    var n = 0;
    allKeys().forEach(function (k) {
      if (k.indexOf('budget:') !== 0) return;
      var d = read(k, null);
      if (d) n += (Number(d.savingFixed) || 0) + (Number(d.savingExtra) || 0);
    });
    return n;
  }

  /* ---------- 当天标记 ---------- */
  function getFlag(key) {
    var flags = read('flags', {}) || {};
    return !!flags[key];
  }

  function setFlag(key) {
    var flags = read('flags', {}) || {};
    flags[key] = Date.now();
    write('flags', flags);
  }

  function cleanFlags() {
    var flags = read('flags', {}) || {};
    var now = Date.now();
    var keep = {};
    Object.keys(flags).forEach(function (k) {
      if (now - flags[k] < 7 * 86400000) keep[k] = flags[k];
    });
    write('flags', keep);
  }

  /* ---------- 导入导出 ---------- */
  function allKeys() {
    var out = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(P) === 0) out.push(k.slice(P.length));
    }
    return out;
  }

  function exportAll() {
    var data = {};
    allKeys().forEach(function (k) { data[k] = read(k, null); });
    return {
      app: 'daily-keeper',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      data: data
    };
  }

  function importAll(payload) {
    if (!payload || !payload.data) throw new Error('文件格式不正确');
    if (payload.app && payload.app !== 'daily-keeper' && payload.app !== 'weekly-keeper') {
      throw new Error('不是本应用导出的数据');
    }
    var n = 0;
    Object.keys(payload.data).forEach(function (k) {
      // 兼容微信小程序版导出的 wk_ 前缀
      var key = k.replace(/^wk_/, '');
      write(key, payload.data[k]);
      n++;
    });
    return n;
  }

  function clearAll() {
    allKeys().forEach(function (k) {
      try { localStorage.removeItem(P + k); } catch (e) {}
    });
  }

  /** 已用体积（KB） */
  function usageKB() {
    var total = 0;
    allKeys().forEach(function (k) {
      total += (localStorage.getItem(P + k) || '').length + k.length;
    });
    return Math.round(total / 1024 * 10) / 10;
  }

  DK.store = {
    DEFAULT_CATEGORIES: DEFAULT_CATEGORIES,
    uid: uid,
    getSettings: getSettings,
    saveSettings: saveSettings,
    getAllPlans: getAllPlans,
    getWeekPlan: getWeekPlan,
    saveWeekPlan: saveWeekPlan,
    copyWeekPlan: copyWeekPlan,
    getConstraints: getConstraints,
    saveConstraints: saveConstraints,
    emptyBudget: emptyBudget,
    getBudget: getBudget,
    saveBudget: saveBudget,
    totalSavings: totalSavings,
    getFlag: getFlag,
    setFlag: setFlag,
    cleanFlags: cleanFlags,
    exportAll: exportAll,
    importAll: importAll,
    clearAll: clearAll,
    usageKB: usageKB
  };
})(typeof window !== 'undefined' ? window : globalThis);
