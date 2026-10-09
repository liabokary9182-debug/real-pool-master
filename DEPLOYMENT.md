# 小糖台球的发布入口与操作记录

- 独立仓库：`liabokary9182-debug/real-pool-master`。
- 发布地址：https://liabokary9182-debug.github.io/real-pool-master/ 。
- 当前托管：GitHub Pages，发布分支 `main`，根目录静态 `index.html`，无需构建。
- 原 `layertext-studio/real-pool-web` 与 README 中旧源码分支的说明不适用于当前独立站点。

## 2026-10-09 发布准备

用户在验收预览阶段要求“先不发布”，随后明确要求“你把网站部署给我”，因此此次允许更新现有网站。

本次内容：清空观众、强化独牙传奇和蓝色聚光灯的欢迎背景；手机仅横屏；移除旧 Lullaby 界面；保留用户提供的欢迎及对局音乐；受约束的落袋动画；返回上一页；比分结算、再来一局与返回主页。

发布前基线：`b985cbe885b68dacb5c43aa89b5a2033bf0d13dd`，对应 Pages 工作流 `37723678975` 已成功。此次的五组音频、辅助线、导航结算、落袋和方向限制回归检查均通过。模拟 DOM 与物理检查不代表真机帧率验收。

## 保留成功的操作方法

1. 查询远端 `main` 当前 SHA，以及现有 Pages 工作流，避免依据过期 README 换发布入口。
2. 完成变更与必要检查。以远端当前树为基础上传变更文件；图片用 base64 blob，文本使用 tree entry 的 content。
3. 创建以远端当前 SHA 为父节点的提交。更新 `main` 时携带 expected_sha，并保持非 force；若远端发生变化，读取和整合后再重试。
4. 查询仓库的 Actions runs 并按精确提交 SHA 找到 `pages build and deployment`，不要使用仅查询 PR 工作流的包装器。
5. 工作流成功后，通过 HTTPS 检查首页包含新入口、图片与音频能加载，并核对发布文件与本地校验值。

此前本地 HTTP 服务无法从独立云端浏览器访问，file 协议被浏览器策略拒绝。浏览器验收应使用已发布的 HTTPS 网址；不要再次尝试绕过本地文件限制。
