# ProcessReporterCli

Windows 客户端，用于实时上报当前前台进程和媒体播放信息到 [Mix Space](https://github.com/mx-space) 后端，与 [ProcessReporterMac](https://github.com/mx-space/ProcessReporterMac) 功能对齐。

## 功能

- 实时检测前台活动窗口（进程名、窗口标题、图标）
- 通过 Windows SMTC (System Media Transport Controls) 检测当前播放的媒体信息（歌曲名、艺术家、时长、进度）
- 对不支持 SMTC 的应用（如 QQ音乐、网易云音乐），可从窗口标题中提取媒体信息
- 进程图标自动上传到 S3 兼容存储，并缓存到本地 SQLite 数据库
- 系统托盘图标，显示当前进程和媒体状态，支持快捷操作
- 可自定义进程名替换规则和忽略列表
- API 格式与 macOS 客户端完全一致

## 系统要求

- Windows 10 (1903+) / Windows 11
- [Node.js](https://nodejs.org/) 18+
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)（仅构建时需要，分发包已包含独立运行时）

## 快速开始

### 修改云函数

替换`update.ts`为 [该版本](https://github.com/gufei233/ProcessReporterCli/blob/main/update.ts)

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/gufei233/ProcessReporterCli.git
cd ProcessReporterCli

# 安装依赖
yarn install --ignore-engines

# 复制并编辑配置文件
cp .env.example .env
# 编辑 .env，填入你的配置

# 构建
yarn run build

# 运行
cd dist
node index.js
# 或者双击 start.bat
```

### 使用分发包

如果你拿到了已构建的 `dist/` 目录：

1. 将 `.env.example` 复制为 `.env`
2. 编辑 `.env`，填入你的配置
3. 双击 `start.bat` 运行（或 `node index.js`）

## 配置说明

### 环境变量 (.env)

```env
# 你的认证密钥（对应 Mix Space 后台设置的 key）
UPDATE_KEY=your_key_here

# 你的云函数/API 地址
API_URL=https://your-api-endpoint.com/api/fn/ps/update

# S3 兼容存储配置（用于上传进程图标）
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
S3_BUCKET=your_bucket
S3_ENDPOINT=https://s3.example.com
S3_CUSTOM_DOMAIN=https://cdn.example.com/bucket_name
S3_REGION=us-east-1
```

| 变量 | 说明 |
|------|------|
| `UPDATE_KEY` | Mix Space 后台设置的认证密钥 |
| `API_URL` | 云函数或 API 端点地址 |
| `S3_ACCESS_KEY` | S3 Access Key |
| `S3_SECRET_KEY` | S3 Secret Key |
| `S3_BUCKET` | S3 桶名 |
| `S3_ENDPOINT` | S3 服务端点 |
| `S3_CUSTOM_DOMAIN` | S3 自定义域名（需带桶名，如 `https://cdn.example.com/bucket`） |
| `S3_REGION` | S3 区域（如使用 Garage 可填 `Garage`） |

### 进程规则 (src/configs.ts)

可以在 `src/configs.ts` 中自定义进程名替换和忽略规则：

```typescript
// 替换规则示例
export const rules: Rule[] = [
  {
    matchApplication: "Visual Studio Code",
    replace: {
      application: () => "Code",
      description: (des) => des ? "写码:\n-> " + des.split(" - ").slice(0, 2).join(" - ") : "",
    },
  },
]

// 忽略列表
export const ignoreProcessNames = [
  "下载",
  /^SearchHost/,
]
```

## 技术架构

```
┌─────────────────────────────┐    ┌──────────────────────────┐
│  @paymoapp/active-window    │    │  media-helper.exe (C#)   │
│  活动窗口检测 (100ms 节流)    │    │  WinRT SMTC (10s 轮询)   │
└──────────┬──────────────────┘    └───────────┬──────────────┘
           │                                   │
           ▼                                   ▼
┌──────────────────────────────────────────────────────────┐
│  bootstarp.ts — 合并 windowInfo + mediaInfo               │
└──────────┬───────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────┐
│  replacer.ts             │
│  进程名替换 / 忽略过滤    │
│  extractMedia 回退逻辑    │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐     ┌────────────────────┐
│  pusher.ts               │────▶│  uploader.ts (S3)  │
│  去重 / 构建请求体         │     │  图标上传 + 缓存    │
│  POST → API endpoint     │     └────────────────────┘
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│  tray.ts                 │
│  系统托盘状态更新          │
└──────────────────────────┘
```

### 媒体检测

媒体检测使用独立的 C# 程序 `media-helper.exe`，通过 Windows Runtime (WinRT) 的 `GlobalSystemMediaTransportControlsSessionManager` API 获取系统级媒体播放信息。

支持检测的应用包括：Spotify、Apple Music、QQ音乐（SMTC）、网易云音乐（SMTC）、foobar2000、浏览器音视频播放等所有支持 Windows SMTC 的应用。

对于不支持 SMTC 的应用（如部分版本的 QQ音乐、网易云音乐），可通过 `extractMedia` 规则从窗口标题中提取媒体信息作为回退方案。

### API 请求格式

发送到服务端的数据格式（与 macOS 客户端一致）：

```json
{
  "process": {
    "name": "Microsoft Edge",
    "iconUrl": "https://cdn.example.com/bucket/hash.png",
    "description": "窗口标题"
  },
  "media": {
    "title": "歌曲名",
    "artist": "艺术家",
    "duration": 240.0,
    "elapsedTime": 120.0,
    "processName": "Spotify"
  },
  "key": "your_auth_key",
  "timestamp": 1234567890
}
```

## 项目结构

```
ProcessReporterCli/
├── src/
│   ├── index.ts          # 入口：初始化托盘、连接推送与媒体检测
│   ├── bootstarp.ts      # 主循环：活动窗口监听 + 媒体检测整合
│   ├── pusher.ts         # API 推送：去重、S3 图标上传、发送请求
│   ├── replacer.ts       # 规则引擎：进程名替换、忽略、extractMedia
│   ├── media.ts          # 媒体检测：管理 media-helper.exe 子进程
│   ├── tray.ts           # 系统托盘：菜单、状态显示
│   ├── uploader.ts       # S3 图标上传 + SQLite 缓存
│   ├── configs.ts        # 配置：规则、忽略列表、S3 参数
│   ├── types.ts          # 类型定义
│   ├── db.ts             # SQLite 数据库管理
│   ├── logger.ts         # 日志（consola + 文件输出）
│   └── utils.ts          # 工具函数
├── scripts/
│   └── media-helper/     # C# 媒体检测程序
│       ├── Program.cs
│       └── media-helper.csproj
├── after-build.js        # 构建后处理脚本
├── tsup.config.ts        # tsup 打包配置
├── start.bat             # Windows 启动脚本
├── .env.example          # 环境变量模板
└── package.json
```

## 构建产物 (dist/)

```
dist/
├── index.js                        # 打包后的主程序
├── PaymoActiveWindow-*.node        # 活动窗口检测原生模块
├── build/Release/node_sqlite3.node # SQLite 原生模块
├── scripts/media-helper.exe        # 媒体检测程序（自包含，无需 .NET 运行时）
├── traybin/tray_windows_release.exe# 系统托盘二进制
├── start.bat                       # 启动脚本
├── .env.example                    # 配置模板
├── .env                            # 用户配置（需自行创建）
└── logs/                           # 运行日志目录
```

## 系统托盘

运行后会在系统托盘显示图标，右键菜单包含：

- **Process**: 当前前台进程名（只读）
- **Media**: 当前播放的媒体信息（只读）
- **Edit Config**: 用记事本打开 .env 配置文件
- **View Logs**: 打开日志目录
- **Reload Config**: 重新加载配置
- **Exit**: 退出程序

## 相关项目

- [ProcessReporterMac](https://github.com/mx-space/ProcessReporterMac) — macOS 客户端
- [Mix Space](https://github.com/mx-space) — 后端服务

## License

MIT

