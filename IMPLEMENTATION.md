# 当前实现说明

本文档记录当前仓库中已经实现的 A4 成长记录册预览功能，便于后续开发、联调和交接。

## 功能概览

当前项目是一个基于 Vue 3、TypeScript 和 Vite 的单页预览应用。页面读取报表主题、文章和图片数据，生成目录页、主题封面页和内容页，并按 A4 尺寸渲染为可打印页面。用户可以通过浏览器打印功能导出 PDF。

主要能力：

- 从 `api.json` 读取真实报表数据。
- 支持通过 URL 参数生成大量 mock 数据，用于压力测试分页和排版。
- 自动生成目录，并显示主题和文章所在的最终打印页码。
- 每个主题固定生成一张主题封面页。
- 主题封面页展示标题、副标题和说明文字。
- 内容页会按文章文本、图片数量和剩余容量自动分页。
- 长文本会按估算行宽和自然标点拆分到后续页面。
- 图片会根据数量和实际宽高比选择单图、多图、三图和满页图库布局。
- 主题页、内容页和目录页分别使用不同背景规则。
- 提供打印样式，隐藏工具栏并按 A4 无边距页面输出。

## 技术栈

- Vue 3：页面渲染。
- TypeScript：类型定义、分页和图库计算。
- Vite：开发服务器和构建工具。
- Pinia：已在入口注册，但当前报表预览流程未使用 store。
- vite-plugin-vue-devtools：开发环境 Vue DevTools 插件。

常用命令：

```sh
npm run dev
npm run build
npm run preview
```

`package.json` 要求 Node.js `^20.19.0 || >=22.12.0`。当前仓库没有提交包管理器锁文件，后续应统一团队使用的包管理器并提交对应锁文件。

## 入口和文件结构

核心文件：

- `src/main.ts`：创建 Vue 应用，注册 Pinia，挂载 `App.vue`。
- `src/App.vue`：报表预览主组件，负责读取数据、处理 URL 参数、生成目录分页、渲染页面、计算图库尺寸和触发打印。
- `src/types/report.ts`：报表相关 TypeScript 类型。
- `src/utils/pagination.ts`：报表正文分页、文章切片、目录项生成、主题/内容背景图选择和基础图库分类。
- `src/utils/mockReport.ts`：基于真实数据扩展 mock 主题、文章、文本和图片。
- `src/assets/main.css`：A4 页面、目录、主题封面、内容卡片、图片图库和打印样式。
- `api.json`：当前真实报表数据源。
- `images/`：目录背景、主题背景、内容页背景和文章图片资源。

模板工程遗留文件仍存在：

- `src/components/*`
- `src/stores/counter.ts`
- `src/assets/base.css` 中的部分 Vue 模板默认变量

这些文件目前不参与成长记录册主流程。

## 数据结构

报表数据定义在 `src/types/report.ts`。顶层数据是 `ReportTheme[]`：

```ts
interface ReportTheme {
  theme: string
  image?: string
  contentImages?: string[]
  background: {
    image: string
    contentImages?: string[]
    color: string
  }
  header: {
    title: string
    subtitle?: string
    description: string
  }
  pages: ReportArticle[]
}
```

每个主题包含：

- `theme`：主题标识，用于生成稳定背景索引。
- `image`：可选主题封面背景图，优先级高于 `background.image`。
- `contentImages`：可选内容页背景图列表，优先级高于 `background.contentImages`。
- `background.image`：主题封面默认背景图。
- `background.contentImages`：内容页背景图列表。
- `background.color`：页面背景底色。
- `header.title`：主题标题。
- `header.subtitle`：可选主题副标题。
- `header.description`：主题封面说明文字。
- `pages`：主题下的文章列表。

每篇文章包含：

- `content.date`：日期，当前渲染为 `YYYY.MM.DD`。
- `content.title`：文章标题。
- `content.text`：正文。
- `gallery`：图片列表，每张图片包含 `id` 和 `url`。

分页后会生成 `ReportPage[]`，每页包含主题信息、主题内页码、全局页码、当前页背景图、是否主题封面页，以及当前页承载的文章切片。

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

mock 数据会复用 `api.json` 中的主题背景、副标题和基础文章，并扩展标题、日期、正文长度和图片数量。图片数量使用 `[1, 2, 3, 4, 5, 7, 9, 12]` 模式，文本长度使用 `[1, 2, 3, 5, 7]` 模式，用于覆盖不同排版场景。

## 分页实现

分页逻辑集中在 `src/utils/pagination.ts` 的 `buildReportPages(themes)`。

分页输出：

- `pages`：主题封面页和正文内容页。
- `toc`：目录项，包含主题和文章。
- `totalPages`：正文页面数量，不含目录页。

分页规则：

- 每个主题开始时固定生成一张主题封面页。
- 主题封面页会加入目录，级别为 `theme`。
- 文章内容会被拆成 `ArticleSlice` 放入内容页。
- 每篇文章首次出现时包含文章头部，后续分页延续时不再重复头部。
- 只有包含文章头部的切片会加入目录，级别为 `article`。
- 当前内容页容量用权重估算，容量常量为 `CONTENT_PAGE_CAPACITY = 10.4`。

