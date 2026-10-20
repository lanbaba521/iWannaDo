import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dateString,
  todayString,
  shiftDays,
  daysBetween,
  itemSoonDays,
  expiryStatus,
  formatMoney,
  sumMoney,
  localDateOf,
  isValidItem,
  validateItems,
  matchesDateFilter,
  reminderPlan
} from '../www/logic.js';

test('dateString / todayString 返回 YYYY-MM-DD 且使用本地时区', () => {
  assert.equal(dateString(new Date(2026, 0, 1)), '2026-01-01');
  assert.equal(dateString(new Date(2026, 0, 1, 0, 30)), '2026-01-01');
  assert.equal(dateString(new Date(2026, 11, 31, 23, 59)), '2026-12-31');
  // 用本地时间构造的当天日期，使用本地时区读取；在非 UTC 时区下与 toISOString().slice(0,10) 可能不同，
  // 因此这里只断言本地结果，不与之相等比较。
  assert.match(todayString(), /^\d{4}-\d{2}-\d{2}$/);
});

test('shiftDays 支持跨月 / 跨年 / 闰年', () => {
  assert.equal(shiftDays('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDays('2025-12-31', 1), '2026-01-01');
  assert.equal(shiftDays('2024-02-28', 1), '2024-02-29');
});

test('daysBetween 计算两天间隔', () => {
  assert.equal(daysBetween('2026-01-01', '2026-01-31'), 30);
  assert.equal(daysBetween('2026-01-01', '2026-01-01'), 0);
});

test('itemSoonDays 校验 soonDays 字段', () => {
  assert.equal(itemSoonDays({}), 3);
  // 注意：实现里先 Number() 再 Number.isInteger()，字符串 '5' 会被转成整数 5，故返回 5 而非默认 3。
  assert.equal(itemSoonDays({ soonDays: '5' }), 5);
  assert.equal(itemSoonDays({ soonDays: 0 }), 3);
  assert.equal(itemSoonDays({ soonDays: 7 }), 7);
});

test('expiryStatus 判定有效期状态', () => {
  const today = '2026-01-05';
  assert.equal(expiryStatus({}, today), 'none');
  assert.equal(expiryStatus({ expiry: '' }, today), 'none');
  assert.equal(expiryStatus({ expiry: '2026-01-01' }, today), 'expired');
  assert.equal(expiryStatus({ expiry: '2026-01-05' }, today), 'soon');
  assert.equal(expiryStatus({ expiry: '2026-01-07', soonDays: 3 }, today), 'soon');
  assert.equal(expiryStatus({ expiry: '2026-01-08', soonDays: 3 }, today), 'soon');
  assert.equal(expiryStatus({ expiry: '2026-01-09', soonDays: 3 }, today), 'normal');
  assert.equal(expiryStatus({ expiry: '2026-01-20' }, today), 'normal');
});

test('formatMoney 格式化金额为两位小数', () => {
  assert.equal(formatMoney(29.9), '¥29.90');
  assert.equal(formatMoney(0), '¥0.00');
});

test('sumMoney 规避浮点误差', () => {
  assert.equal(sumMoney([0.1, 0.2]), 0.3);
  assert.equal(sumMoney([]), 0);
});

test('localDateOf 还原本地日期，非法输入回退为今天', () => {
  const date = new Date(2026, 0, 15, 10, 0, 0);
  assert.equal(localDateOf(date.toISOString()), '2026-01-15');
  assert.equal(localDateOf('not-a-date'), todayString());
});

test('isValidItem 校验物品字段', () => {
  const valid = {
    id: 'a1',
    name: '牛奶',
    category: '食品',
    qty: 1,
    location: '',
    note: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deleted: false
  };
  assert.equal(isValidItem(valid), true);
  assert.equal(isValidItem(null), false);
  assert.equal(isValidItem({ ...valid, name: '   ' }), false);
  assert.equal(isValidItem({ ...valid, qty: 1.5 }), false);
  assert.equal(isValidItem({ ...valid, qty: -1 }), false);
  assert.equal(isValidItem({ ...valid, amount: -5 }), false);
  const { createdAt, ...missingCreatedAt } = valid;
  assert.equal(isValidItem(missingCreatedAt), false);
  assert.equal(isValidItem({ ...valid, deleted: 'false' }), false);
});

test('validateItems 补齐默认值并拒绝非法入参', () => {
  const base = {
    id: 'a1',
    name: '牛奶',
    category: '食品',
    qty: 1,
    location: '',
    note: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deleted: false
  };
  const [filled] = validateItems([base]);
  assert.equal(filled.amount, 0);
  assert.equal(filled.produced, '');
  assert.equal(filled.expiry, '');
  assert.equal(filled.soonDays, 3);
  assert.throws(() => validateItems('not-array'));
});

test('matchesDateFilter 按年 / 月 / 日组合过滤', () => {
  const item = { createdAt: '2026-01-01T12:00:00' };
  // 只给 year
  assert.equal(matchesDateFilter(item, { year: '2026' }), true);
  assert.equal(matchesDateFilter(item, { year: '2025' }), false);
  // 只给 month
  assert.equal(matchesDateFilter(item, { month: '01' }), true);
  assert.equal(matchesDateFilter(item, { month: '02' }), false);
  // 年 + 月
  assert.equal(matchesDateFilter(item, { year: '2026', month: '01' }), true);
  assert.equal(matchesDateFilter(item, { year: '2025', month: '01' }), false);
  // 年 + 月 + 日
  assert.equal(matchesDateFilter(item, { year: '2026', month: '01', day: '01' }), true);
  assert.equal(matchesDateFilter(item, { year: '2026', month: '01', day: '02' }), false);
  // 全部为空，不过滤
  assert.equal(matchesDateFilter(item, {}), true);
});

test('reminderPlan 生成临期与过期提醒，跳过已过期日期', () => {
  const items = [
    { id: 'a', name: '牛奶', expiry: '2026-10-30', soonDays: 3 },
    { id: 'b', name: '面包', expiry: '2026-10-10', soonDays: 3 },
    { id: 'c', name: '无有效期', expiry: '', soonDays: 3 },
    { id: 'd', name: '今天到期', expiry: '2026-10-20', soonDays: 3 }
  ];
  const plan = reminderPlan(items, '2026-10-20');
  assert.deepEqual(
    plan.map((entry) => `${entry.itemId}:${entry.kind}:${entry.date}`),
    [
      'a:soon:2026-10-27',
      'a:expired:2026-10-30',
      'd:expired:2026-10-20'
    ]
  );
});
