# 物品管家

纯 HTML / CSS / 原生 JavaScript 的手机物品管理应用，通过 Capacitor 打包成 Android APK。页面以原生 ES Module 加载 `www/storage.js`、`www/logic.js` 与 `www/app.js`，不使用前端框架，也没有构建步骤。

## 功能

- **物品登记** — 名称必填；分类提供 8 个预设 chip，也可以自己输入；数量、存放位置、备注选填。
- **有效期管理** — 每件物品可单独填写生产日期与有效期，并可单独设置临期天数（默认 3 天）。
- **顶部统计** — 「已过期 / 临期 / 总计 / 总金额」四张卡片实时统计，点击卡片即就地切换列表内容并高亮该卡片，不弹额外面板。
- **金额记账** — 物品可填金额，总金额卡片汇总所有开销。
- **时间筛选** — 年 / 月 / 日三个并排筛选框，四个模块通用；既可下拉选择，也可用数字键盘直接输入，清空某一维度即表示该维度不限制（只选年就按年筛，年 + 月就按月筛，依此类推）。
- **金额模块下拉明细** — 切到「总金额」卡片时，物品按添加日期分组为可折叠的下拉菜单（按日期倒序，最新一天默认展开）；其余三个模块为普通平铺列表。
- **数据备份** — 右上角「导出 / 导入」。导出的 JSON 带版本号，且**只包含界面上可见的物品**，备份条数与列表所见一致。安卓端首次导出走系统「另存为」（目录与文件名自选），成功后会把位置记进应用开关：**下次导出可直接「覆盖上次」同一个文件，也可以「另存新文件」换目录或换文件名**，还有「分享」可发送到支持 JSON 的应用；浏览器里是普通下载。
- **导入提示路径** — 导入时若存在上次导出的记录，会先显示其位置（如「内部存储/Download/物品管家备份-2026-10-20.json」），由用户在文件选择器中自行前往；不预置初始目录（各厂商选择器对 `EXTRA_INITIAL_URI` 支持不一，预置反而可能造成困惑）。对同一份备份文件二选一：**覆盖导入**（清空本地、按备份重建）或**合并导入**（本地优先，保留本地全部记录，只补充备份中本地没有的 id）。导入前会校验结构与 id 唯一性、时间字段有效性，并忽略历史备份里 `deleted: true` 的墓碑记录。
- **删除不可恢复** — 删除是从数据里直接移除记录，不做软删除，本地和备份里都不会留下看不见的数据；需要留存时请先导出备份。
- **临期 / 过期通知** — 仅安卓端，通过系统通知栏提醒（`@capacitor/local-notifications`）：物品进入临期窗口的第一天与到期当天各发一条 09:00 的通知；每次启动和数据变化都会重排，避免重复或遗漏。安卓 13+ 首次启动会请求通知权限；**若未开启，会弹应用内提示说明临期 / 过期提醒无法正常送达（明确通知仅用于这两类提醒），可选「关闭」或「不再提示」**，后者记入应用开关不再弹出。
- **深色模式** — 跟随系统 `prefers-color-scheme`，深色环境自动切换配色。
- **使用细则弹窗** — 左上角「物」字按钮可随时打开说明弹窗（含开源仓库地址与复制按钮）；选「关闭」则每次启动都会再弹，选「不再提示」后不再自动弹出。

## 目录结构

```text
item_manage/
├── capacitor.config.json     Capacitor 配置（appId: com.tool.itemmanage，appName: 物品管家，webDir: www）
├── package.json              依赖与脚本（test / sync:android / build:apk）
├── build-apk.ps1             一键构建 Release APK 的 PowerShell 脚本
├── README.md
├── www/                      网页源码，日常改动都只在这里（原生仅 SaveAsPlugin 一处例外）
│   ├── index.html            页面结构 + 全部内联样式（含深色主题）
│   ├── app.js                DOM 交互、自绘组件、事件绑定
│   ├── logic.js              纯逻辑层（日期、有效期、金额、校验、筛选），无 DOM 依赖，可单测
│   └── storage.js            存储层与适配器注册表
├── test/
│   └── logic.test.js         logic.js 的单元测试（node:test）
└── android/                  Capacitor 生成的原生工程
    └── app/
        ├── src/main/java/com/tool/itemmanage/
        │   ├── MainActivity.java        启动入口，注册下面的自定义插件
        │   └── SaveAsPlugin.java        自定义插件：另存为 / 覆盖上次备份 / 选择备份文件导入
        ├── src/main/assets/public/     npx cap sync 后从 www/ 复制来的副本，勿手改（且已被 .gitignore 排除）
        └── build/outputs/apk/release/物品管家-2.0.apk   构建产物
```

本地签名文件（`android/keystore.properties`、`android/itemmanage-release.jks`）不入库，已在 `.gitignore` 中排除。

## 依赖

