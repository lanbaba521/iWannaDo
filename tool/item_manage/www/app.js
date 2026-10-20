import { Storage, Flags } from './storage.js';
import { dateString, todayString, shiftDays, itemSoonDays, expiryStatus, expiryLabel, formatMoney, sumMoney, localDateOf, dayLabel, displayDate, reminderPlan, validateItems, validateBackupItems, mergeItems, matchesDateFilter } from './logic.js';

const elements = {
  expiredCount: document.querySelector('#expired-count'),
  soonCount: document.querySelector('#soon-count'),
  totalCount: document.querySelector('#total-count'),
  totalAmount: document.querySelector('#total-amount'),
  expiredCard: document.querySelector('#stat-expired'),
  soonCard: document.querySelector('#stat-soon'),
  totalCard: document.querySelector('#stat-total'),
  amountCard: document.querySelector('#stat-amount'),
  dateFilter: document.querySelector('#date-filter'),
  dateFilterParts: document.querySelectorAll('#date-filter .date-filter'),
  search: document.querySelector('#search-input'),
  filters: document.querySelector('#category-filters'),
  list: document.querySelector('#item-list'),
  modal: document.querySelector('#item-modal'),
  form: document.querySelector('#item-form'),
  formTitle: document.querySelector('#form-title'),
  name: document.querySelector('#item-name'),
  category: document.querySelector('#item-category'),
  categoryOptions: document.querySelector('#item-category-options'),
  quantity: document.querySelector('#item-quantity'),
  amount: document.querySelector('#item-amount'),
  soonDays: document.querySelector('#item-soon-days'),
  producedPicker: document.querySelector('#produced-picker'),
  expiryPicker: document.querySelector('#expiry-picker'),
  location: document.querySelector('#item-location'),
  note: document.querySelector('#item-note'),
  delete: document.querySelector('#delete-button'),
  importFile: document.querySelector('#import-file'),
  dialog: document.querySelector('#app-dialog'),
  dialogTitle: document.querySelector('#dialog-title'),
  dialogText: document.querySelector('#dialog-text'),
  dialogCancel: document.querySelector('#dialog-cancel'),
  dialogConfirm: document.querySelector('#dialog-confirm'),
  brandButton: document.querySelector('#brand-button'),
  intro: document.querySelector('#intro-dialog'),
  introClose: document.querySelector('#intro-close'),
  introNever: document.querySelector('#intro-never'),
  introCopy: document.querySelector('#intro-copy')
};

const CATEGORY_PRESETS = ['数码', '服饰', '食品', '日用', '文具', '药品', '工具', '运动'];

let items = [];
let selectedCategory = '全部';
let editingId = null;
let storageReady = false;
let categoryCustomOpen = false;
let customCategoryDraft = '';
let statusFilter = 'all';
let ledgerYear = '';
let ledgerMonth = '';
let ledgerDay = '';
let introDismissed = false;
// 应用开关缓存：读取一次后整体写回，避免新增字段时把旧字段覆盖掉。
let appFlags = {};

const INTRO_URL = 'https://github.com/lanbaba521/iWannaDo.git';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function pickerValue(picker) {
  return picker.dataset.value || '';
}

function setPickerValue(picker, value) {
  picker.dataset.value = value;
  picker.dataset.view = value || todayString();
  picker.dataset.open = 'false';
  renderPickerValue(picker);
  renderCalendar(picker);
}

function renderPickerValue(picker) {
  const value = pickerValue(picker);
  const valueButton = picker.querySelector('[data-role="value"]');
  valueButton.textContent = value ? displayDate(value) : '未设置';
  valueButton.classList.toggle('filled', Boolean(value));
  picker.querySelector('[data-role="clear"]').hidden = !value;
}

function renderCalendar(picker) {
  const calendar = picker.querySelector('[data-role="calendar"]');
  const view = new Date(`${picker.dataset.view || todayString()}T00:00:00`);
  const year = view.getFullYear();
  const month = view.getMonth();
  const selected = pickerValue(picker);
  const today = todayString();

  const head = createElement('div', 'cal-head');
  const previous = createElement('button', 'cal-nav', '‹');
  previous.type = 'button';
  previous.dataset.step = '-1';
  const next = createElement('button', 'cal-nav', '›');
  next.type = 'button';
  next.dataset.step = '1';
  head.append(previous, createElement('span', 'cal-title', `${year}年${month + 1}月`), next);

  const week = createElement('div', 'cal-week');
  for (const label of WEEKDAY_LABELS) week.append(createElement('span', '', label));

  const grid = createElement('div', 'cal-grid');
  const firstWeekday = new Date(year, month, 1).getDay();
  for (let index = 0; index < firstWeekday; index += 1) grid.append(createElement('span', 'cal-empty'));
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day += 1) {
    const value = dateString(new Date(year, month, day));
    const cell = createElement('button', 'cal-day', String(day));
    cell.type = 'button';
    cell.dataset.day = value;
    if (value === today) cell.classList.add('today');
    if (value === selected) cell.classList.add('selected');
    grid.append(cell);
  }

  calendar.replaceChildren(head, week, grid);
  calendar.hidden = picker.dataset.open !== 'true';
}

