# iWannaDo

个人小工具集合仓库。每个工具独占 `tool/` 下的一个目录，互不依赖，可以单独安装、单独打包发布。

当前收录：

| 工具 | 说明 | 形态 |
| --- | --- | --- |
| [物品管家](tool/item_manage/README.md) | 手机端物品管理：有效期 / 临期提醒、金额记账、备份导入导出 | 纯前端 + Capacitor 打包的 Android APK |

仓库地址：<https://github.com/lanbaba521/iWannaDo.git>　许可证：[MIT](LICENSE)

## 目录结构

```text
iWannaDo/
├── LICENSE                      MIT 许可证
├── README.md                    本文件，仓库总说明
└── tool/                        所有自建工具的根目录
    └── item_manage/             物品管家（目前唯一的工具）
        ├── README.md            该工具的详细说明
        ├── capacitor.config.json  Capacitor 配置（appId / 应用名 / webDir）
        ├── package.json         依赖与脚本
        ├── www/                 前端源码，唯一需要手写的部分
        │   ├── index.html       页面结构 + 全部样式
        │   ├── app.js           全部业务逻辑
        │   └── storage.js       存储层（Capacitor Preferences / localStorage）
        ├── android/             Capacitor 生成的 Android 原生工程
        └── node_modules/        依赖安装目录
```

## 各目录作用

- **`tool/`** — 工具集合根目录。新增工具时在这里建同名子目录，各自带 `package.json` 和 `README.md`，彼此不共享代码，避免耦合。
- **`tool/item_manage/www/`** — 唯一的源码目录。无框架、无构建工具，直接以原生 ES Module 加载，浏览器和 WebView 都能跑。改功能只改这里。
- **`tool/item_manage/android/`** — Capacitor 生成的原生工程，用于出 APK。`android/app/src/main/assets/public/` 是执行 `npx cap sync android` 后从 `www/` 复制过来的副本，**不要直接改**，改动应在下次同步时被覆盖。
  - `android/app/build/outputs/apk/release/物品管家-1.0.apk` — 构建产物（Release）
  - `android/build/`、`android/.gradle/`、`android/.idea/`、`android/local.properties` — 构建缓存与本地 IDE / SDK 配置，可随时删除并重新生成
- **`tool/item_manage/node_modules/`** — npm 依赖，安装后可忽略。
- **`.idea/`** — 仓库根目录的 IDE 本地配置，不影响程序运行。

## 使用方式

进入具体工具的目录后按该工具的 README 操作。以物品管家为例：

```sh
cd tool/item_manage
npm install
npx cap sync android          # 把 www/ 同步进原生工程
```

## 通用约定

- 源码永远写在工具的 `www/`（或同类源码目录）下，原生工程目录视为生成物。
- 改动前端后必须 `npx cap sync android` 才会进入 APK。
- 用 Gradle 构建 Android 时需要 JDK 21（本机路径 `C:\Users\lan\.jdks\jbr-21.0.11`）；JDK 26 会因 jlink 无法处理 `core-for-system-modules.jar` 而失败。
