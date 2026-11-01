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

## 外观配置

- `_config.redefine.yml`：主题设置、菜单、首页文案。
- `source/assets/custom.css`：少量自定义样式，未修改上游主题。
- `source/assets/hero.webp`：首页封面（AI 生成）。
- `source/assets/hello-cover.webp`：由同一封面裁切，用于 Hello World。

## 迁移说明

原仓库只有生成网页。本源码由原文章网页恢复；文章标题、内容、发布日期和网址保留。
原关于页为空，新关于页根据原首篇文章中的自述整理。
原 `/tags/`、`/tages/`、`/categories/`、`/links/` 路径保留。
修正原规范网址中的 `localhost:4000`。
Redefine 版权和许可证随 npm 依赖保留，主题署名保留在页脚。
