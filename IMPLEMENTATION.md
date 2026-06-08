# 当前实现说明

本文档记录当前仓库中已经实现的报表预览功能，便于后续继续开发、联调或交接。

## 功能概览

当前项目是一个基于 Vue 3、TypeScript 和 Vite 的 A4 成长记录册预览页。页面会读取主题、文章、图片等报表数据，生成目录页和内容页，并按 A4 尺寸渲染为可打印页面。用户可以通过浏览器打印功能导出 PDF。

主要能力：

- 从 `api.json` 读取真实报表数据。
- 支持通过 URL 参数生成大量 mock 数据，用于压力测试分页和排版。
- 自动生成目录，并在目录中显示主题和文章所在页码。
- 按主题生成封面页，按文章内容和图片数量生成内容页。
- 长文本会按容量拆分到后续页面。
- 图片会根据数量和实际宽高比选择不同图库布局。
- 提供打印样式，隐藏工具栏并按 A4 无边距页面输出。

## 技术栈

- Vue 3：页面渲染和响应式状态。
- TypeScript：类型定义和分页逻辑。
- Vite：开发服务器和构建工具。
- Pinia：已在入口注册，但当前报表预览流程未使用 store。

常用命令：

```sh
pnpm run dev
pnpm run build
pnpm run preview
```

## 入口和文件结构

核心文件：

- `src/main.ts`：创建 Vue 应用，注册 Pinia，挂载 `App.vue`。
- `src/App.vue`：报表预览主组件，负责读取数据、处理 URL 参数、生成目录分页、渲染页面和触发打印。
- `src/types/report.ts`：报表相关 TypeScript 类型。
- `src/utils/pagination.ts`：报表正文分页、文章切片、目录项生成和图库布局基础分类。
- `src/utils/mockReport.ts`：基于真实数据扩展 mock 主题、文章、文本和图片。
- `src/assets/main.css`：A4 页面、目录、主题封面、内容卡片、图片图库和打印样式。
- `api.json`：当前真实报表数据源。
- `images/`：报表背景图和文章图片资源。

模板工程遗留文件仍存在：

- `src/components/*`
- `src/stores/counter.ts`
- `src/assets/base.css` 中的部分 Vue 模板默认变量

这些文件目前不参与成长记录册主流程。

## 数据结构

报表数据定义在 `src/types/report.ts`。

顶层数据是 `ReportTheme[]`：

```ts
interface ReportTheme {
  theme: string
  background: {
    image: string
    color: string
  }
  header: {
    title: string
    description: string
  }
  pages: ReportArticle[]
}
```

每个主题包含：

- `background.image`：主题页和内容页使用的背景图地址。
- `background.color`：背景底色。
- `header.title`：主题标题。
- `header.description`：主题封面说明文字。
- `pages`：主题下的文章列表。

每篇文章包含：

- `content.date`：日期，当前展示会拆出日号和年月。
- `content.title`：文章标题。
- `content.text`：正文。
- `gallery`：图片列表，每张图片包含 `id` 和 `url`。

分页后会生成 `ReportPage[]`，每页包含主题信息、主题内页码、全局页码、是否主题封面页，以及当前页承载的文章切片。

## 数据来源和 mock 参数

`src/App.vue` 默认读取 `api.json`：

```ts
import reportData from '../api.json'
```

如果 URL 中带有 `mock` 参数，则使用 `src/utils/mockReport.ts` 生成 mock 数据：

```text
/?mock=24
/?mock=40&themes=5
```

参数规则：

- `mock`：mock 文章总数，默认 `20`，最大 `120`。
- `themes`：mock 主题数量，默认 `3`，最大 `12`。
- 参数会被转成正整数，并限制在 `1` 到最大值之间。

mock 数据会复用 `api.json` 中的主题背景、标题和基础文章，并扩展标题、日期、正文长度和图片数量。图片数量使用 `[1, 2, 3, 4, 5, 7, 9, 12]` 模式，文本长度使用 `[1, 2, 3, 5, 7]` 模式，用于覆盖不同排版场景。

## 分页实现

分页逻辑集中在 `src/utils/pagination.ts` 的 `buildReportPages(themes)`。

分页输出：

- `pages`：正文和主题封面页面。
- `toc`：目录项，包含主题和文章。
- `totalPages`：正文页面数量，不含目录页。

分页规则：

- 每个主题开始时固定生成一张主题封面页。
- 主题封面页会加入目录，级别为 `theme`。
- 文章内容会被拆成 `ArticleSlice` 放入内容页。
- 每篇文章首次出现时包含文章头部，后续分页延续时不再重复头部。
- 只有包含文章头部的切片会加入目录，级别为 `article`。
- 当前内容页容量用权重估算，容量常量为 `CONTENT_PAGE_CAPACITY = 9.2`。

权重估算：