| 包 | 用途 |
| --- | --- |
| `@capacitor/core` / `@capacitor/cli` / `@capacitor/android` | Capacitor 运行时与 Android 平台 |
| `@capacitor/preferences` | 原生键值存储（物品数据与应用开关） |
| `@capacitor/filesystem` | 导出时把备份 JSON 写入应用缓存目录（走分享通路时使用） |
| `@capacitor/share` | 导出后调起系统分享面板 |
| `@capacitor/local-notifications` | 安卓端临期 / 过期系统通知与排期 |
| `SaveAsPlugin`（项目内自定义插件，非 npm 包） | 导出时调起系统「另存为」界面（`save`）、覆盖上次文件（`overwrite`）；导入时调起文件选择器并读出内容（`pickBackup`） |

## 本地预览

用静态 HTTP 服务打开 `www/index.html`（ES Module 需要 HTTP，不能直接用 `file://`）：

```sh
npx serve .
```

浏览器里没有 `window.Capacitor`，数据会落到 `localStorage`，方便调试。

## 单元测试

`www/logic.js` 是不依赖 DOM 的纯逻辑层（日期换算、有效期判定、金额汇总、数据校验、日期筛选），用 Node 内置测试框架覆盖：

```sh
npm test
```

## 安装依赖并打包 Android APK

```sh
npm install
npx cap sync android
```

首次生成原生工程时可执行 `npx cap add android`。之后每次修改 `www/` 都要再跑一次 `npx cap sync android`（或 `npm run sync:android`），否则 APK 里还是旧代码。

构建 APK（**必须用 JDK 21**，JDK 26 会因 jlink 处理不了 `core-for-system-modules.jar` 而失败）：

```powershell
npm run build:apk
```

等价于手动执行：

```powershell
$env:JAVA_HOME='C:\Users\lan\.jdks\jbr-21.0.11'
cd android
.\gradlew assembleRelease
```

`build-apk.ps1` 会自动设置 `JAVA_HOME`、调用 `gradlew assembleRelease`，并打印产物路径与大小。也可以在 Android Studio 里选 **Build > Build Bundle(s) / APK(s) > Build APK(s)**。

产物：`android/app/build/outputs/apk/release/物品管家-2.0.apk`。

## 发布签名

`android/app/build.gradle` 的 release 签名配置从 `android/keystore.properties` 读取（密钥文件与配置文件同放在 `android/` 目录）；该文件不存在时自动回退到 debug 签名（便于本地调试，但**不可用于对外分发**）。

首次发布前生成签名密钥：

```powershell
$env:JAVA_HOME='C:\Users\lan\.jdks\jbr-21.0.11'
cd android
& "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -v `
  -keystore itemmanage-release.jks -alias itemmanage `
  -keyalg RSA -keysize 2048 -validity 10000
```

然后在 `android/keystore.properties` 写入（文件不入库）：

```properties
storeFile=itemmanage-release.jks
storePassword=<你的密码>
keyAlias=itemmanage
keyPassword=<你的密码>
```

密钥与密码一旦用于正式发布就**不可更换**（换掉等于换了一个新应用），务必妥善备份 `.jks` 与密码。

## 版本策略

`android/app/build.gradle` 的 `defaultConfig` 里维护版本号：

- 每次对外发布 `versionCode` **+1**（只增不减，用于应用更新）。
- `versionName` 采用 `<主>.<次>` 两位，如 `1.0`；功能级更新进主版本号。
- 产物文件名由 `applicationVariants` 自动带上版本号：`物品管家-<versionName>.apk`。

当前：`versionCode 2`、`versionName 2.0`。

## 更新日志

### 2.0（2026-10-20）——相对 1.0（初始版）的改动与修复

**功能新增**

- **导出「另存为」**：安卓端调起系统「另存为」界面（SAF，`SaveAsPlugin.save`），保存目录与文件名自选；另存为会用目录级 URI 预置上次保存的位置（各厂商支持不一，不保证生效）；成功后把位置记入应用开关 `lastBackup`，下次导出可「覆盖上次」直接更新同一文件，或「另存新文件」换目录 / 换文件名；同时保留「分享」通路与浏览器普通下载。
- **导入升级**：改用系统文件选择器（`SaveAsPlugin.pickBackup`），导入前提示上次导出路径、由用户自行前往；导入前校验结构、id 唯一性与时间字段有效性；导入方式二选一：**覆盖导入**（清空重建）或**合并导入**（本地优先，按 id 并集）。
- **纯逻辑层与单元测试**：新增 `www/logic.js`（日期换算、有效期判定、金额汇总、数据校验、日期筛选、备份合并、提醒排期）与 `test/logic.test.js`（`npm test`，12 个用例）。
- **临期 / 过期通知**：安卓端通过系统通知栏提醒（`@capacitor/local-notifications`）——进入临期窗口的第一天与到期当天各排一条通知，统一 09:00 触发；每次启动与数据变化全量重排，不残留旧通知；安卓 13+ 首次启动会请求通知权限，拒绝后弹应用内说明（可「不再提示」）。
- **一键构建脚本**：新增 `build-apk.ps1`（自动设置 JDK 21 并执行 `gradlew assembleRelease`）；`package.json` 增加 `test` / `sync:android` / `build:apk` 脚本。
- **深色模式**：跟随系统 `prefers-color-scheme` 自动切换配色。
- **自定义图标**：应用图标替换为蓝底白「物」字图标。