function closeCalendars() {
  for (const picker of document.querySelectorAll('.date-picker')) {
    picker.dataset.open = 'false';
    picker.querySelector('[data-role="calendar"]').hidden = true;
  }
}

function handlePickerClick(event) {
  const button = event.target.closest('button');
  if (!button) return;
  const picker = event.currentTarget;

  if (button.dataset.role === 'value') {
    const willOpen = picker.dataset.open !== 'true';
    closeCalendars();
    if (willOpen) {
      picker.dataset.open = 'true';
      picker.dataset.view = pickerValue(picker) || todayString();
      renderCalendar(picker);
    }
    return;
  }

  if (button.dataset.role === 'clear') {
    picker.dataset.value = '';
    picker.dataset.view = todayString();
    renderPickerValue(picker);
    closeCalendars();
    return;
  }

  if (button.dataset.shift !== undefined) {
    picker.dataset.value = shiftDays(pickerValue(picker), Number(button.dataset.shift));
    picker.dataset.view = picker.dataset.value;
    renderPickerValue(picker);
    renderCalendar(picker);
    return;
  }

  if (button.dataset.step !== undefined) {
    const view = new Date(`${picker.dataset.view || todayString()}T00:00:00`);
    const month = view.getMonth() + Number(button.dataset.step);
    picker.dataset.view = dateString(new Date(view.getFullYear(), month, 1));
    renderCalendar(picker);
    return;
  }

  if (button.dataset.day) {
    picker.dataset.value = button.dataset.day;
    picker.dataset.view = button.dataset.day;
    renderPickerValue(picker);
    closeCalendars();
  }
}

function setupDatePicker(picker) {
  picker.addEventListener('click', handlePickerClick);
  setPickerValue(picker, '');
}

let dialogResolve = null;
// 「取消」按钮的返回值，默认 false；个别场景（如导出选择）需要区分「取消」与「关闭弹窗」。
let dialogCancelValue = false;

function openDialog({ title, message, confirmText = '确定', cancelText = '取消', danger = false, cancellable = true, cancelValue = false }) {
  elements.dialogTitle.textContent = title;
  elements.dialogText.textContent = message;
  elements.dialogConfirm.textContent = confirmText;
  elements.dialogConfirm.classList.toggle('danger', danger);
  elements.dialogCancel.textContent = cancelText;
  elements.dialogCancel.hidden = !cancellable;
  dialogCancelValue = cancelValue;
  elements.dialog.hidden = false;
  return new Promise((resolve) => {
    dialogResolve = resolve;
  });
}

function closeDialog(result) {
  if (elements.dialog.hidden) return;
  elements.dialog.hidden = true;
  const resolve = dialogResolve;
  dialogResolve = null;
  if (resolve) resolve(result);
}

function confirmDialog(options) {
  return openDialog(options);
}

function alertDialog({ title, message, confirmText = '知道了' }) {
  return openDialog({ title, message, confirmText, cancellable: false });
}

function openIntro() {
  elements.intro.hidden = false;
}

