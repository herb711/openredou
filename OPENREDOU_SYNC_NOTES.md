# OpenRedou 相对 opencode 的差异说明

更新时间：2026-06-25

## 当前基线

- 本文记录 OpenRedou 当前工作区相对 opencode 上游版本的差异、保留项和暂不迁移项。
- 当前 OpenRedou 版本元数据：`0.3.1`。
- 当前记录的 opencode 上游版本元数据：`1.17.9`。
- 上游基线提交：`5c23e88419 release: v1.17.9`
- OpenRedou 主迁移提交：`3c8d4a23f feat: create openredou mainline from opencode stable`
- 目标策略：尽量沿用 opencode 源码，只把 OpenRedou 必需功能以较小补丁叠加上去。

## 已迁移的 OpenRedou 功能

### 规则页和规则接口

用途：在项目侧边栏进入规则页，查看和编辑项目规则文件，并在系统提示词里补充规则路径说明。

主要文件：

- `packages/app/src/pages/session/rules-tab.tsx`
- `packages/app/src/pages/session.tsx`
- `packages/app/src/pages/session/session-side-panel.tsx`
- `packages/app/src/pages/session/helpers.ts`
- `packages/app/src/pages/layout.tsx`
- `packages/app/src/pages/layout/sidebar-project.tsx`
- `packages/app/src/context/layout.tsx`
- `packages/opencode/src/server/routes/instance/httpapi/groups/rules.ts`
- `packages/opencode/src/server/routes/instance/httpapi/handlers/rules.ts`
- `packages/opencode/src/server/routes/instance/httpapi/api.ts`
- `packages/opencode/src/server/routes/instance/httpapi/server.ts`
- `packages/opencode/src/session/system.ts`
- `packages/sdk/js/src/v2/gen/sdk.gen.ts`
- `packages/sdk/js/src/v2/gen/types.gen.ts`

后续同步时注意：

- 如果上游改了 session 页签、侧栏、HTTP API 注册方式，需要重新检查规则页入口和 `RulesApi` 注册。
- 如果规则接口变化，需要重新运行 `bun ./packages/sdk/js/script/build.ts` 生成 SDK。

### MCP、插件、技能设置页

用途：保留 OpenRedou 的设置页入口，用于管理 MCP、插件、技能，并支持 MCP `probe`。

主要文件：

- `packages/app/src/components/dialog-settings.tsx`
- `packages/app/src/components/settings-plugins.tsx`
- `packages/app/src/components/settings-plugins/common.tsx`
- `packages/app/src/components/settings-plugins/mcp.tsx`
- `packages/app/src/components/settings-plugins/plugins.tsx`
- `packages/app/src/components/settings-plugins/skills.tsx`
- `packages/opencode/src/mcp/index.ts`
- `packages/opencode/src/server/routes/instance/httpapi/groups/mcp.ts`
- `packages/opencode/src/server/routes/instance/httpapi/handlers/mcp.ts`
- `packages/sdk/js/src/v2/gen/sdk.gen.ts`
- `packages/sdk/js/src/v2/gen/types.gen.ts`

后续同步时注意：

- 如果上游 MCP API 或 SDK 生成结构改变，优先沿用上游结构，再把 `probe` 补进去。
- 设置页 UI 尽量只保留 OpenRedou 需要的入口，不扩大到无关设置重构。

### 品牌、桌面和发布相关

用途：保留 OpenRedou 产品名、图标、启动脚本、桌面更新源和发布配置。

主要文件：

- `README.md`
- `package.json`
- `bun.lock`
- `openredou.cmd`
- `logo.png`
- `packages/app/src/components/titlebar.tsx`
- `packages/app/src/components/windows-app-menu.tsx`
- `packages/app/src/desktop-menu.ts`
- `packages/desktop/package.json`
- `packages/desktop/electron-builder.config.ts`
- `packages/desktop/src/main/index.ts`
- `packages/desktop/src/main/ipc.ts`
- `packages/desktop/src/main/updater.ts`
- `packages/desktop/src/main/windows.ts`
- `packages/desktop/src/preload/types.ts`
- `packages/desktop/src/renderer/index.html`
- `packages/desktop/src/renderer/loading.html`
- `packages/desktop/icons/**`
- `packages/ui/src/assets/favicon/**`
- `packages/ui/src/assets/images/redou-logo.png`
- `packages/ui/src/components/favicon.tsx`
- `packages/ui/src/components/logo.css`
- `packages/ui/src/components/logo.tsx`
- `packages/ui/src/v2/components/wordmark-v2.tsx`
- `script/openredou-dev-linux.sh`
- `script/install-openredou-dev-launcher.sh`
- `script/publish.ts`