权重估算：

- 文章头部：`1.2`
- 文本：每 `76` 字约 `0.68` 权重，最少 `0.68`
- 图片：
  - 1 张：`4.4`
  - 2 张：`5.2`
  - 3 张：`6.1`
  - 4 张：`7.0`
  - 5 张及以上：`8.0`

文本拆分：

- 先根据当前剩余权重估算可容纳字符数。
- 首行按 `39` 字估算，后续行按 `41` 字估算。
- 优先把断点对齐到估算行尾。
- 如果断点到行尾之间存在 `。`、`！`、`？`、`；`、`，`、`、`、`：`，且位置超过当前行长度的 `90%`，优先按自然标点断开。
- 避免把小于 `42` 字的短文本片段单独留到下一页。
- 避免下一段开头出现中文标点。

图片拆分：

- 根据当前页剩余容量决定最多放几张图。
- 剩余容量对应图片容量：`8.0 -> 6`、`7.0 -> 4`、`6.1 -> 3`、`5.2 -> 2`、`4.4 -> 1`。
- 如果当前页剩余容量少于内容页容量的 `1/4`，不再继续塞图，会先换到下一页。
- 如果当前页放不下图片且已经有内容，会先换页。
- 如果空白页仍需要放图，会至少强制放入一张，避免死循环。

## 背景图规则

主题封面页背景：

- 优先使用主题顶层 `image`。
- 否则使用 `background.image`。
- CSS 使用 `background-size: cover`。

内容页背景：

- 优先使用主题顶层 `contentImages`。
- 否则使用 `background.contentImages`。
- 如果没有内容页背景列表，则回退到主题封面背景。
- 多张内容页背景通过 `theme`、主题索引、主题内页码和全局页码生成稳定 hash 选择。
- CSS 使用 `background-size: contain`。

目录页背景：

- 固定使用 `images/mulu.jpg`。
- 目录标题文字由背景图自带，模板中的 `Contents` 和 `目录` 会被 CSS 隐藏。
- 目录项直接排在背景图自带的白色内容区内。

## 目录实现

正文分页完成后，`src/App.vue` 会调用本地的 `paginateToc(toc)` 生成目录页。

目录规则：

- 每页最多 `20` 条目录项。
- 如果主题项后面紧跟文章项，但当前目录页已没有足够空间容纳两条，会提前换页，避免主题标题孤立在页尾。
- 目录页数量会作为 `tocPageOffset` 加到正文页码上，所以目录中显示的是最终打印页码。
- 目录页 footer 只显示目录页自己的页码。

## 渲染实现

`src/App.vue` 渲染三类区域：

- 顶部工具栏：显示主题数量、总页数、mock 状态和打印按钮。
- 目录页：循环 `tocPages` 生成一页或多页目录。
- 正文页：循环 `pages` 生成主题封面页或内容页。

正文页通过 CSS 变量接收背景：

```vue
:style="{
  '--theme-bg': page.theme.background.color,
  '--theme-image': `url(${page.backgroundImage})`,
}"
```

主题封面页展示主题标题、副标题和描述。内容页展示文章头部、正文和图库。文章日期通过 `formatStoryDate(date)` 渲染为 `YYYY.MM.DD`，如果日期格式不完整则把 `/` 替换为 `.`。

## 图片布局

基础图库 class 由 `getGalleryClass(count)` 返回：

- `gallery--single`：1 张图。
- `gallery--mosaic`：2 张及以上多图。

`src/App.vue` 会在图片加载后读取自然宽高比：

```ts
imageRatios[image.url] = target.naturalWidth / target.naturalHeight
```

单图：

- 宽高比大于 `1.15` 视为横图，使用 `gallery--single-landscape`。
- 宽高比小于 `1 / 1.15` 视为竖图，使用 `gallery--single-portrait`。
- 普通内容页单图首选高度为 `112mm`。
- 满页图库单图最大高度为 `248mm`。
- 图片保持完整显示，不裁切。

多图：

- 2、4、6 等偶数张图使用双图行模型。
- 同一行根据图片宽高比计算统一行高，再计算各图片宽度。
- 3 张图使用三图模块；如果有明显横图，横图作为上方大图，否则使用左一右二结构。
- 5、7 等奇数多图使用 `3 + 2 + 2...` 组合模型。
- 普通多图最大高度为 `176mm`，2 张图首选最大高度为 `106mm`。
- 图片延续页且只有图库内容时，会使用满页图库模式，最大高度为 `248mm`、内容宽度为 `168mm`。
- 普通图库内容宽度为 `154mm`，图片间距为 `4mm`。

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

- `Pinia` 已安装并注册，但当前没有业务状态依赖。
- `src/components` 下仍有模板示例组件，当前主页面未引用。
- 图片路径使用 `/images/...`，需要确保部署环境能把仓库根目录下的 `images/` 作为静态资源提供；Vite 开发服务器当前可以直接访问这些资源。
- 分页是基于权重的近似排版，不是按真实 DOM 高度测量；数据变化极端时仍需要视觉回归检查。
- 当前没有提交包管理器锁文件，依赖安装结果可能随时间变化。