async function closeIntro(never) {
  elements.intro.hidden = true;
  if (!never) return;
  introDismissed = true;
  appFlags.introDismissed = true;
  try {
    await Flags.push(appFlags);
  } catch (error) {
    console.error('保存提示状态失败：', error);
  }
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function makeCategoryChip(label, active, datasetKey) {
  const button = createElement('button', 'category-chip', label);
  button.type = 'button';
  button.dataset[datasetKey] = 'true';
  button.classList.toggle('active', active);
  button.setAttribute('aria-pressed', String(active));
  return button;
}

function renderCategoryOptions() {
  elements.categoryOptions.replaceChildren(
    ...CATEGORY_PRESETS.map((preset) => makeCategoryChip(preset, !categoryCustomOpen && elements.category.value === preset, 'category')),
    makeCategoryChip('其他', categoryCustomOpen, 'custom')
  );
  elements.category.hidden = !categoryCustomOpen;
}

function makeId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function activeItems() {
  return items.filter((item) => !item.deleted);
}

function renderStats() {
  const active = activeItems();
  const today = todayString();
  let expired = 0;
  let soon = 0;
  for (const item of active) {
    const status = expiryStatus(item, today);
    if (status === 'expired') expired += 1;
    else if (status === 'soon') soon += 1;
  }

  elements.expiredCount.textContent = String(expired);
  elements.soonCount.textContent = String(soon);
  elements.totalCount.textContent = String(active.length);
  elements.totalAmount.textContent = sumMoney(active.map((item) => item.amount)).toFixed(2);

  for (const [card, status] of [
    [elements.expiredCard, 'expired'],
    [elements.soonCard, 'soon'],
    [elements.totalCard, 'all'],
    [elements.amountCard, 'ledger']
  ]) {
    const isActive = statusFilter === status;
    card.classList.toggle('active', isActive);
    card.setAttribute('aria-pressed', String(isActive));
  }
}

function renderFilters() {
  const categories = [...new Set(activeItems()
    .map((item) => item.category.trim())
    .filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, 'zh-CN'));
  const options = ['全部', ...categories];
  if (!options.includes(selectedCategory)) selectedCategory = '全部';

  elements.filters.replaceChildren();
  for (const category of options) {
    const button = createElement('button', 'category-chip', category);
    button.type = 'button';
    button.dataset.category = category;
    button.classList.toggle('active', category === selectedCategory);
    button.setAttribute('aria-pressed', String(category === selectedCategory));
    elements.filters.append(button);
  }
}

function renderItem(item) {
  const card = createElement('article', 'item-card');
  const top = createElement('div', 'item-card-top');
  const name = createElement('h3', 'item-name', item.name);
  const quantity = createElement('span', 'item-quantity', `× ${item.qty}`);
  top.append(name, quantity);

  const tags = createElement('div', 'item-tags');
  tags.append(createElement('span', 'tag', item.category.trim() || '未分类'));
  if (item.location.trim()) tags.append(createElement('span', 'tag location', item.location));
  if (item.amount > 0) tags.append(createElement('span', 'tag amount', formatMoney(item.amount)));
  if (item.produced) tags.append(createElement('span', 'tag produced', `生产 ${item.produced}`));
  if (item.expiry) {
    const today = todayString();
    const status = expiryStatus(item, today);
    tags.append(createElement('span', `tag expiry ${status}`, expiryLabel(item.expiry, status, today)));
  }
  card.append(top, tags);

  if (item.note.trim()) card.append(createElement('p', 'item-note', item.note));

  card.addEventListener('click', () => openEditor(item.id));
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `${item.name}，数量 ${item.qty}，点击编辑`);
  card.addEventListener('keydown', (event) => {
    if (event.target === card && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      openEditor(item.id);
    }
  });
  return card;
}

function buildDayGroup(day, dayItems, isNewest) {
  const total = sumMoney(dayItems.map((item) => item.amount));
  const summary = createElement('summary', 'day-summary');
  summary.append(
    createElement('span', 'day-date', dayLabel(day)),
    createElement('span', 'day-meta', total > 0 ? `${dayItems.length} 件 · ${formatMoney(total)}` : `${dayItems.length} 件`),
    createElement('span', 'day-chevron', '⌄')
  );

  const body = createElement('div', 'day-body');
  body.append(...dayItems.map(renderItem));

  const group = createElement('details', 'day-group');
  group.open = isNewest;
  group.append(summary, body);
  return group;
}

function buildDayGroups(visibleItems) {
  const groups = new Map();
  for (const item of visibleItems) {
    const day = localDateOf(item.createdAt);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(item);
  }

  return [...groups.keys()]
    .sort((left, right) => right.localeCompare(left))
    .map((day, index) => buildDayGroup(day, groups.get(day), index === 0));
}

const DATE_MONTHS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const DATE_DAYS = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, '0'));

function datePartText(key, value) {
  if (!value) return '';
  if (key === 'year') return `${value}年`;
  return `${Number(value)}${key === 'month' ? '月' : '日'}`;
}

function syncDatePart(key, raw) {
  const text = raw.replace(/\D/g, '');
  if (key === 'year') {
    ledgerYear = text.length === 4 ? text : '';
    return;
  }
  const value = text && text.length <= 2 ? text.padStart(2, '0') : '';
  if (key === 'month') ledgerMonth = value;
  else ledgerDay = value;
}

function renderDateFilter(syncInputs = true) {
  const dates = activeItems().map((item) => localDateOf(item.createdAt));
  const years = [...new Set(dates.map((day) => day.slice(0, 4)))]
    .sort((left, right) => right.localeCompare(left));
  if (ledgerYear && !years.includes(ledgerYear)) {
    ledgerYear = '';
    ledgerMonth = '';
    ledgerDay = '';
  }

  const months = ledgerYear
    ? [...new Set(dates.filter((day) => day.slice(0, 4) === ledgerYear).map((day) => day.slice(5, 7)))].sort()
    : DATE_MONTHS;
  if (ledgerMonth && !months.includes(ledgerMonth)) {
    ledgerMonth = '';
    ledgerDay = '';
  }

  const days = ledgerYear && ledgerMonth
    ? [...new Set(dates
      .filter((day) => day.slice(0, 7) === `${ledgerYear}-${ledgerMonth}`)
      .map((day) => day.slice(8, 10)))].sort()
    : DATE_DAYS;
  if (ledgerDay && !days.includes(ledgerDay)) ledgerDay = '';

  const selected = { year: ledgerYear, month: ledgerMonth, day: ledgerDay };
  const options = { year: years, month: months, day: days };

  for (const part of elements.dateFilterParts) {
    const key = part.dataset.part;
    const value = selected[key];
    if (syncInputs) {
      part.querySelector('.date-filter-input').value = value
        ? (key === 'year' ? value : String(Number(value)))
        : '';
    }

    const items = [['', '全部'], ...options[key].map((option) => [option, datePartText(key, option)])];
    part.querySelector('.date-filter-menu').replaceChildren(...items.map(([optionValue, text]) => {
      const button = createElement('button', 'date-filter-option', text);
      button.type = 'button';
      button.dataset.value = optionValue || 'all';
      button.classList.toggle('active', optionValue === value);
      return button;
    }));
  }
}

