# Silver Cat Pet · 银渐层桌宠

一只有点小脾气的银渐层。蓝眼睛、深蓝蝴蝶结，点一下会回应，拖起来会蹬腿，闲下来会散步或打盹。

![All seven animations](docs/all-actions.gif)

## 这是什么

参考 [DeepSeek-Pet](https://github.com/nanonocturne-altago/DeepSeek-Pet) 的交互方式，独立实现的 Electron 桌宠。
沿用透明悬浮、点击互动、拖拽、漫游、动作菜单的思路，使用本项目新生成的猫咪素材。
无需 DeepSeek Harness、账号或 API Key；运行时不访问网络，不收集数据。

当前是 **0.1.0**：7 组逐帧动画，每组 4 帧（共 28 帧）。这是轻量逐帧动画，尚非上游 97 组视频动作的完整替代。

| 动作 | 触发方式 |
| --- | --- |
| 眨眼待机 | 默认循环 |
| 散步 | 自动漫游或菜单；碰到边界转向 |
| 挥爪 | 点击或菜单 |
| 小脾气 | 点击或菜单 |
| 被提起来 | 拖动时；松手回到待机 |
| 打盹 | 随机小动作或菜单 |
| 跳跃 | 随机小动作或菜单 |

点击猫咪互动，按住拖动换位置，右键或猫咪旁的 `•••` 打开菜单。
菜单支持大小、音效、动作间隔、漫游和暂停。菜单栏/托盘提供“找回猫咪”、预览和退出。
透明像素可点击穿透；应用不主动抢键盘焦点。音效默认关闭，是本地合成的短提示音。

## 开发运行

需要 Node.js 22 或更高，以及 pnpm 10.30.3：

```sh
corepack enable
corepack prepare pnpm@10.30.3 --activate
pnpm install --frozen-lockfile
pnpm start
```

如果未安装 Corepack，可用 `npm install -g pnpm@10.30.3` 安装 pnpm。
首次安装需要下载 Electron；若安装时跳过其脚本，执行 `node node_modules/electron/install.js`。

只看网页预览：

```sh
pnpm preview
# 打开 http://127.0.0.1:4173
```

网页预览可调整大小、逐个播放动作和测试拖拽；系统透明悬浮、点击穿透与菜单栏仅在桌面版可用。

## 构建与验证

```sh
pnpm test
pnpm check
pnpm exec electron . --smoke-test
pnpm dist:mac   # macOS Apple Silicon: DMG + ZIP
pnpm dist:win   # Windows x64: portable EXE，在 Windows 上构建
```

生成物位于 `release/`。应用未使用 Apple Developer / Windows 代码签名证书，系统可能提示来源未验证。
不要全局关闭系统安全检查；仅在确认自己下载/构建的文件可信后按系统提供的单个应用打开方式处理。

GitHub Actions 在 push/PR 时运行测试，手动运行或推送 `v*` 标签时构建 macOS arm64 与 Windows x64 安装包。
产物保存在 Actions 的 artifacts；标签本身不会自动发布 GitHub Release。

## 项目结构

```text
assets/source/       定稿和 AI 生成的原始动作条
assets/animations/   规范化透明 PNG 动作条及 manifest
src/                 同一套桌宠播放和交互代码；网页/桌面复用
electron/            透明窗口、点击穿透、托盘和最小 IPC 桥
scripts/             本地预览服务、素材准备和校验
docs/                动作 GIF、联系表和素材校验结果
test/                时序、设置、移动边界测试
```

动作条每格 `384 × 416`，4 列。所有图片在启动时预加载，Canvas 播放期间不发起下载。
左行逐帧镜像右行动作，饰品无文字和左右手语义。跳跃保留竖直位移。

重新整理已有原始素材：

```sh
python3 -m venv .venv
.venv/bin/pip install -r scripts/requirements-assets.txt
.venv/bin/python scripts/prepare-assets.py
```

脚本只清理、裁切、等比缩放和拼接已生成的像素，不程序绘制猫咪。
修改角色或动作应先生成新的动作条，再跑素材校验与预览。

设置保存于本机 localStorage。桌面数据目录为系统 Application Support/AppData 下的 `SilverCatPet`，与上游应用隔离。
没有开机自启、API 余额记账、远程聊天、云同步或用户数据迁移。Linux 暂未打包验证。

许可证及来源见 [LICENSE](LICENSE) 和 [NOTICE.md](NOTICE.md)。