- 文章头部：`1.2`
- 文本：每 `58` 字约 `0.68` 权重，最少 `0.68`
- 图片：
  - 1 张：`4.6`
  - 2 张：`5.2`
  - 3 张：`6.1`
  - 4 张及以上：`7.0`

文本拆分：

- 优先按容量截断。
- 如果截断位置附近有 `。`、`！`、`？`、`；`，并且位置超过当前容量的 55%，优先按句末标点断开。
- 避免把很短的文本片段单独留到下一页。
- 避免下一段开头出现中文标点。

图片拆分：

- 根据当前页剩余容量决定最多放几张图。
- 如果当前页剩余容量少于内容页容量的 1/4，不再继续塞图，会先换到下一页。
- 如果当前页放不下图片且已经有内容，会先换页。
- 如果空白页仍需要放图，会至少强制放入一张，避免死循环。

## 目录实现

正文分页完成后，`src/App.vue` 会调用本地的 `paginateToc(toc)` 生成目录页。

目录规则：

- 每页最多 `15` 条目录项。
- 如果主题项后面紧跟文章项，但当前目录页已没有足够空间容纳两条，会提前换页，避免主题标题孤立在页尾。
- 目录页数量会作为 `tocPageOffset` 加到正文页码上，所以目录中显示的是最终打印页码。
- 目录页 footer 显示目录页自己的页码。

## 渲染实现

`src/App.vue` 渲染三类区域：

- 顶部工具栏：显示报表数量、总页数、mock 状态和打印按钮。
- 目录页：循环 `tocPages` 生成一页或多页目录。
- 正文页：循环 `pages` 生成主题封面页或内容页。

正文页通过 CSS 变量接收主题背景：

```vue
:style="{
  '--theme-bg': page.theme.background.color,
  '--theme-image': `url(${page.theme.background.image})`,
}"
```

主题封面页展示主题标题和描述。内容页展示文章头部、正文和图库。文章日期当前通过字符串拆分展示：

- 日号：`date.split('/').at(-1)`
- 年月：`date.slice(0, 7)`

## 图片布局

基础图库 class 由 `getGalleryClass(count)` 返回：

- `gallery--single`：1 张图。
- `gallery--mosaic`：2 张及以上多图。

`src/App.vue` 还会在图片加载后读取自然宽高比：

```ts
imageRatios[image.url] = target.naturalWidth / target.naturalHeight
```

当此页图库只有 1 张图，且图片是明显横图时，会使用 `gallery--single-landscape`；如果是明显竖图，则使用 `gallery--single-portrait`。单图会按宽高比计算占宽和高度，图片本体填满计算框，不会被页面剩余空间拉伸出上下留白。

当此页图库有 2、4、6 等偶数张图时，使用 `gallery--mosaic` 中的双图行模型。图片会按原始顺序每 2 张分成一行；每一行根据该行两张图片的原始宽高比反算统一行高，再用 `图片宽度 = 行高 × 图片宽高比` 计算每张图的实际宽度。整组图片会在页面可用宽度和最大高度内自动缩放并居中，因此同一行中的图片保持同高，不同图片的宽度和不同行的高度都可以不一致。

当此页图库有 3 张图时，使用 `gallery--mosaic` 中的三图模块。若包含明显横图，横图会作为上方大图，下方两张继续按双图行规则同高分宽；否则使用左一右二结构，第一张放左侧跨满右侧两张图的总高度，右侧两张上下排列并保持原始比例。

当此页图库有 5、7 等奇数多图时，使用 `3 + 2 + 2...` 的组合模型：前 3 张先走三图模块，后续图片每 2 张一组继续复用双图行规则。整组会共同缩放到页面可用高度内。

图片本身使用 `object-fit: contain`，保持完整显示，不裁切。

## 样式和打印

页面尺寸通过 CSS 变量定义：

```css
--page-width: 210mm;
--page-height: 297mm;
```

每个 `.sheet` 都是一个固定 A4 页面，并设置：

- `page-break-after: always`
- `break-after: page`
- 屏幕预览时显示阴影
- 打印时隐藏阴影

打印样式：

- `@page { size: A4 portrait; margin: 0; }`
- 隐藏 `.toolbar`
- `.report-preview` 改为普通块布局
- 开启 `print-color-adjust: exact`

因此当前导出 PDF 的主要路径是浏览器打印。

## 当前注意点

- `README.md` 仍是 Vite/Vue 模板默认说明，尚未更新为本项目文档。
- `Pinia` 已安装并注册，但当前没有业务状态依赖。
- `src/components` 下仍有模板示例组件，当前主页面未引用。
- 图片路径使用 `/images/...`，需要确保部署环境能把 `images/` 目录作为静态资源提供。
- 分页是基于权重的近似排版，不是按真实 DOM 高度测量；数据变化极端时仍需要视觉回归检查。
