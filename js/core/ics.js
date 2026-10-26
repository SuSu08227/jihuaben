/**
 * 生成 iCalendar(.ics) 每日提醒事件
 *
 * 为什么用日历做定时提醒：
 *   浏览器/网页应用在完全关闭后无法自行定时推送（这是平台限制，不是实现问题）。
 *   系统日历是手机上唯一「关掉所有 App 也能准时响」的本地能力，
 *   一次导入、永久每天重复，且不需要服务器、不需要账号。
 *
 * 时间采用「浮动时间」（DTSTART 不带 Z 也不带 TZID），
 * 由日历按设备本地时区解释，跨时区也不会偏。
 */
(function (root) {
  'use strict';
  var DK = root.DK = root.DK || {};

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function icsEscape(s) {
    return String(s || '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  /** UTC 时间戳，用于 DTSTAMP */
  function utcStamp(d) {
    return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) +
      'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
  }

  /**
   * @param {Object} o
   * @param {string} o.time  'HH:mm'
   * @param {string} o.title 事件标题
   * @param {string} o.desc  事件描述
   * @param {number} o.durationMinutes 时长，默认 10
   */
  function build(o) {
    var cfg = Object.assign({ time: '21:00', title: '每日复盘 · 计划本', desc: '打开计划本，看看今天的计划和约束完成情况。', durationMinutes: 10 }, o || {});
    var hm = cfg.time.split(':');
    var h = Number(hm[0]) || 21;
    var m = Number(hm[1]) || 0;

    var start = new Date();
    start.setHours(h, m, 0, 0);
    var end = new Date(start.getTime() + cfg.durationMinutes * 60000);

    function local(d) {
      return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
        'T' + pad(d.getHours()) + pad(d.getMinutes()) + '00';
    }

    var lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//daily-keeper//CN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:计划本提醒',
      'BEGIN:VEVENT',
      'UID:dk-daily-reminder@daily-keeper',
      'DTSTAMP:' + utcStamp(new Date()),
      'DTSTART:' + local(start),
      'DTEND:' + local(end),
      'RRULE:FREQ=DAILY',
      'SUMMARY:' + icsEscape(cfg.title),
      'DESCRIPTION:' + icsEscape(cfg.desc),
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'TRIGGER:PT0M',
      'ACTION:DISPLAY',
      'DESCRIPTION:' + icsEscape(cfg.title),
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
      ''
    ];
    return lines.join('\r\n');
  }

  DK.ics = { build: build };
})(typeof window !== 'undefined' ? window : globalThis);
