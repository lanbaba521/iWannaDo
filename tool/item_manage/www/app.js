import { Storage, Flags } from './storage.js';

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

const INTRO_URL = 'https://github.com/lanbaba521/iWannaDo.git';

const DEFAULT_SOON_DAYS = 3;
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function dateString(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function todayString() {
  return dateString(new Date());
}

function shiftDays(value, days) {
  const base = value ? new Date(`${value}T00:00:00`) : new Date();
  return dateString(new Date(base.getFullYear(), base.getMonth(), base.getDate() + days));
}

function daysBetween(from, to) {
  return Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000);
}

function itemSoonDays(item) {
  const value = Number(item?.soonDays);
  return Number.isInteger(value) && value >= 1 ? value : DEFAULT_SOON_DAYS;
}

function expiryStatus(item, today) {
  if (!item.expiry) return 'none';
  if (item.expiry < today) return 'expired';
  return item.expiry <= shiftDays(today, itemSoonDays(item)) ? 'soon' : 'normal';
}

function expiryLabel(expiry, status, today) {
  if (status === 'expired') return `已过期 ${daysBetween(expiry, today)} 天`;
  if (status === 'soon') {
    const left = daysBetween(today, expiry);
    return left === 0 ? '今天过期' : `${left} 天后过期`;
  }
  return `有效期至 ${expiry}`;
}

function formatMoney(value) {
  return `¥${value.toFixed(2)}`;
}

function sumMoney(values) {
  return Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100;
}

function localDateOf(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? todayString() : dateString(date);
}

function dayLabel(value) {
  const [, month, day] = value.split('-');
  return `${Number(month)}月${Number(day)}日`;
}

function displayDate(value) {
  const [year, month, day] = value.split('-');
  return `${year}年${Number(month)}月${Number(day)}日`;
}

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

function openDialog({ title, message, confirmText = '确定', cancelText = '取消', danger = false, cancellable = true }) {
  elements.dialogTitle.textContent = title;
  elements.dialogText.textContent = message;
  elements.dialogConfirm.textContent = confirmText;
  elements.dialogConfirm.classList.toggle('danger', danger);
  elements.dialogCancel.textContent = cancelText;
  elements.dialogCancel.hidden = !cancellable;
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
  try {
    await Flags.push({ introDismissed: true });
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

function isValidItem(item) {
  return item !== null
    && typeof item === 'object'
    && typeof item.id === 'string'
    && typeof item.name === 'string'
    && item.name.trim() !== ''
    && typeof item.category === 'string'
    && Number.isInteger(item.qty)
    && item.qty >= 0
    && typeof item.location === 'string'
    && typeof item.note === 'string'
    && (item.amount === undefined || (typeof item.amount === 'number' && Number.isFinite(item.amount) && item.amount >= 0))
    && (item.produced === undefined || typeof item.produced === 'string')
    && (item.expiry === undefined || typeof item.expiry === 'string')
    && (item.soonDays === undefined || Number.isInteger(item.soonDays))
    && typeof item.createdAt === 'string'
    && typeof item.updatedAt === 'string'
    && typeof item.deleted === 'boolean';
}

function validateItems(data) {
  if (!Array.isArray(data) || !data.every(isValidItem)) {
    throw new Error('数据格式错误：物品必须包含有效的 id、name、category、qty、amount、produced、expiry、soonDays、location、note、createdAt、updatedAt 和 deleted 字段。');
  }
  return data.map((item) => ({
    ...item,
    amount: Number.isFinite(item.amount) && item.amount >= 0 ? item.amount : 0,
    produced: item.produced ?? '',
    expiry: item.expiry ?? '',
    soonDays: itemSoonDays(item)
  }));
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

function matchesDateFilter(item) {
  const day = localDateOf(item.createdAt);
  if (ledgerYear && day.slice(0, 4) !== ledgerYear) return false;
  if (ledgerMonth && day.slice(5, 7) !== ledgerMonth) return false;
  if (ledgerDay && day.slice(8, 10) !== ledgerDay) return false;
  return true;
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
    return matchesCategory && matchesStatus && matchesDateFilter(item) && searchableText.includes(query);
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

async function saveItems(nextItems) {
  try {
    await Storage.push(nextItems);
    items = nextItems;
    render();
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
    message: `确定删除“${item.name}”吗？删除后可通过导入备份恢复。`,
    confirmText: '删除',
    danger: true
  });
  if (!confirmed) return;
  const deletedItem = { ...item, deleted: true, updatedAt: new Date().toISOString() };
  const nextItems = items.map((entry) => entry.id === item.id ? deletedItem : entry);
  if (await saveItems(nextItems)) closeEditor();
}

function exportBackup() {
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    items
  };
  const file = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = `物品管家备份-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importBackup(file) {
  try {
    const backup = JSON.parse(await file.text());
    if (!backup || typeof backup !== 'object' || backup.version !== 1 || !Array.isArray(backup.items)) {
      throw new Error('备份文件结构不正确：需要包含 version: 1 和 items 数组。');
    }
    const importedItems = validateItems(backup.items);
    const confirmed = await confirmDialog({
      title: '导入备份',
      message: `将导入 ${importedItems.length} 条物品数据并覆盖当前数据，确定继续吗？`,
      confirmText: '覆盖导入',
      danger: true
    });
    if (!confirmed) return;
    await saveItems(importedItems);
  } catch (error) {
    console.error('导入备份失败：', error);
    await alertDialog({ title: '导入失败', message: error.message || '文件无法读取，请选择有效的 JSON 备份。' });
  } finally {
    elements.importFile.value = '';
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
elements.dialogCancel.addEventListener('click', () => closeDialog(false));
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
    exportBackup();
  } catch (error) {
    console.error('导出备份失败：', error);
    await alertDialog({ title: '导出失败', message: error.message || '请重试。' });
  }
});
document.querySelector('#import-button').addEventListener('click', () => {
  if (storageReady) elements.importFile.click();
});
elements.importFile.addEventListener('change', (event) => {
  const [file] = event.target.files;
  if (file) importBackup(file);
});
elements.quantity.addEventListener('input', () => elements.quantity.setCustomValidity(''));
elements.amount.addEventListener('input', () => elements.amount.setCustomValidity(''));
elements.soonDays.addEventListener('input', () => elements.soonDays.setCustomValidity(''));
elements.name.addEventListener('input', () => elements.name.setCustomValidity(''));

try {
  const storedItems = await Storage.pull();
  items = validateItems(storedItems);
  storageReady = true;
} catch (error) {
  console.error('读取物品失败：', error);
  await alertDialog({ title: '读取数据失败', message: error.message || '请检查存储配置后重新打开应用。' });
  document.querySelector('#add-button').disabled = true;
  document.querySelector('#import-button').disabled = true;
  document.querySelector('#export-button').disabled = true;
}
try {
  const flags = await Flags.pull();
  introDismissed = flags?.introDismissed === true;
} catch (error) {
  console.error('读取提示状态失败：', error);
}
render();
if (storageReady && !introDismissed) openIntro();