后续同步时注意：

- `opencode` 包名、协议或内部兼容字段不一定都要改成 `openredou`，除非它影响实际产品展示或发布。
- 桌面更新源、安装包名称、图标资源需要重点复核。

### 桌面标题栏操作区

用途：在桌面新布局的会话页右上角保留常用操作按钮。

主要文件：

- `packages/app/src/components/session/session-header.tsx`

包含的操作：

- 选择打开方式
- 服务器状态
- 切换终端
- 切换审查
- 切换文件树

后续同步时注意：

- V2 标题栏也必须渲染完整操作区，不能只保留状态和审查按钮。
- `isDesktopV2` 是 memo，条件里必须调用为 `isDesktopV2()`。
- 不要迁移 `SessionInfoPopover`。

## 已补的两个 bugfix

### 1. 中断或失败后不再弹出旧 todo

问题：会话中断或失败后，下一次发送消息时可能把之前持久化的 todo 重新拉回来，导致 todo 面板/提示异常弹出。

修复文件：

- `packages/app/src/pages/session.tsx`

关键逻辑：

- 读取 todo 缓存时优先使用 `serverSync.data.session_todo[id]`，否则使用 `sync.data.todo[id]`。
- 如果本地 todo 缓存是空数组，视为“中断/失败后已经隐藏 stale todo”，直接返回，不再强制刷新旧 todo。

后续同步时检查：

- 查找 `sync.session.todo(id, cached ? { force: true } : undefined)` 附近逻辑。
- 确认仍然存在空数组短路：`if (cached?.length === 0) return`。

### 2. 会话 Review 面板大变更集卡顿

问题：Review 面板在文件变更数量很大时，一次性渲染全部文件，容易出现明显卡顿。

修复文件：

- `packages/ui/src/components/session-review.tsx`
- `packages/ui/src/components/session-review.css`

关键逻辑：

- 默认只渲染前 `250` 个文件。
- 通过 `shownItems` 替代 `items()` 作为 `<For>` 的数据源。
- 如果还有隐藏文件，显示“显示更多”按钮，每次追加 `250` 个。
- 如果外部要求聚焦某个文件或评论，会自动把渲染上限扩展到目标文件所在位置。

后续同步时检查：

- `session-review.tsx` 中应保留：
  - `REVIEW_INITIAL_FILES`
  - `REVIEW_FILE_BATCH`
  - `shownItems`
  - `hidden`
  - `showMore`
- `session-review.css` 中应保留：
  - `[data-slot="session-review-more"]`
  - `[data-slot="session-review-more-meta"]`

## 已直接带入的低风险上游辅助内容

这些内容来自 `references/opencode-dev`，但不依赖上游 dev 的 `packages/core` / `packages/server` 大架构迁移，可以作为独立辅助文件保留。

### 文档和元数据

用途：保留上游 dev 架构背景、V2 schema 变更记录和 GitHub generated 文件标记，方便后续同步评估。

主要文件：

- `.gitattributes`
- `CONTEXT.md`
- `specs/storage/remove-opencode-db.md`
- `specs/v2/schema-changelog.md`

### UI 小组件、回归测试和静态资源

用途：保留可独立编译的小型 V2 UI 组件、更新安装状态 helper、两个 app e2e 回归测试和 stats banner 资源。

主要文件：

- `packages/ui/src/v2/components/project-avatar-v2.tsx`
- `packages/ui/src/v2/components/project-avatar-v2.css`
- `packages/ui/src/v2/components/project-avatar-v2.stories.tsx`
- `packages/ui/src/v2/components/tab-state-indicator.tsx`
- `packages/app/src/pages/layout/update.ts`
- `packages/app/src/pages/layout/update.test.ts`
- `packages/app/e2e/regression/prompt-thinking-level.spec.ts`
- `packages/app/e2e/regression/session-list-path-loading.spec.ts`
- `packages/stats/app/public/banner.png`

后续同步时注意：

