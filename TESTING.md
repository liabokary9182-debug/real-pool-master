> 本文记录源码分支的测试和实现；本独立发布仓库仅包含运行所需的静态文件。完整 tests 和构建脚本见 https://github.com/liabokary9182-debug/layertext-studio/tree/real-pool-master-20261006 。

# 手机测试：大师杆法与战术版（未部署）

预览为 pool-master-tactics-preview.html，默认八球、56% 力度、中杆。顶部保留横屏、全屏、AI 测试与音乐按钮。

建议依次试：

1. 普通直球、薄球、碰库：确认熟悉的减速与碰撞手感已经回来。
2. 八球与九球开球：先用 56%，再试 80% 和 100%，比较散球和最高球速。
3. 辅助线：原来的首碰圆和两条短线已恢复，不显示全台反弹预测。
4. 袋口：打开 AI 测试，选择角袋慢球、中袋慢球、30° 切入和打偏袋口，分别观察落袋与反弹；再手动试擦袋角。口径保留 +2%。
5. AI 测试选择“大师翻袋专项”：观察出杆前击球点的低杆位置、目标球先碰库再落袋。
6. 选择“大师勾球进袋 · 有挡球”：观察白球绕过挡球，先碰下库再碰 1 号并进袋。
7. 选择“大师做斯诺克 · 高杆加塞”：观察出杆前高杆加左塞的击球点、白球停在遮挡位置；下一杆手动检查对手可否直接碰到自己的球。专项场景自动使用大师档；只是指定搜索战术，击球仍用实际物理。
8. 选择“大师杆法与下一球走位”，比较击球点及下一杆打 2 号的角度；普通局面再切标准、入门作对比。新开一局也可选择大师，确认正常对局会自行取舍进攻和防守。

运行当前检查：

```
node tests/physics-regression.cjs
node tests/physics-spin-regression.cjs
node tests/pocket-regression.cjs
node tests/preview-pocket-smoke.cjs /workspace/pool-master-tactics-preview.html
node tests/master-position-regression.cjs
node tests/master-tactics-regression.cjs
node tests/preview-master-smoke.cjs /workspace/pool-master-tactics-preview.html
node tests/ai-regression.cjs
node tests/source-mobile-smoke.cjs
node tests/mobile-preview-smoke.cjs /workspace/pool-master-tactics-preview.html
node tests/preview-clock-regression.cjs /workspace/pool-master-tactics-preview.html
```

预览使用原游戏的固定步长时钟。source-mobile 和预览 smoke 使用模拟接口，不代替真机测试。大师规划会先试算，手机上可能需要等待数秒。专项测试用固定随机种子验证，实际试玩仍有执行误差。详细实现见 MASTER_TACTICS.md，物理及袋口说明见 PHYSICS_REVIEW.md。音乐沿用上一版测试曲。源码在 real-pool-web 目录启动本地静态服务即可测试。

当前部署：独立仓库 real-pool-master 的 main 分支，站点根目录为仓库根目录；源文件修改、测试和部署流程以 README 当前章节为准。上面 real-pool-web 与 20261006 分支的记录仅为历史。

### 独立异步启动与火箭加载

运行 `node scripts/build-entry.cjs`，再运行 `node tests/entry-loading-regression.cjs`。覆盖：音乐或背景请求挂起不阻塞入场、样式比引擎晚到、下载失败仅重试一次进行中的请求、重试不刷新整页、进度与火箭位置同步、网络慢时继续等待。`node tests/landscape-regression.cjs` 同时校验 HTML 中的横屏适配与源文件一致。
