const ITEMS_KEY = 'item-manager-v1';
const FLAGS_KEY = 'item-manager-flags';

function getNativePreferences() {
  return window.Capacitor?.Plugins?.Preferences ?? null;
}

async function readValue(key) {
  if (window.Capacitor) {
    const preferences = getNativePreferences();
    if (!preferences || typeof preferences.get !== 'function') {
      throw new Error('未找到原生 Preferences 插件，请检查 @capacitor/preferences 是否已安装并同步。');
    }
    const result = await preferences.get({ key });
    return result.value === null ? null : JSON.parse(result.value);
  }

  const value = window.localStorage.getItem(key);
  return value === null ? null : JSON.parse(value);
}

async function writeValue(key, data) {
  const value = JSON.stringify(data);
  if (window.Capacitor) {
    const preferences = getNativePreferences();
    if (!preferences || typeof preferences.set !== 'function') {
      throw new Error('未找到原生 Preferences 插件，请检查 @capacitor/preferences 是否已安装并同步。');
    }
    await preferences.set({ key, value });
    return;
  }

  window.localStorage.setItem(key, value);
}

export const Storage = {
  async pull() {
    return (await readValue(ITEMS_KEY)) ?? [];
  },

  push(data) {
    return writeValue(ITEMS_KEY, data);
  }
};

// 应用内开关（如「不再提示」）单独存一个键，避免和物品数据混在一起。
export const Flags = {
  async pull() {
    return (await readValue(FLAGS_KEY)) ?? {};
  },

  push(data) {
    return writeValue(FLAGS_KEY, data);
  }
};

// 云同步适配器需实现 pull()/push()/test()，并通过注册表挂载；此处不包含云端实现。
export const StorageAdapters = new Map([['local', Storage]]);

export function registerStorageAdapter(name, adapter) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new TypeError('适配器名称不能为空。');
  }
  for (const method of ['pull', 'push', 'test']) {
    if (typeof adapter?.[method] !== 'function') {
      throw new TypeError(`存储适配器必须实现 ${method}()。`);
    }
  }
  StorageAdapters.set(name, adapter);
}