- 这些文件目前只是低风险带入；如果后续要把它们接入实际 UI，需要再单独检查入口、样式 token 和导出路径。
- `packages/app/e2e/regression/*.spec.ts` 是 Playwright 回归测试，不要从仓库根目录运行测试。

### 第三方依赖补丁

用途：同步上游 dev 中两个低风险第三方依赖补丁，并通过根 `package.json` 的 `patchedDependencies` 启用。

主要文件：

- `patches/@ai-sdk%2Fgoogle@3.0.73.patch`
- `patches/pacote@21.5.0.patch`
- `package.json`
- `bun.lock`

关键逻辑：

- `@ai-sdk/google@3.0.73`：过滤 Gemini 消息转换后产生的空 `parts` 内容，避免向 Gemini 发送空模型消息。
- `pacote@21.5.0`：当 git tarball 下载返回不可解包内容时回退到 clone，降低私有仓库或托管端异常响应导致的安装失败。

后续同步时注意：

- 新增或调整 patch 后必须同步更新 `package.json` 的 `patchedDependencies`，并运行 `bun install` 刷新 `bun.lock`。
- 如果依赖版本升级，需要重新确认 patch 是否仍然适用。

## 明确不迁移的内容

### 会话信息弹窗

不要迁移：

- `SessionInfoPopover`
- `packages/app/src/components/session/session-info-popover.tsx`
- 相关 session header 入口

原因：用户已明确要求“会话信息弹窗不用移植过去”。

后续同步时检查：

```sh
rg -n "session-info-popover|SessionInfoPopover" packages/app/src packages/opencode/src packages/sdk/js/src
```

如果出现结果，需要确认是不是误带入。

## 暂不迁移的大块上游 dev 改动

这些上游 dev 改动影响面大，不在当前 `main` 清洁迁移范围内。后续如果要迁移，需要单独评估。

- 会话 metadata 数据库字段和会话模型大改。
- 配置模块从 `packages/opencode/src/config` 拆迁到 `packages/core/src/config` 和 `packages/core/src/v1/config`。
- ACP、会话切换、会话投影、消息重建相关大改。
- TUI session preview/dialog 大重构。
- `packages/app/src/components/settings-v2/**`、`settings-server-picker.tsx` 和 `context/global.tsx` 这一组新设置页/多服务器上下文改动。
- `packages/server/**`、`packages/effect-sqlite-node/**`、`project-copy` HTTP API、`pty-preparation` 和 GitHub action handler 等依赖上游 dev 新 core/service 结构的改动。

## 验证记录

主迁移后已通过：

- `packages/opencode`: `bun typecheck`
- `packages/app`: `bun typecheck`
- `packages/desktop`: `bun typecheck`
- `packages/sdk/js`: `bun typecheck`
- `packages/ui`: `bun typecheck`
- `packages/app`: `bun test src/pages/session/helpers.test.ts`
- `packages/opencode`: `bun test test/server/httpapi-mcp.test.ts test/server/httpapi-mcp-oauth.test.ts`
- `packages/opencode`: `bun test test/session/system.test.ts`

两个 bugfix 补丁后已通过：

- `packages/app`: `bun typecheck`
- `packages/ui`: `bun typecheck`
- `git diff --check`

低风险上游辅助内容和第三方依赖补丁加入后已通过：

- 根目录：`bun install`
- `packages/app`: `bun typecheck`
- `packages/ui`: `bun typecheck`
- 根目录：`git diff --check`

已知非阻塞失败：

- `packages/opencode`: `bun test test/session/prompt.test.ts test/session/snapshot-tool-race.test.ts`
- 失败表现为 Windows shell/snapshot 超时和临时目录清理 `EFAULT`，偏向既有环境或 flaky 问题。

## 后续同步清单

1. 先确认新的 opencode 稳定版 tag 和基线提交。
2. 从新上游基线创建干净分支或工作区。
3. 按本文档逐项重新落 OpenRedou 功能。
4. 避免迁移“会话信息弹窗”。
5. 如果改到 HTTP API，重新生成 SDK：

```sh
bun ./packages/sdk/js/script/build.ts
```

6. 类型检查必须从包目录运行，例如：

```sh
cd packages/app
bun typecheck

cd ../ui
bun typecheck
```

7. 不要从仓库根目录运行测试。
