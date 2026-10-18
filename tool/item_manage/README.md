# 物品管家

纯 HTML / CSS / 原生 JavaScript 的手机物品管理应用，通过 Capacitor 打包成 Android APK。页面以原生 ES Module 加载 `www/storage.js` 与 `www/app.js`，不使用前端框架，也没有构建步骤。

## 功能

- **物品登记** — 名称必填；分类提供 8 个预设 chip，也可以自己输入；数量、存放位置、备注选填。
- **有效期管理** — 每件物品可单独填写生产日期与有效期，并可单独设置临期天数（默认 3 天）。
- **顶部统计** — 「已过期 / 临期 / 总计 / 总金额」四张卡片实时统计，点击卡片即就地切换列表内容并高亮该卡片，不弹额外面板。
- **金额记账** — 物品可填金额，总金额卡片汇总所有开销。
- **时间筛选** — 年 / 月 / 日三个并排筛选框，四个模块通用；既可下拉选择，也可用数字键盘直接输入，清空某一维度即表示该维度不限制（只选年就按年筛，年 + 月就按月筛，依此类推）。
- **金额模块下拉明细** — 切到「总金额」卡片时，物品按添加日期分组为可折叠的下拉菜单（按日期倒序，最新一天默认展开）；其余三个模块为普通平铺列表。
- **数据备份** — 右上角「导出 / 导入」，导出带版本号的 JSON 备份，导入前校验结构并二次确认覆盖。
- **使用细则弹窗** — 左上角「物」字按钮可随时打开说明弹窗（含开源仓库地址与复制按钮）；选「关闭」则每次启动都会再弹，选「不再提示」后不再自动弹出。

## 目录结构

```text
item_manage/
├── capacitor.config.json     Capacitor 配置（appId: com.tool.itemmanage，appName: 物品管家，webDir: www）
├── package.json              依赖：@capacitor/core、cli、android、preferences
├── README.md
├── www/                      源码，改动只在这里
│   ├── index.html            页面结构 + 全部内联样式
│   ├── app.js                业务逻辑、自绘组件、事件绑定
│   └── storage.js            存储层与适配器注册表
└── android/                  Capacitor 生成的原生工程
    └── app/
        ├── src/main/assets/public/     npx cap sync 后从 www/ 复制来的副本，勿手改
        └── build/outputs/apk/release/物品管家-1.0.apk   构建产物
```

## 本地预览

用静态 HTTP 服务打开 `www/index.html`（ES Module 需要 HTTP，不能直接用 `file://`）：

```sh
npx serve .
```

浏览器里没有 `window.Capacitor`，数据会落到 `localStorage`，方便调试。

## 安装依赖并打包 Android APK

```sh
npm install
npx cap sync android
```

首次生成原生工程时可执行 `npx cap add android`。之后每次修改 `www/` 都要再跑一次 `npx cap sync android`，否则 APK 里还是旧代码。

构建 APK（**必须用 JDK 21**，JDK 26 会因 jlink 处理不了 `core-for-system-modules.jar` 而失败）：

```powershell
$env:JAVA_HOME='C:\Users\lan\.jdks\jbr-21.0.11'
cd android
.\gradlew assembleRelease
```

产物：`android/app/build/outputs/apk/release/物品管家-1.0.apk`。也可以在 Android Studio 里选 **Build > Build Bundle(s) / APK(s) > Build APK(s)**。

## 数据模型与存储

每条物品记录包含：

| 字段 | 说明 |
| --- | --- |
| `id` | 唯一标识 |
| `name` | 名称，必填 |
| `category` | 分类，可空（空值在筛选时归为「未分类」） |
| `qty` | 数量 |
| `amount` | 金额，选填，缺省为 `0` |
| `produced` | 生产日期 `YYYY-MM-DD`，可空 |
| `expiry` | 有效期 `YYYY-MM-DD`，可空 |
| `soonDays` | 该物品的临期天数，默认 3 |
| `location` / `note` | 存放位置 / 备注 |
| `createdAt` / `updatedAt` | 创建 / 更新时间，`createdAt` 同时作为记账的分组日期 |
| `deleted` | 软删除墓碑标记 |

存储键有两个：

- `item-manager-v1` — 物品数组，经 `Storage.pull()` / `Storage.push()` 读写。
- `item-manager-flags` — 应用开关（目前只有 `introDismissed`），经 `Flags.pull()` / `Flags.push()` 读写，不进导出备份。

`storage.js` 在 Capacitor 环境下优先调用 `Capacitor.Plugins.Preferences.get()` / `set()`；如果拿不到该插件会直接抛错，而不会悄悄降级到浏览器存储，避免数据"看起来写进去了其实没写"。浏览器环境则使用 `localStorage`。

删除采用软删除，墓碑记录保留在本地数据和 JSON 备份里，`activeItems()` 负责过滤。导入时先校验 `version === 1` 且 `items` 为数组，再逐条归一化（缺失的 `amount` / `produced` / `expiry` / `soonDays` 会补默认值），最后由用户确认覆盖。

## 界面约定

所有交互组件都是自绘的，不使用系统原生控件（原生日历、`confirm()` / `alert()`、底部半屏选择器一律不用）：

- 日期选择器 — `renderCalendar()` 手写月历 + 快捷胶囊（今天 / 7 天前 / 30 天前 / 1 年前，有效期侧为 7 天后 / 30 天后 / 1 年后）+ 清除按钮。
- 对话框 — `confirmDialog()` / `alertDialog()` 返回 Promise，用于删除确认、导入覆盖确认、错误提示。
- 日期筛选 — `renderDateFilter()` 生成三个可输入可下拉的年 / 月 / 日控件（`syncDatePart()` 负责手输归一化：年需 4 位数字，月 / 日 1–2 位并补零）。
- 使用细则弹窗 — 左上角 `#brand-button`（「物」字按钮）打开，`closeIntro(true)` 才会写入 `introDismissed`。

日期一律用本地时区的 `dateString(date)` 生成 `YYYY-MM-DD`，不用 `toISOString()`，避免 UTC 跨日导致日期错位。

## 云同步扩展点

`www/storage.js` 导出了 `StorageAdapters` 注册表和 `registerStorageAdapter(name, adapter)`。将来添加云同步时，适配器需实现异步 `pull()`、`push(data)` 和 `test()`，再通过注册函数挂载：

```js
registerStorageAdapter('cloud', {
  async pull() { /* 获取并返回物品数组 */ },
  async push(data) { /* 保存物品数组 */ },
  async test() { /* 检查连接并返回结果 */ }
});
```

以上仅说明接口约定，本项目不含云服务、账号或任何云同步实现。
