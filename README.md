# xiaolu-cmd 的博客源码

使用 Hexo 7.3.0 + Redefine 2.9.0。网站：https://xiaolu-cmd.github.io/

## 本地预览

安装 Node.js 22，然后执行：

```sh
npm ci
npm start
```

## 写文章与发布

文章在 `source/_posts/` 中；新增文章可用 `npx hexo new "文章标题"`。
保留已有文章文件名和日期，就能保留原有网址。

```sh
npm run build
npm run deploy
```

部署需要你自己的 GitHub 写入权限。`source` 分支保存源码，`master` 分支保存生成的网页，并由 GitHub Pages 托管。
修改源码后请先提交到 `source` 分支，再部署。不要在 `master` 上直接修改生成文件，否则下次构建会覆盖。

## 栏目与在线编辑

- `/world/`：锐评世界，支持观点正文、参考来源、标签和置顶。
- `/bloggers/`：优秀博主资源推荐，支持推荐理由、主页网址、标签检索和置顶。
- `/editor/`：两个栏目的统一在线编辑页面，可在手机或电脑使用。

在编辑页填写内容后，点击“到 GitHub 确认发布”。登录 `xiaolu-cmd` 并提交预填好的 Issue，即会触发自动发布。较长的内容会提供“复制发布内容”步骤，避免浏览器网址过长。
只有 Issue 作者和提交事件操作者均为 `xiaolu-cmd` 时，工作流才接受请求。发布记录和栏目内容均公开。下架只从网站展示中移除内容，GitHub 中的历史记录仍保留。
本机草稿保存在当前浏览器，提交后的内容保存在 `source` 分支的 `content/columns.json`。自动发布使用 `.github/workflows/publish-site.yml` 从源码构建，GitHub Pages 的发布方式为 GitHub Actions。
后续笔记或主题变更只要推送到 `source` 分支，即会自动部署。`master` 保留静态快照及默认分支工作流；日常内容以 `source` 为准。同步新内容前请先拉取远端 `source`，以包含在线编辑产生的提交。
`scripts/columns-pages.js` 会把工作流复制到生成结果，使用手动静态发布工具时不会丢失在线编辑入口。

## 外观配置

- `_config.redefine.yml`：主题设置、菜单、首页文案。
- `source/assets/custom.css`：少量自定义样式，未修改上游主题。
- `scripts/search-ready.js`：为 Redefine 2.9.0 的生成后搜索模块应用小补丁，修复首次索引加载较慢时不刷新结果的问题；未改动安装的主题文件。
- `source/assets/hero.webp`：首页封面（AI 生成）。
- `source/assets/hello-cover.webp`：由同一封面裁切，用于 Hello World。

## 迁移说明

原仓库只有生成网页。本源码由原文章网页恢复；文章标题、内容、发布日期和网址保留。
原关于页为空，新关于页根据原首篇文章中的自述整理。
原 `/tags/`、`/tages/`、`/categories/`、`/links/` 路径保留。
修正原规范网址中的 `localhost:4000`。
Redefine 版权和许可证随 npm 依赖保留，主题署名保留在页脚。
