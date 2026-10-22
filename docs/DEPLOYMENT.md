# GitHub Pages 部署准备

## 当前状态

2026-10-22：本地静态项目、相对资源路径、.nojekyll、README、使用说明与验收记录已准备。源码已提交并上传至 https://github.com/LPDDOG/TradeGuard 的 main 分支；GitHub Pages 已成功发布至 https://lpddog.github.io/TradeGuard/ ，首页及全部运行资源返回 200；已在浏览器确认看板和演示数据，完整线上业务流程仍需进一步验收。PDF 成品仍待普通浏览器验收。

本文件是参考说明，不要求初学者一次完成所有操作。与 Codex 协作时，先提供目标 GitHub 仓库链接，再逐步完成后续操作，无需手写代码。

## 发布方式

使用分支发布，无需 npm、构建环境、API Key、数据库或自定义部署工作流。根目录的 index.html、assets/ 和 .nojekyll 为运行所需文件。README、docs、tests、scripts 可随源码保留，但不是网站运行依赖。

GitHub Free 方案可使用公开仓库发布 Pages。创建项目仓库时可命名为 tradeguard，不必创建名为用户名.github.io 的个人主页仓库。项目已提供 README，建议目标仓库初始为空，以便后续上传完整项目。

当源码已经上传且 main 分支存在时，仓库的设置为：

| 位置 | 值 |
| --- | --- |
| Settings → Pages → Build and deployment → Source | Deploy from a branch |
| Branch | main |
| Folder | /(root) |
| 最后操作 | Save |

不要选择 /docs：本项目入口不在 docs 目录。资源采用相对路径，导航采用 hash 地址，不需要服务器路由或 404 重写。

线上 URL 以 GitHub Pages 显示的地址为准；常见形式为 `https://用户名.github.io/仓库名/`，这只是格式说明，不是本项目已发布地址。

说明依据：[GitHub 创建 Pages 站点](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)、[配置发布源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。

## 上传材料

release/TradeGuard-source.zip 是包含源码、文档、测试与发布标记的交付包；release/TradeGuard-pages.zip 是只包含运行文件的静态包。两者均须解压后保持目录结构，直接上传 ZIP 文件不会形成可用 Pages 网站。

交付包不含 .git、浏览器 localStorage、账号凭据或用户导出文件。ZIP 根目录直接包含 index.html，不要再套一层 tradeguard 目录。release/ 不进入 Git 跟踪。

不要上传真实客户资料。每个访问者在自己浏览器中生成演示数据与保存修改，静态网页不会把订单发送到作者服务器。

## 发布后验收

仅在 Pages 显示 Visit site 且实际访问成功后，才能把 README 的状态替换为已发布并写入真实地址。检查以下结果：

1. 正式地址首次访问可见 18 条虚构订单与三张图表，样式和脚本没有 404。
2. 从订单新增、编辑到评估详情可完成，刷新后保留数据；删除后数量和图表更新。
3. 报告 hash 链接刷新后仍能打开，原订单仍存在时显示对应详情。
4. 模板下载、异常 CSV 提示和导出均可用，恢复演示需要确认。
5. 手机导航、表单、弹窗及横向表格可操作；图表数据表可展开。
6. 在普通浏览器另存 PDF，逐页检查内容完整与分页，不能用屏幕截图替代。

发布后的浏览器存储与本地预览互相独立，作者测试数据不会自动迁移。若要迁移演示修改，使用 CSV 导出再导入，留意重复编号规则。

## 常见问题

| 现象 | 排查 |
| --- | --- |
| 首页 404 | 检查 Pages 分支与根目录，确认 index.html 已上传；以 Pages 状态为准 |
| 有文字但没样式/图表 | 保留 assets 目录及文件名大小写，检查相对资源没有被移到其他层级 |
| docs 目录被当作站点 | 把 Pages Folder 改为 /(root)，docs 仅存放说明 |
| 刷新后看到不同订单 | 确认浏览器与域名是否相同，localStorage 不跨地址同步 |
| 修改后仍是旧界面 | 确认 Pages 部署完成后刷新缓存；无需清空订单存储 |
| 打印按钮在内置浏览器无响应 | 使用普通 Chrome/Edge 检查打印窗口；该限制尚未排除 |

没有验证实际发布状态时，不应在简历或 README 写“线上部署成功”。
