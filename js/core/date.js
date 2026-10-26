/**
 * 日期工具（纯函数，无依赖）
 * 约定：一周从周一开始；weekKey = 该周周一的 yyyy-MM-dd
 */
(function (root) {
  'use strict';
  var DK = root.DK = root.DK || {};

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function toDateStr(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function todayStr() { return toDateStr(new Date()); }

  function parseDate(str) {
    var p = String(str).split('-').map(Number);
    return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
  }

  function mondayOf(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var offset = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - offset);
    return d;
  }

  function weekKeyOf(date) { return toDateStr(mondayOf(date || new Date())); }

  function shiftWeekKey(weekKey, n) {
    var d = parseDate(weekKey);
    d.setDate(d.getDate() + n * 7);
    return toDateStr(d);
  }

  function weekRange(weekKey) {
    var s = parseDate(weekKey);
    var e = new Date(s);
    e.setDate(s.getDate() + 6);
    return { start: toDateStr(s), end: toDateStr(e) };
  }

  /** 返回 [{date:'2026-10-26', weekday:1, day:26, isToday:bool}] 周一→周日 */
  function weekDays(weekKey) {
    var start = parseDate(weekKey);
    var today = todayStr();
    var names = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    var out = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(start);
      d.setDate(start.getDate() + i);
      var ds = toDateStr(d);
      out.push({ date: ds, weekday: i + 1, name: names[i], day: d.getDate(), month: d.getMonth() + 1, isToday: ds === today });
    }
    return out;
  }

  /** 1=周一 ... 7=周日 */
  function weekdayIndex(date) { return ((date.getDay() + 6) % 7) + 1; }

  function weekLabel(weekKey) {
    var r = weekRange(weekKey);
    var s = parseDate(r.start), e = parseDate(r.end);
    return (s.getMonth() + 1) + '月' + s.getDate() + '日 - ' + (e.getMonth() + 1) + '月' + e.getDate() + '日';
  }

  function monthKeyOf(date) {
    var d = date || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }

  function shiftMonthKey(monthKey, n) {
    var p = monthKey.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1 + n, 1);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }

  function monthRange(monthKey) {
    var p = monthKey.split('-').map(Number);
    var last = new Date(p[0], p[1], 0).getDate();
    return { start: monthKey + '-01', end: monthKey + '-' + pad(last) };
  }

  function monthLabel(monthKey) {
    var p = monthKey.split('-');
    return p[0] + '年' + Number(p[1]) + '月';
  }

  /** 枚举 start~end 之间的所有月份 key（用于跨月聚合） */
  function monthKeysBetween(start, end) {
    var out = [];
    var cur = start.slice(0, 7);
    var last = end.slice(0, 7);
    var guard = 0;
    while (cur <= last && guard++ < 36) {
      out.push(cur);
      cur = shiftMonthKey(cur, 1);
    }
    return out;
  }

  function nowHM() {
    var d = new Date();
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  DK.date = {
    pad: pad,
    toDateStr: toDateStr,
    todayStr: todayStr,
    parseDate: parseDate,
    mondayOf: mondayOf,
    weekKeyOf: weekKeyOf,
    shiftWeekKey: shiftWeekKey,
    weekRange: weekRange,
    weekDays: weekDays,
    weekdayIndex: weekdayIndex,
    weekLabel: weekLabel,
    monthKeyOf: monthKeyOf,
    shiftMonthKey: shiftMonthKey,
    monthRange: monthRange,
    monthLabel: monthLabel,
    monthKeysBetween: monthKeysBetween,
    nowHM: nowHM
  };
})(typeof window !== 'undefined' ? window : globalThis);
