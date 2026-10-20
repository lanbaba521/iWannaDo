// 纯逻辑层：不依赖任何 DOM / 浏览器 API，供 app.js 与单元测试共用。
// 这里的所有函数都是纯函数（除时间相关的本地时区读取外无外部状态），可在 Node 中直接测试。

export const DEFAULT_SOON_DAYS = 3;

export function dateString(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function todayString() {
  return dateString(new Date());
}

export function shiftDays(value, days) {
  const base = value ? new Date(`${value}T00:00:00`) : new Date();
  return dateString(new Date(base.getFullYear(), base.getMonth(), base.getDate() + days));
}

export function daysBetween(from, to) {
  return Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000);
}

export function itemSoonDays(item) {
  const value = Number(item?.soonDays);
  return Number.isInteger(value) && value >= 1 ? value : DEFAULT_SOON_DAYS;
}

export function expiryStatus(item, today) {
  if (!item.expiry) return 'none';
  if (item.expiry < today) return 'expired';
  return item.expiry <= shiftDays(today, itemSoonDays(item)) ? 'soon' : 'normal';
}

export function expiryLabel(expiry, status, today) {
  if (status === 'expired') return `已过期 ${daysBetween(expiry, today)} 天`;
  if (status === 'soon') {
    const left = daysBetween(today, expiry);
    return left === 0 ? '今天过期' : `${left} 天后过期`;
  }
  return `有效期至 ${expiry}`;
}

// 计算需要安排的安卓本地提醒：临期提醒在进入临期窗口的第一天，过期提醒在到期当天。
// 只返回日期，具体几点由调用方决定；已过期的日期不返回，避免补发旧通知。
export function reminderPlan(items, today) {
  const plan = [];
  for (const item of items) {
    if (!item?.expiry) continue;
    const soonDate = shiftDays(item.expiry, -itemSoonDays(item));
    if (soonDate >= today) {
      plan.push({ itemId: item.id, kind: 'soon', date: soonDate, name: item.name, expiry: item.expiry });
    }
    if (item.expiry >= today) {
      plan.push({ itemId: item.id, kind: 'expired', date: item.expiry, name: item.name, expiry: item.expiry });
    }
  }
  return plan;
}

export function formatMoney(value) {
  return `¥${value.toFixed(2)}`;
}

export function sumMoney(values) {
  return Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100;
}

export function localDateOf(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? todayString() : dateString(date);
}

export function dayLabel(value) {
  const [, month, day] = value.split('-');
  return `${Number(month)}月${Number(day)}日`;
}

export function displayDate(value) {
  const [year, month, day] = value.split('-');
  return `${year}年${Number(month)}月${Number(day)}日`;
}

export function isValidItem(item) {
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

export function validateItems(data) {
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

export function matchesDateFilter(item, filter) {
  const day = localDateOf(item.createdAt);
  if (filter.year && day.slice(0, 4) !== filter.year) return false;
  if (filter.month && day.slice(5, 7) !== filter.month) return false;
  if (filter.day && day.slice(8, 10) !== filter.day) return false;
  return true;
}

// 导入备份时比常规校验更严格：id 不能重复，创建/更新时间必须是可解析的日期。
// 启动时读取本地数据仍走宽松的 validateItems，避免历史数据把应用卡死。
export function validateBackupItems(data) {
  const list = validateItems(data);
  const seen = new Set();
  list.forEach((item, index) => {
    const position = index + 1;
    if (seen.has(item.id)) {
      throw new Error(`备份文件第 ${position} 条与前面的物品 id 重复，无法导入。`);
    }
    seen.add(item.id);
    for (const key of ['createdAt', 'updatedAt']) {
      if (Number.isNaN(new Date(item[key]).getTime())) {
        throw new Error(`备份文件第 ${position} 条的 ${key} 不是有效日期，无法导入。`);
      }
    }
  });
  return list;
}

// 合并导入（本地优先）：本地记录原样保留，只把备份中本地没有的 id 补进来。
export function mergeItems(local, incoming) {
  const localIds = new Set(local.map((item) => item.id));
  const added = incoming.filter((item) => !localIds.has(item.id));
  return {
    items: [...local, ...added],
    addedCount: added.length,
    skippedCount: incoming.length - added.length
  };
}