function closeDateMenus() {
  for (const part of elements.dateFilterParts) {
    part.classList.remove('open');
    part.querySelector('.date-filter-menu').hidden = true;
  }
}

function renderList() {
  const query = elements.search.value.trim().toLocaleLowerCase('zh-CN');
  const today = todayString();
  const visible = activeItems().filter((item) => {
    const matchesCategory = selectedCategory === '全部' || item.category.trim() === selectedCategory;
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'ledger' ? item.amount > 0 : expiryStatus(item, today) === statusFilter);
    const searchableText = [item.name, item.category, item.location, item.note]
      .join(' ')
      .toLocaleLowerCase('zh-CN');
    return matchesCategory && matchesStatus && matchesDateFilter(item, { year: ledgerYear, month: ledgerMonth, day: ledgerDay }) && searchableText.includes(query);
  });

  if (visible.length === 0) {
    const noItemsAtAll = activeItems().length === 0;
    const empty = createElement('div', 'empty-state');
    empty.append(
      createElement('span', 'empty-icon', noItemsAtAll ? '📦' : '⌕'),
      createElement('span', '', noItemsAtAll
        ? '还没有物品，点击下方按钮添加第一件吧。'
        : '没有符合条件的物品，换个筛选或关键词试试。')
    );
    elements.list.replaceChildren(empty);
    return;
  }

  elements.list.replaceChildren(...(statusFilter === 'ledger' ? buildDayGroups(visible) : visible.map(renderItem)));
}

function render() {
  renderStats();
  renderDateFilter();
  renderFilters();
  renderList();
}

function setStatusFilter(status) {
  statusFilter = status;
  render();
}

function openEditor(id = null) {
  if (!storageReady) return;
  editingId = id;
  const item = id === null ? null : items.find((entry) => entry.id === id && !entry.deleted);
  elements.form.reset();
  elements.formTitle.textContent = item ? '编辑物品' : '添加物品';
  elements.name.value = item?.name ?? '';
  elements.category.value = item?.category ?? '';
  categoryCustomOpen = elements.category.value !== '' && !CATEGORY_PRESETS.includes(elements.category.value);
  customCategoryDraft = categoryCustomOpen ? elements.category.value : '';
  renderCategoryOptions();
  elements.quantity.value = String(item?.qty ?? 1);
  elements.amount.value = item && item.amount > 0 ? String(item.amount) : '';
  elements.soonDays.value = String(itemSoonDays(item));
  setPickerValue(elements.producedPicker, item?.produced ?? '');
  setPickerValue(elements.expiryPicker, item?.expiry ?? '');
  elements.location.value = item?.location ?? '';
  elements.note.value = item?.note ?? '';
  elements.delete.hidden = !item;
  elements.modal.hidden = false;
  document.body.style.overflow = 'hidden';
  elements.name.focus({ preventScroll: true });
}

function closeEditor() {
  elements.modal.hidden = true;
  document.body.style.overflow = '';
  editingId = null;
}

// 安卓本地提醒：临期、过期各一条，统一在当天 09:00 触发。
// 每次数据变化都重排：先取消本应用已排期的通知，再按最新物品重新生成。
const REMINDER_CHANNEL = 'item-reminders';
const REMINDER_HOUR = 9;

// 通知 ID：物品 ID 哈希 ×2 + 类型位（expired=1），同一物品的不同提醒互不冲突。
function reminderId(itemId, kind) {
  let hash = 0;
  for (let index = 0; index < itemId.length; index += 1) {
    hash = (hash * 31 + itemId.charCodeAt(index)) % 1000000000;
  }
  return hash * 2 + (kind === 'expired' ? 1 : 0);
}