**问题修复**

- **导出文件名 UTC 跨日错位**：1.0 用 `new Date().toISOString().slice(0, 10)` 生成文件名，在非零时区会与实际日期错位（如晚间导出文件名显示为次日）；2.0 改为本地时区 `todayString()`。
- **安卓端无法保存备份**：1.0 依赖 `<a download>`，Android WebView 不响应导致导出无效；2.0 改走系统「另存为」，可自选位置保存。
- **删除后本地残留数据**：1.0 为软删除（记录标 `deleted: true` 仍留在存储里）；2.0 改为硬删除直接移除记录，启动时自动清理旧版本遗留墓碑并写回，导入时忽略备份中的墓碑——本地不再存在界面上看不到的数据。
- **导入找不到上次目录**：2.0 导入前直接显示上次导出路径，由用户在系统文件选择器中自行前往（不预置目录，规避各厂商对 `EXTRA_INITIAL_URI` 支持不一致的问题）。

**行为变化**

- 导出内容从「全部物品」改为「只导出界面上可见的物品」（`activeItems()`），备份条数与列表所见一致。
- 删除改为不可恢复（1.0 的软删除记录可被找回）；需要留存时请先导出备份。

**工程与发布**

- `AndroidManifest.xml` 移除 INTERNET 权限（本地应用无需网络，降低权限面）。
- Release 签名从 `android/keystore.properties` 读取正式密钥（缺失时回退 debug），并修正 `storeFile` 路径解析（`rootProject.file`，与配置文件同目录）；`.gitignore` 排除 `*.jks` / `keystore.properties`，密钥不入库。
- 版本号升至 `versionCode 2` / `versionName 2.0`，产物自动命名为 `物品管家-2.0.apk`（与 1.0 同一正式密钥签名，支持覆盖升级）。
- 新增 `.gitattributes`（统一 LF）；`package.json` 清理（`private: true`、`type: module`、license 更正为 MIT 与仓库一致）。

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
| `deleted` | 历史兼容字段：早期版本用软删除，现在删除即移除记录，现存数据恒为 `false`；导入旧备份时会忽略 `deleted: true` 的记录 |

存储键有两个：

- `item-manager-v1` — 物品数组，经 `Storage.pull()` / `Storage.push()` 读写。
- `item-manager-flags` — 应用开关，经 `Flags.pull()` / `Flags.push()` 读写，不进导出备份。目前包含：
  - `introDismissed` — 是否已选过「不再提示」；
  - `lastBackup` — 上次导出成功的备份位置 `{ uri, name, path }`，用于下次直接覆盖与导入时提示路径。SAF URI 会申请持久化权限；如果文件被移动、删除或权限失效，导出时会提示并清除该记录；
  - `reminderHintDismissed` — 通知权限未开启的提示是否已选过「不再提示」。

`storage.js` 在 Capacitor 环境下优先调用 `Capacitor.Plugins.Preferences.get()` / `set()`；如果拿不到该插件会直接抛错，而不会悄悄降级到浏览器存储，避免数据"看起来写进去了其实没写"。浏览器环境则使用 `localStorage`。

删除是直接从数据里移除记录，不做软删除。导出只包含界面上可见的物品，备份内容与所见一致；导入时会忽略历史备份里 `deleted: true` 的墓碑记录。旧版本留下的软删除记录会在应用启动时被清理并写回。导入时先校验 `version === 1` 且 `items` 为数组，再用 `validateBackupItems()` 做比启动读取更严格的检查（逐条归一化，并额外校验 id 不重复、`createdAt` / `updatedAt` 可解析），最后让用户选择覆盖或合并：覆盖直接整表替换，合并由 `mergeItems()` 按 id 做本地优先的并集。

## 界面约定

所有交互组件都是自绘的，不使用系统原生控件（原生日历、`confirm()` / `alert()`、底部半屏选择器一律不用）：

- 日期选择器 — `renderCalendar()` 手写月历 + 快捷胶囊（今天 / 7 天前 / 30 天前 / 1 年前，有效期侧为 7 天后 / 30 天后 / 1 年后）+ 清除按钮。
- 对话框 — `confirmDialog()` / `alertDialog()` 返回 Promise，用于删除确认、导出方式选择（覆盖上次 / 另存 / 分享）、导入路径提示与导入模式选择（覆盖 / 合并）、通知权限未开启提示（关闭 / 不再提示）、错误与结果提示。
- 日期筛选 — `renderDateFilter()` 生成三个可输入可下拉的年 / 月 / 日控件（`syncDatePart()` 负责手输归一化：年需 4 位数字，月 / 日 1–2 位并补零）。
- 使用细则弹窗 — 左上角 `#brand-button`（「物」字按钮）打开，`closeIntro(true)` 才会写入 `introDismissed`。

日期一律用本地时区的 `dateString(date)` 生成 `YYYY-MM-DD`（定义在 `logic.js`），不用 `toISOString()`，避免 UTC 跨日导致日期错位。

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
