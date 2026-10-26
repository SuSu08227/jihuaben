/**
 * UI 基础件：toast / confirm / 通用表单弹层 / 文件下载 / 转义
 * 所有弹层都由这里生成，页面只描述字段，不重复写 DOM。
 */
(function (root) {
  'use strict';
  var DK = root.DK = root.DK || {};

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1800);
  }

  function closeTop() {
    var layers = document.querySelectorAll('.mask, .sheet, .dialog');
    var last = layers[layers.length - 1];
    if (last) {
      var group = last.dataset.group;
      if (group) {
        document.querySelectorAll('[data-group="' + group + '"]').forEach(function (n) { n.remove(); });
      } else {
        last.remove();
      }
    }
  }

  function openLayer(html, onMount) {
    var group = 'g' + Date.now() + Math.random().toString(36).slice(2, 5);
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    Array.prototype.forEach.call(wrap.children, function (n) { n.dataset.group = group; document.body.appendChild(n); });
    var root = document.querySelector('.sheet[data-group="' + group + '"], .dialog[data-group="' + group + '"]');
    if (onMount) onMount(root, group);
  }

  /* ---------------- 确认框 ---------------- */
  function confirm(opts) {
    var o = Object.assign({ title: '确认', content: '', okText: '确定', cancelText: '取消', danger: false }, opts || {});
    openLayer(
      '<div class="mask" data-close="1"></div>' +
      '<div class="dialog">' +
        '<div class="dialog-title">' + esc(o.title) + '</div>' +
        (o.content ? '<div class="dialog-content">' + esc(o.content) + '</div>' : '') +
        '<div class="dialog-actions">' +
          '<button class="btn btn-ghost" data-close="1">' + esc(o.cancelText) + '</button>' +
          '<button class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + '" data-ok="1">' + esc(o.okText) + '</button>' +
        '</div>' +
      '</div>',
      function (panel, group) {
        document.querySelectorAll('[data-group="' + group + '"] [data-close]').forEach(function (n) {
          n.addEventListener('click', function () {
            document.querySelectorAll('[data-group="' + group + '"]').forEach(function (x) { x.remove(); });
          });
        });
        panel.querySelector('[data-ok]').addEventListener('click', function () {
          document.querySelectorAll('[data-group="' + group + '"]').forEach(function (x) { x.remove(); });
          if (o.onOk) o.onOk();
        });
      }
    );
  }

  /* ---------------- 通用表单弹层 ----------------
   * fields: [{ key, label, type: text|number|select|date|time|textarea|switch,
   *            value, options:[{value,label}], placeholder, required, hint, step }]
   */
  function fieldHtml(f) {
    var id = 'f_' + f.key;
    var val = (f.value === undefined || f.value === null) ? '' : f.value;
    var common = 'id="' + id + '" name="' + esc(f.key) + '"' + (f.required ? ' required' : '');
    var inner;

    if (f.type === 'select') {
      inner = '<select class="input" ' + common + '>' +
        (f.options || []).map(function (op) {
          return '<option value="' + esc(op.value) + '"' + (String(op.value) === String(val) ? ' selected' : '') + '>' + esc(op.label) + '</option>';
        }).join('') + '</select>';
    } else if (f.type === 'textarea') {
      inner = '<textarea class="input" rows="3" ' + common + ' placeholder="' + esc(f.placeholder || '') + '">' + esc(val) + '</textarea>';
    } else if (f.type === 'switch') {
      inner = '<label class="switch-row"><input type="checkbox" ' + common + (val ? ' checked' : '') + '><span>' + esc(f.switchText || '开启') + '</span></label>';
    } else {
      var type = f.type === 'number' ? 'number' : f.type;
      var extra = '';
      if (f.type === 'number') extra = ' inputmode="decimal" step="' + (f.step || 'any') + '"';
      if (f.type === 'date' && !val) val = '';
      inner = '<input class="input" type="' + type + '" ' + common + extra +
        ' value="' + esc(val) + '" placeholder="' + esc(f.placeholder || '') + '">';
    }

    return '<div class="field' + (f.half ? ' half' : '') + '">' +
      '<label class="field-label" for="' + id + '">' + esc(f.label) + '</label>' + inner +
      (f.hint ? '<div class="field-hint">' + esc(f.hint) + '</div>' : '') +
      '</div>';
  }

  function form(opts) {
    var o = Object.assign({ title: '编辑', fields: [], submitText: '保存' }, opts || {});
    var body = o.fields.map(fieldHtml).join('');

    openLayer(
      '<div class="mask" data-close="1"></div>' +
      '<div class="sheet">' +
        '<div class="sheet-head">' +
          '<div class="sheet-title">' + esc(o.title) + '</div>' +
          '<button class="sheet-close" data-close="1" aria-label="关闭">×</button>' +
        '</div>' +
        (o.desc ? '<div class="sheet-desc">' + esc(o.desc) + '</div>' : '') +
        '<form class="sheet-form" novalidate>' + body + '</form>' +
        '<div class="sheet-actions">' +
          (o.danger ? '<button class="btn btn-danger-ghost" data-danger="1">' + esc(o.danger) + '</button>' : '') +
          '<button class="btn btn-primary btn-submit">' + esc(o.submitText) + '</button>' +
        '</div>' +
      '</div>',
      function (panel, group) {
        function remove() {
          document.querySelectorAll('[data-group="' + group + '"]').forEach(function (x) { x.remove(); });
        }
        panel.querySelectorAll('[data-close]').forEach(function (n) { n.addEventListener('click', remove); });

        if (o.danger) {
          panel.querySelector('[data-danger]').addEventListener('click', function () {
            remove();
            if (o.onDanger) o.onDanger();
          });
        }

        if (o.onReady) o.onReady(panel);

        panel.querySelector('.btn-submit').addEventListener('click', function (e) {
          e.preventDefault();
          var values = {};
          var ok = true;
          o.fields.forEach(function (f) {
            var el = panel.querySelector('[name="' + f.key + '"]');
            if (!el) return;
            var v = f.type === 'switch' ? el.checked : el.value;
            if (f.type === 'number') {
              if (v === '' || v === null) v = f.required ? '' : 0;
              v = v === '' ? '' : Number(v);
            }
            if (f.required && (v === '' || v === undefined || v === null)) {
              ok = false;
              el.classList.add('invalid');
              if (!panel.querySelector('.field-error')) {
                var err = document.createElement('div');
                err.className = 'field-error';
                err.textContent = '请填写「' + f.label + '」';
                panel.querySelector('.sheet-actions').before(err);
              }
            }
            values[f.key] = v;
          });
          if (!ok) return;
          var keep = o.onSubmit(values);
          if (keep !== false) remove();
        });
      }
    );
  }

  /* ---------------- 文件下载 ---------------- */
  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
    return Promise.resolve();
  }

  DK.ui = {
    esc: esc,
    toast: toast,
    confirm: confirm,
    form: form,
    download: download,
    copyText: copyText,
    openLayer: openLayer
  };
})(typeof window !== 'undefined' ? window : globalThis);
