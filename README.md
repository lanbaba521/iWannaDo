# iWannaDo

个人小工具集合仓库。每个工具独占 `tool/` 下的一个目录，互不依赖，可以单独安装、单独打包发布。

当前收录：

| 工具 | 说明 | 形态 |
| --- | --- | --- |
| [物品管家](tool/item_manage/README.md)（v2.0） | 手机端物品管理：有效期 / 临期提醒、金额记账、备份导出导入（另存为 / 覆盖上次 / 合并导入） | 纯前端 + Capacitor 打包的 Android APK |

各工具的版本变更与修复记录见对应工具 README 的「更新日志」章节。

仓库地址：<https://github.com/lanbaba521/iWannaDo.git>　许可证：[MIT](LICENSE)

## 目录结构

```text
iWannaDo/
├── LICENSE                      MIT 许可证
├── README.md                    本文件，仓库总说明
├── .gitattributes               统一换行符为 LF，避免 Windows 下 CRLF 警告
└── tool/                        所有自建工具的根目录
    └── item_manage/             物品管家（目前唯一的工具）
        ├── README.md            该工具的详细说明
        ├── capacitor.config.json  Capacitor 配置（appId / 应用名 / webDir）
        ├── package.json         依赖与脚本（test / sync:android / build:apk）
        ├── build-apk.ps1        一键构建 Release APK 的 PowerShell 脚本
        ├── www/                 前端源码，唯一需要手写的部分
        │   ├── index.html       页面结构 + 全部样式（含深色主题）
        │   ├── app.js           业务逻辑、自绘组件、事件绑定
        │   ├── logic.js         纯逻辑层（无 DOM 依赖，可单元测试）
        │   └── storage.js       存储层（Capacitor Preferences / localStorage）
        ├── test/                logic.js 的单元测试
        ├── android/             Capacitor 生成的 Android 原生工程
        └── node_modules/        依赖安装目录
```

## 各目录作用

- **`tool/`** — 工具集合根目录。新增工具时在这里建同名子目录，各自带 `package.json` 和 `README.md`，彼此不共享代码，避免耦合。
- **`tool/item_manage/www/`** — 唯一的源码目录。无框架、无构建工具，直接以原生 ES Module 加载，浏览器和 WebView 都能跑。改功能只改这里（原生侧仅 `SaveAsPlugin.java` 一个自定义插件例外）。其中 `logic.js` 放不依赖 DOM 的纯函数，`app.js` 负责 DOM 与交互，`storage.js` 负责持久化。
- **`tool/item_manage/test/`** — 针对 `www/logic.js` 的单元测试，用 `npm test` 运行；依赖 Node 内置的 `node:test`，不需要额外安装依赖。
- **`tool/item_manage/android/`** — Capacitor 生成的原生工程，用于出 APK。`android/app/src/main/assets/public/` 是执行 `npx cap sync android` 后从 `www/` 复制过来的副本，**不要直接改**（该目录也已被 `.gitignore` 排除，改了不会进版本库）。
  - `android/app/build/outputs/apk/release/物品管家-2.0.apk` — 构建产物（Release）
  - `android/build/`、`android/.gradle/`、`android/.idea/`、`android/local.properties` — 构建缓存与本地 IDE / SDK 配置，可随时删除并重新生成
- **`tool/item_manage/node_modules/`** — npm 依赖，安装后可忽略。
- **`.idea/`** — 仓库根目录的 IDE 本地配置，不影响程序运行。

## 使用方式

进入具体工具的目录后按该工具的 README 操作。以物品管家为例：

```sh
cd tool/item_manage
npm install
npx cap sync android          # 把 www/ 同步进原生工程
npm test                      # 跑纯逻辑层单元测试
npm run build:apk             # 构建 Release APK
```

## 通用约定

- 源码永远写在工具的 `www/`（或同类源码目录）下，原生工程目录视为生成物。
- 改动前端后必须 `npx cap sync android` 才会进入 APK。
- 用 Gradle 构建 Android 时需要 JDK 21（本机路径 `C:\Users\lan\.jdks\jbr-21.0.11`）；JDK 26 会因 jlink 无法处理 `core-for-system-modules.jar` 而失败。
- 发布签名密钥（`*.jks` / `*.keystore`）与 `keystore.properties` 只存本地，已在 `.gitignore` 中排除，严禁入库。
