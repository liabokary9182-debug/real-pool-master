# 2026-10-11 GitHub Pages 公共入口

用户要求用自己的 GitHub 仓库部署，普通浏览器无需 ChatGPT 登录，原版内容、界面、玩法、图片和音乐一切不变。

- 仓库：liabokary9182-debug/real-pool-master
- 新入口：https://liabokary9182-debug.github.io/real-pool-master/play/
- 托管：现有 GitHub Pages，main 分支根目录。
- 源版本：dfe75d0a5a69218cda6c857e154aa2586e17afec。
- play/ 直接复用源版本的 Git blob 和 assets/sounds 子树；所有游戏文件逐字节一致，未改动游戏行为。

后续发布方法：先读取远端 main 与 Pages 工作流，基于当前树创建提交，非 force 更新 main 并携带 expected_sha。按精确提交 SHA 确认 Pages 工作流成功；匿名 HTTPS 检查新入口和全部运行资源，与源文件 Git blob SHA 比对。不要将 chatgpt.site 入口作为用户要求的 GitHub 公共入口。

play/ 是本次源版本的静态副本。后续修改游戏时若需两个入口同步，请同时更新根目录与 play/；资源使用相对路径，不能改成站点根绝对路径。