async function syncReminders() {
  const local = window.Capacitor?.Plugins?.LocalNotifications;
  if (!local) return;

  try {
    const permission = await local.checkPermissions();
    if (permission.display !== 'granted') return;

    await local.createChannel({
      id: REMINDER_CHANNEL,
      name: '物品提醒',
      description: '物品临期与过期提醒',
      importance: 4
    });

    const pending = await local.getPending();
    const scheduled = pending.notifications ?? [];
    if (scheduled.length) {
      await local.cancel({ notifications: scheduled.map(({ id }) => ({ id })) });
    }

    const now = Date.now();
    const notifications = reminderPlan(activeItems(), todayString())
      .map((entry) => {
        const at = new Date(`${entry.date}T${String(REMINDER_HOUR).padStart(2, '0')}:00:00`);
        if (Number.isNaN(at.getTime()) || at.getTime() <= now) return null;
        return {
          id: reminderId(entry.itemId, entry.kind),
          title: entry.kind === 'expired' ? '物品已到期' : '物品临期提醒',
          body: entry.kind === 'expired'
            ? `「${entry.name}」已于 ${entry.expiry} 到期，请及时处理。`
            : `「${entry.name}」将于 ${entry.expiry} 到期，请及时处理。`,
          channelId: REMINDER_CHANNEL,
          autoCancel: true,
          // 不申请「闹钟与提醒」特殊权限，按非精确闹钟排期，避免弹出系统设置页。
          isExactNotification: false,
          schedule: { at, allowWhileIdle: true }
        };
      })
      .filter(Boolean);

    if (notifications.length) await local.schedule({ notifications });
  } catch (error) {
    console.error('同步物品提醒失败：', error);
  }
}

// 启动时确认通知权限：未开启则先弹系统授权，仍被拒绝时提示用户提醒不会正常送达。
// 用户选择「不再提示」后写入应用开关，之后不再弹这个说明。
async function ensureReminderPermission() {
  const local = window.Capacitor?.Plugins?.LocalNotifications;
  if (!local) return;

  try {
    const current = await local.checkPermissions();
    if (current.display === 'granted') {
      await syncReminders();
      return;
    }

    // 已选过「不再提示」时不再反复弹系统授权与应用内说明；仍可在系统设置里手动开启。
    if (appFlags.reminderHintDismissed === true) return;

    const asked = await local.requestPermissions();
    if (asked.display === 'granted') {
      await syncReminders();
      return;
    }

    const choice = await confirmDialog({
      title: '通知权限未开启',
      message: '未开启通知权限，临期提醒和过期提醒将无法正常送达。本应用的通知仅用于临期与过期提醒，可前往系统设置开启。',
      confirmText: '关闭',
      cancelText: '不再提示',
      cancelValue: 'never'
    });
    if (choice === 'never') {
      appFlags.reminderHintDismissed = true;
      try {
        await Flags.push(appFlags);
      } catch (error) {
        console.error('保存通知提示状态失败：', error);
      }
    }
  } catch (error) {
    console.error('检查通知权限失败：', error);
  }
}

async function saveItems(nextItems) {
  try {
    await Storage.push(nextItems);
    items = nextItems;
    render();
    // 提醒重排放到后台执行，不阻塞保存与界面关闭。
    syncReminders();
    return true;
  } catch (error) {
    console.error('保存物品失败：', error);
    await alertDialog({ title: '保存失败', message: error.message || '请检查存储权限后重试。' });
    return false;
  }
}

