# 成长档案自动排版

这是一个基于 Vue 3、TypeScript 和 Vite 的 A4 成长记录册预览项目。页面读取 `api.json` 中的主题、文章和图片数据，自动生成目录页、主题封面页和内容页，并通过浏览器打印导出 PDF。

## 功能

- 读取 `api.json` 作为报表数据源。
- 自动生成目录，并按最终打印页码显示主题和文章位置。
- 每个主题生成封面页，展示标题、副标题和说明文字。
- 内容页按文本长度和图片数量自动分页。
- 图片按实际宽高比生成单图、多图、三图和满页图库布局。
- 目录页使用 `images/mulu.jpg` 作为背景图。
- 支持 `?mock=24&themes=3` 生成 mock 数据，用于压力测试分页。
- 提供 A4 打印样式，可通过浏览器打印导出 PDF。

## 环境

项目 `package.json` 要求：

- Node.js `^20.19.0 || >=22.12.0`
- npm 可直接运行脚本

当前仓库没有提交包管理器锁文件。如果团队后续固定使用 npm、pnpm 或 yarn，建议补充对应锁文件并保持一致。

## 开发

安装依赖：

```sh
npm install
```

启动开发服务器：

```sh
npm run dev
```

常用预览地址：

```text
http://127.0.0.1:5173/
http://127.0.0.1:5173/?mock=24
http://127.0.0.1:5173/?mock=40&themes=5
```

构建：

```sh
npm run build
```

本地预览构建产物：

```sh
npm run preview
```

## 主要文件

- `api.json`：真实报表数据源。
- `src/App.vue`：报表预览主组件。
- `src/types/report.ts`：报表数据类型。
- `src/utils/pagination.ts`：正文分页、目录项和背景图选择逻辑。
- `src/utils/mockReport.ts`：mock 主题和文章生成逻辑。
- `src/assets/main.css`：A4 页面、目录、主题封面、正文、图库和打印样式。
- `images/`：报表背景图和文章图片资源。

更详细的实现说明见 `IMPLEMENTATION.md`。