async function handleSave(event) {
  event.preventDefault();
  const name = elements.name.value.trim();
  const qtyValue = elements.quantity.value;
  const qty = Number(qtyValue);
  if (!name) {
    elements.name.setCustomValidity('请输入物品名称。');
    elements.name.reportValidity();
    elements.name.setCustomValidity('');
    elements.name.focus();
    return;
  }
  if (qtyValue.trim() === '' || !Number.isInteger(qty) || qty < 0) {
    elements.quantity.setCustomValidity('数量必须是非负整数。');
    elements.quantity.reportValidity();
    elements.quantity.setCustomValidity('');
    elements.quantity.focus();
    return;
  }

  const amountValue = elements.amount.value.trim();
  const amount = amountValue === '' ? 0 : Number(amountValue);
  if (!Number.isFinite(amount) || amount < 0) {
    elements.amount.setCustomValidity('金额必须是大于等于 0 的数字。');
    elements.amount.reportValidity();
    elements.amount.setCustomValidity('');
    elements.amount.focus();
    return;
  }

  const soonValue = elements.soonDays.value;
  const soonDays = Number(soonValue);
  if (soonValue.trim() === '' || !Number.isInteger(soonDays) || soonDays < 1) {
    elements.soonDays.setCustomValidity('临期天数必须是正整数。');
    elements.soonDays.reportValidity();
    elements.soonDays.setCustomValidity('');
    elements.soonDays.focus();
    return;
  }

  const now = new Date().toISOString();
  const existing = editingId === null ? null : items.find((item) => item.id === editingId);
  const item = {
    id: existing?.id ?? makeId(),
    name,
    category: elements.category.value.trim(),
    qty,
    amount,
    soonDays,
    produced: pickerValue(elements.producedPicker),
    expiry: pickerValue(elements.expiryPicker),
    location: elements.location.value.trim(),
    note: elements.note.value.trim(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    deleted: false
  };
  const nextItems = existing
    ? items.map((entry) => entry.id === existing.id ? item : entry)
    : [...items, item];

  if (await saveItems(nextItems)) closeEditor();
}

async function handleDelete() {
  const item = items.find((entry) => entry.id === editingId && !entry.deleted);
  if (!item) return;
  const confirmed = await confirmDialog({
    title: '删除物品',
    message: `确定删除“${item.name}”吗？删除后无法恢复，如需保留请先导出备份。`,
    confirmText: '删除',
    danger: true
  });
  if (!confirmed) return;
  // 直接移除记录，不做软删除：本地不留任何界面上看不到的数据。
  const nextItems = items.filter((entry) => entry.id !== item.id);
  if (await saveItems(nextItems)) closeEditor();
}

// 安卓端 WebView 不响应 <a download>，因此提供两条导出通路：
// 1. 保存到本机：调起系统「另存为」界面（SAF），用户可自选目录与文件名；
//    若之前保存过，会先询问是否直接覆盖上次那个文件，换路径则新建；
//    另存为会尝试用目录级 URI 预置上次保存的位置（各厂商支持不一，不保证生效）。
// 2. 分享：写入应用缓存目录后调起系统分享面板，可直接发给其他应用。
// 浏览器端仍走普通下载。

// 从记录的展示路径推导「目录」URI。各厂商文件选择器对 EXTRA_INITIAL_URI 支持不一，
// DownloadsProvider 的文件 URI 常被忽略，改用 ExternalStorageProvider 的目录 URI 兼容性更好。
function backupDirUri(path) {
  if (typeof path !== 'string' || !path) return null;
  const segments = path.split('/').filter(Boolean);
  if (segments[0] === '内部存储') {
    segments.shift();
  } else if (segments[0] === 'storage' && segments[1] === 'emulated') {
    // 兼容旧记录里的 /storage/emulated/0/... 原始路径。
    segments.splice(0, 3);
  }
  if (segments.length < 2) return null;
  const dir = segments.slice(0, -1).join('/').replace(/^下载(?=\/|$)/, 'Download');
  if (!dir) return null;
  return `content://com.android.externalstorage.documents/document/${encodeURIComponent(`primary:${dir}`)}`;
}

// 记录上次导出的备份位置（只存应用开关，不进备份文件），供下次覆盖与导入时提示。
async function rememberBackupLocation(info) {
  if (!info?.uri) return;
  appFlags.lastBackup = {
    uri: info.uri,
    name: info.name || '',
    path: info.path || info.name || ''
  };
  try {
    await Flags.push(appFlags);
  } catch (error) {
    console.error('记录备份位置失败：', error);
  }
}

async function exportBackup() {
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    // 只导出界面上可见的物品，备份内容与所见一致。
    items: activeItems()
  };
  const json = JSON.stringify(backup, null, 2);
  const filename = `物品管家备份-${todayString()}.json`;
  const plugins = window.Capacitor?.Plugins;

  if (plugins?.SaveAs || plugins?.Share) {
    // 覆盖必须用文件级 URI；定位目录用兼容性更好的目录 URI，取不到再退回文件 URI。
    const saved = plugins?.SaveAs ? appFlags.lastBackup : null;
    let overwriteUri = saved?.uri ?? null;
    let initialUri = plugins?.SaveAs ? backupDirUri(saved?.path) ?? overwriteUri : null;

    if (overwriteUri) {
      // 点「另存新文件」= 换位置；点遮罩或按返回键 = 放弃导出。
      const overwrite = await confirmDialog({
        title: '导出备份',
        message: `上次备份保存在：${appFlags.lastBackup.path || appFlags.lastBackup.name}。「覆盖上次」会直接更新这个文件；「另存新文件」可以换目录或换文件名。`,
        confirmText: '覆盖上次',
        cancelText: '另存新文件',
        cancelValue: 'new'
      });
      if (overwrite === false) return;

      if (overwrite === true) {
        try {
          await plugins.SaveAs.overwrite({ uri: overwriteUri, data: json });
          await alertDialog({
            title: '导出成功',
            message: `已覆盖上次的备份：${appFlags.lastBackup.path || appFlags.lastBackup.name}`
          });
          return;
        } catch (error) {
          console.error('覆盖备份失败：', error);
          // 文件被移动或权限失效时清掉记录，转而让用户重新选位置。
          overwriteUri = null;
          initialUri = null;
          delete appFlags.lastBackup;
          try {
            await Flags.push(appFlags);
          } catch (ignored) {
            // 忽略：记录清理失败不影响本次导出。
          }
          await alertDialog({
            title: '无法覆盖',
            message: '上次的备份位置已无法访问（文件可能被移动或删除），请重新选择保存位置。'
          });
        }
      }
    }

    // 点「取消」按钮 = 分享；点遮罩或按返回键 = 放弃导出。
    const choice = await confirmDialog({
      title: '导出备份',
      message: '「保存到本机」可以选择保存目录和文件名；「分享」会调起系统分享面板，可发送到邮件、云盘、文件管理器等支持 JSON 文件的应用。',
      confirmText: '保存到本机',
      cancelText: '分享',
      cancelValue: 'share'
    });

    if (choice === false) return;

    if (choice === true) {
      if (!plugins?.SaveAs) throw new Error('当前版本不支持选择保存位置，请安装最新版本后再试。');
      const result = await plugins.SaveAs.save({
        filename,
        data: json,
        mimeType: 'application/json',
        initialUri
      });
      if (!result?.canceled) {
        await rememberBackupLocation(result);
        await alertDialog({
          title: '导出成功',
          message: `备份已保存到：${result.path || result.name}`
        });
      }
      return;
    }

    if (plugins?.Filesystem && plugins?.Share) {
      const { uri } = await plugins.Filesystem.writeFile({
        path: filename,
        data: json,
        directory: 'CACHE',
        encoding: 'utf8'
      });
      await plugins.Share.share({
        title: '物品管家备份',
        dialogTitle: '分享备份文件',
        files: [uri]
      });
      return;
    }
  }

  const file = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importBackupText(text) {
  try {
    const backup = JSON.parse(text);
    if (!backup || typeof backup !== 'object' || backup.version !== 1 || !Array.isArray(backup.items)) {
      throw new Error('备份文件结构不正确：需要包含 version: 1 和 items 数组。');
    }
    // 历史备份里可能带 deleted: true 的墓碑，直接忽略，保证导入后本地没有隐藏数据。
    const importedItems = validateBackupItems(backup.items).filter((item) => !item.deleted);
    if (importedItems.length === 0) {
      throw new Error('这个备份里没有可导入的物品。');
    }
    // 点「取消」按钮 = 合并导入；点遮罩或按返回键 = 放弃导入。
    const choice = await confirmDialog({
      title: '导入备份',
      message: `备份 ${importedItems.length} 条、本地 ${activeItems().length} 条。「覆盖导入」会清空本地并按备份重建；「合并导入」保留本地数据，只补充本地没有的物品。`,
      confirmText: '覆盖导入',
      cancelText: '合并导入',
      cancelValue: 'merge',
      danger: true
    });
    if (choice === false) return;

    if (choice === 'merge') {
      const merged = mergeItems(items, importedItems);
      if (merged.addedCount === 0) {
        await alertDialog({
          title: '无需合并',
          message: `备份中的 ${importedItems.length} 条物品本地都已存在，没有新增内容。`
        });
        return;
      }
      if (await saveItems(merged.items)) {
        await alertDialog({
          title: '合并完成',
          message: `新增 ${merged.addedCount} 条，跳过本地已有的 ${merged.skippedCount} 条，现在共 ${merged.items.length} 条。`
        });
      }
      return;
    }

    if (await saveItems(importedItems)) {
      await alertDialog({
        title: '覆盖完成',
        message: `已用备份中的 ${importedItems.length} 条物品替换本地数据。`
      });
    }
  } catch (error) {
    console.error('导入备份失败：', error);
    await alertDialog({ title: '导入失败', message: error.message || '文件无法读取，请选择有效的 JSON 备份。' });
  }
}

// 安卓端用原生文件选择器导入：先提示上次导出路径，由用户自行前往选择。
async function pickBackupToImport(saveAs) {
  const last = appFlags.lastBackup;

  if (last?.path || last?.name) {
    await alertDialog({
      title: '导入备份',
      message: `上次导出保存在：${last.path || last.name}。请在接下来的文件选择器中手动前往该位置选择备份文件。`
    });
  }

  try {
    const result = await saveAs.pickBackup({});
    if (!result?.canceled && typeof result?.data === 'string') {
      await importBackupText(result.data);
    }
  } catch (error) {
    console.error('选择备份文件失败：', error);
    await alertDialog({ title: '导入失败', message: error.message || '无法读取所选文件。' });
  }
}

document.querySelector('#add-button').addEventListener('click', () => openEditor());
document.querySelector('#close-modal').addEventListener('click', closeEditor);
elements.modal.addEventListener('click', (event) => {
  if (event.target === elements.modal) closeEditor();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!elements.dialog.hidden) {
    closeDialog(false);
    return;
  }
  if (!elements.intro.hidden) {
    closeIntro(false);
    return;
  }
  if (!elements.modal.hidden) closeEditor();
});
elements.dialogConfirm.addEventListener('click', () => closeDialog(true));
elements.dialogCancel.addEventListener('click', () => closeDialog(dialogCancelValue));
elements.dialog.addEventListener('click', (event) => {
  if (event.target === elements.dialog) closeDialog(false);
});
elements.brandButton.addEventListener('click', openIntro);
elements.introClose.addEventListener('click', () => closeIntro(false));
elements.introNever.addEventListener('click', () => closeIntro(true));
elements.intro.addEventListener('click', (event) => {
  if (event.target === elements.intro) closeIntro(false);
});
elements.introCopy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(INTRO_URL);
    elements.introCopy.textContent = '已复制';
  } catch (error) {
    console.error('复制仓库地址失败：', error);
    await alertDialog({ title: '复制失败', message: `请手动记录仓库地址：${INTRO_URL}` });
  }
  setTimeout(() => { elements.introCopy.textContent = '复制'; }, 1600);
});
elements.form.addEventListener('submit', handleSave);
elements.delete.addEventListener('click', handleDelete);
elements.search.addEventListener('input', renderList);
elements.filters.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-category]');
  if (!button) return;
  selectedCategory = button.dataset.category;
  renderFilters();
  renderList();
});
elements.categoryOptions.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.custom === 'true') {
    if (!categoryCustomOpen) {
      categoryCustomOpen = true;
      if (CATEGORY_PRESETS.includes(elements.category.value)) elements.category.value = customCategoryDraft;
    }
    renderCategoryOptions();
    elements.category.focus();
    return;
  }
  categoryCustomOpen = false;
  elements.category.value = button.textContent;
  renderCategoryOptions();
});
elements.category.addEventListener('input', () => {
  if (categoryCustomOpen) customCategoryDraft = elements.category.value;
});
elements.expiredCard.addEventListener('click', () => setStatusFilter('expired'));
elements.soonCard.addEventListener('click', () => setStatusFilter('soon'));
elements.totalCard.addEventListener('click', () => setStatusFilter('all'));
elements.amountCard.addEventListener('click', () => setStatusFilter('ledger'));
elements.dateFilter.addEventListener('click', (event) => {
  const toggle = event.target.closest('.date-filter-toggle');
  if (toggle) {
    const part = toggle.closest('.date-filter');
    const menu = part.querySelector('.date-filter-menu');
    const willOpen = menu.hidden;
    renderDateFilter(false);
    closeDateMenus();
    menu.hidden = !willOpen;
    part.classList.toggle('open', !willOpen);
    return;
  }

  const option = event.target.closest('.date-filter-option');
  if (!option) return;
  const part = option.closest('.date-filter');
  const value = option.dataset.value === 'all' ? '' : option.dataset.value;
  if (part.dataset.part === 'year') ledgerYear = value;
  else if (part.dataset.part === 'month') ledgerMonth = value;
  else ledgerDay = value;
  renderDateFilter();
  closeDateMenus();
  renderList();
});
elements.dateFilter.addEventListener('input', (event) => {
  const input = event.target.closest('.date-filter-input');
  if (!input) return;
  syncDatePart(input.closest('.date-filter').dataset.part, input.value);
  renderList();
});
elements.dateFilter.addEventListener('change', (event) => {
  if (event.target.closest('.date-filter-input')) renderDateFilter();
});
setupDatePicker(elements.producedPicker);
setupDatePicker(elements.expiryPicker);
document.addEventListener('click', (event) => {
  if (!event.target.closest('.date-picker')) closeCalendars();
  if (!event.target.closest('#date-filter')) closeDateMenus();
});
document.querySelector('#export-button').addEventListener('click', async () => {
  try {
    await exportBackup();
  } catch (error) {
    console.error('导出备份失败：', error);
    await alertDialog({ title: '导出失败', message: error.message || '请重试。' });
  }
});
document.querySelector('#import-button').addEventListener('click', () => {
  if (!storageReady) return;
  const saveAs = window.Capacitor?.Plugins?.SaveAs;
  if (saveAs) {
    pickBackupToImport(saveAs);
    return;
  }
  elements.importFile.click();
});
elements.importFile.addEventListener('change', async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  try {
    await importBackupText(await file.text());
  } catch (error) {
    console.error('读取备份文件失败：', error);
    await alertDialog({ title: '导入失败', message: '文件无法读取，请选择有效的 JSON 备份。' });
  } finally {
    elements.importFile.value = '';
  }
});
elements.quantity.addEventListener('input', () => elements.quantity.setCustomValidity(''));
elements.amount.addEventListener('input', () => elements.amount.setCustomValidity(''));
elements.soonDays.addEventListener('input', () => elements.soonDays.setCustomValidity(''));
elements.name.addEventListener('input', () => elements.name.setCustomValidity(''));

try {
  const storedItems = await Storage.pull();
  const allItems = validateItems(storedItems);
  // 旧版本用软删除存过墓碑，启动时清掉并写回，保证本地不存在界面上看不到的数据。
  items = allItems.filter((item) => !item.deleted);
  storageReady = true;
  if (items.length !== allItems.length) {
    try {
      await Storage.push(items);
    } catch (error) {
      console.error('清理已删除物品失败：', error);
    }
  }
} catch (error) {
  console.error('读取物品失败：', error);
  await alertDialog({ title: '读取数据失败', message: error.message || '请检查存储配置后重新打开应用。' });
  document.querySelector('#add-button').disabled = true;
  document.querySelector('#import-button').disabled = true;
  document.querySelector('#export-button').disabled = true;
}
try {
  appFlags = (await Flags.pull()) ?? {};
  introDismissed = appFlags.introDismissed === true;
} catch (error) {
  console.error('读取提示状态失败：', error);
}
render();
if (storageReady) ensureReminderPermission();
if (storageReady && !introDismissed) openIntro();
