# 成长档案项目生成规范

这份文档用于交接当前成长档案自动排版项目的核心规则。其他开发者或 AI 工具可以按本文档直接生成一个同类 Vue A4 打印预览项目。

## 目标

生成一个基于 Vue 3、TypeScript 和 Vite 的 A4 成长档案预览应用。应用读取主题、文章、图片数据，自动生成首页、目录页、主题封面页和内容页，并通过浏览器打印导出 PDF。

核心目标：

- A4 竖版页面预览，打印时保持无边距分页。
- 首页使用指定图片整页铺满。
- 目录按最终打印页码自动生成。
- 每个主题有主题封面。
- 内容页按文字和图片自动分页。
- 文字、图片尽量保持同一条数据完整，减少拆页。
- 内容页不做垂直居中，统一从上往下排版。

## 技术要求

- Vue 3
- TypeScript
- Vite
- CSS 使用 `mm` 作为页面尺寸和排版单位。
- 数据源为本地 `api.json`。
- 通过浏览器 `window.print()` 导出 PDF。
- 支持 URL mock 参数做分页压力测试。

常用命令：

```sh
npm install
npm run dev
npm run build
npm run preview
```

## 资源要求

项目至少需要以下资源目录：

```text
images/
font/
src/
```

推荐资源：

- `images/shouye.jpg`：首页整页背景。
- `images/mulu.jpg`：目录页背景。
- `images/bg*.jpg` 或 `images/bg*.webp`：主题和内容页背景。
- `images/*.webp`、`images/*.png`：文章图片。
- `font/YouSheHaoShenTi.ttf`：主题标题字体，优设好身体。
- `font/SourceHanSansCN-Regular.otf`：正文默认字体，思源黑体 regular。
- `font/SourceHanSansCN-Normal.otf`：思源黑体兜底 regular。
- 如有条件，补充思源黑体 bold 字体文件供文章标题使用。

## 数据模型

顶层数据是 `ReportTheme[]`。

```ts
interface ReportImage {
  id: string
  url: string
}

interface ReportArticle {
  content: {
    date: string
    title: string
    text: string
  }
  gallery: ReportImage[]
}

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

分页后的文章切片：

```ts
interface ArticleSlice {
  article: ReportArticle
  continuesText: boolean
  gallery: ReportImage[]
  includeHeader: boolean
  isTextContinuation: boolean
  text: string
}
```

字段说明：

- `includeHeader`：当前切片是否展示文章标题和日期。文章首次出现为 `true`，续页为 `false`。
- `isTextContinuation`：当前文字是否是上一页文字的续排。续排文字首行不缩进。
- `continuesText`：当前文字后面是否还有续文。当前项目保留该标记，默认仍左对齐。
- `gallery`：当前切片展示的图片数组。

## 页面顺序

最终打印顺序固定为：

1. 首页。
2. 目录页，一页或多页。
3. 主题封面页。
4. 当前主题的内容页。
5. 下一个主题封面页。
6. 下一个主题内容页。

首页：

- 使用 `images/shouye.jpg`。
- `background-size: cover`。
- 不显示页码和内容。

目录页：

- 使用 `images/mulu.jpg`。
- `background-size: cover`。
- 每页最多 `32` 条目录项。
- 主题项如果即将落在页尾且后面紧跟文章项，需要提前换页，避免主题标题孤立。
- 目录显示最终打印页码，需要加上首页数量和目录页数量作为偏移。

主题封面页：

- 每个主题固定生成一页。
- 主题标题进入目录。
- 背景优先使用 `theme.image`，否则使用 `theme.background.image`。
- 背景使用 `cover`。

内容页：

- 按主题内文章顺序生成。
- 背景优先使用 `theme.contentImages`，其次 `theme.background.contentImages`，没有则回退主题封面背景。
- 多张内容背景用稳定 hash 选择，避免每次刷新跳变。
- 背景使用 `contain`。

## A4 页面尺寸

基础页面：

```css
:root {
  --page-width: 210mm;
  --page-height: 297mm;
}

.sheet {
  width: var(--page-width);
  height: var(--page-height);
  overflow: hidden;
  page-break-after: always;
  break-after: page;
}
```

打印规则：

```css
@media print {
  @page {
    size: A4 portrait;
    margin: 0;
  }

  .toolbar {
    display: none;
  }

  .sheet {
    box-shadow: none;
    break-inside: avoid;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}
```

内容页推荐尺寸：

- 外层 `report-sheet` padding：上 `23mm`，左右 `15mm`，下 `12mm`。
- 内容卡片 padding：上下约 `9mm` 到 `10mm`，左右 `13mm`。
- 内容可用高度按 `242mm` 估算。
- 文章块之间间距约 `5mm`。

## 字体规则

全局默认字体：

- 字体：思源黑体。
- 字重：`400`。

主题标题：

- 字体：优设好身体。
- 字重：`400`。

文章标题：

- 字体：思源黑体。
- 字重：`700`。

正文、日期、目录页码、按钮和其他内容：

- 字体：思源黑体。
- 字重：`400`。

推荐 CSS：

```css
@font-face {
  font-family: '优设好身体';
  src: url('../../font/YouSheHaoShenTi.ttf') format('truetype');
  font-display: swap;
  font-style: normal;
  font-weight: 400;
}

@font-face {
  font-family: '思源黑体';
  src:
    url('../../font/SourceHanSansCN-Regular.otf') format('opentype'),
    url('../../font/SourceHanSansCN-Normal.otf') format('opentype');
  font-display: swap;
  font-style: normal;
  font-weight: 400;
}

:root {
  --font-theme-title: '优设好身体', sans-serif;
  --font-article-title: '思源黑体', 'Source Han Sans SC', sans-serif;
  --font-content: '思源黑体', 'Source Han Sans SC', sans-serif;
}

body {
  font-family: var(--font-content);
  font-weight: 400;
}
```

## 文本排版规则

正文规则：

- 全部左对齐。
- 首段首行缩进 `2em`。
- 续页文字不缩进。
- 行高约 `2.08`，算法估算为 `8.3mm`。
- 字号约 `15px`。
- 不使用两端对齐，不强制撑满最后一行。
- 中文换行使用 `line-break: strict`。

推荐 CSS：

```css
.story-text {
  margin: 0;
  font-family: var(--font-content);
  font-size: 15px;
  font-weight: 400;
  line-height: 2.08;
  text-align: left;
  text-indent: 2em;
  word-break: normal;
  overflow-wrap: break-word;
  line-break: strict;
  hanging-punctuation: none;
}

.story-text--continuation {
  text-indent: 0;
}

.story-text--continues {
  text-align-last: left;
}
```

文本容量估算：

- 正文行高：`8.3mm`。
- 新文章首行约 `33` 字。
- 续排行和普通后续行约 `35` 字。
- 文本切片最短保留 `42` 字。
- 新文章如果要放在当前页，至少要能放下 `2` 行正文。
- 如果候选断点导致最后一行填充率低于 `75%`，优先把断点向后借到当前估算行尾。
- 需要避免下一页文字以中文标点开头。
- 常见中文开头标点包括：`，。！？；：、`。

## 分页规则

分页函数输入 `ReportTheme[]`，输出：

- `pages`：主题封面页和内容页。
- `toc`：目录项。
- `totalPages`：正文和主题页面数量，不含首页和目录页。

基础常量建议：

```ts
const CONTENT_PAGE_HEIGHT_MM = 242
const STORY_HEADER_HEIGHT_MM = 9
const FLOW_GAP_MM = 5
const STORY_TEXT_LINE_HEIGHT_MM = 8.3
const MIN_TEXT_SLICE_CHARS = 42
const MIN_NEW_ARTICLE_TEXT_LINES = 2
const MIN_LAST_LINE_FILL_RATIO = 0.75
const STORY_TEXT_FIRST_LINE_CHARS = 33
const STORY_TEXT_LINE_CHARS = 35
```

核心分页约束：

- 当前页从上往下排，不做垂直居中。
- 如果当前页已经有其他内容，新文章的标题放不下，则先换页。
- 如果当前页已经有其他内容，新文章放下后不足以展示至少 `2` 行正文，则先换页。
- 如果某条数据的文字会分页，并且当前页已经有其他内容，则这条数据从新页开始。
- 如果一条数据在当前页只放下文字，图片被分到下一页，并且当前页已经有其他内容，则这条数据从新页开始。
- 单张图的数据需要尽量让文字和图片在同一页。分页时先为这张图片预留图库高度，再计算可放文字量。
- 孤行控制保留：当前页至少放 `2` 行文字，新页尽量不要只剩极短尾巴。
- 空白页仍放不下图片时，需要至少强制放入一张图，避免分页死循环。

文章切片流程：

1. 读取文章剩余文字和剩余图片。
2. 根据当前页剩余高度计算文字容量。
3. 如果文章只有一张剩余图片，先预留单图高度。
4. 调用 `splitText` 得到当前文字、剩余文字和是否续文。
5. 如果当前页已有内容且文字会继续分页，则先换页重试。
6. 根据文字切片占用高度计算剩余图片空间。
7. 尝试放入当前页能容纳的图片。
8. 如果出现“当前页只有文字，图片到下一页”的情况，则先换页重试。
9. 生成 `ArticleSlice`。
10. 重复直到当前文章文字和图片都处理完。

## 图片排版规则

图片按实际宽高比排版。建议先维护一份已知图片宽高比表，运行时通过图片 `load` 事件读取自然尺寸并更新比例。

基础常量建议：

```ts
const GALLERY_GAP_MM = 4
const GALLERY_CONTENT_WIDTH_MM = 154
const SINGLE_IMAGE_HEIGHT_MM = 112
const PAIR_IMAGE_HEIGHT_MM = 106
const MULTI_IMAGE_HEIGHT_MM = 176
const MAX_IMAGES_PER_SLICE = 6
const LANDSCAPE_IMAGE_RATIO = 1.15
const PORTRAIT_SINGLE_IMAGE_MAX_WIDTH_RATIO = 0.5
```

单图：

- 默认高度约 `112mm`。
- 横图可使用内容区完整宽度。
- 竖图在一页展示时，宽度不超过内容区 `50%`。
- 单图使用 `object-fit: contain`。
- 图片居中显示，但所在内容块仍从页面顶部开始。

多图：

- 2 张图使用一行 pair mosaic。
- 3 张及以上如果数量为奇数，前 3 张组成三图模块，其余按两张一组。
- 三图中如果存在横图，使用横图在上、两张图在下的结构。
- 三图中如果没有横图，使用左侧大图、右侧上下两图的结构。
- 多图总高度不得超过多图最大高度，超出时通过二分缩小图库宽度。
- 一页最多优先放 `6` 张图片，剩余图片进入后续页。

纯图片续页：

- 当某页只有一个切片，且没有标题、没有文字、只有图片时，视为满页图库页。
- 满页图库可使用更大宽度和高度。
- 满页图库仍然顶部对齐，不做垂直居中。

推荐 CSS：

```css
.gallery {
  display: grid;
  gap: var(--flow-gap);
  width: 100%;
}

.gallery figure {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  overflow: visible;
  background: none;
  box-shadow: none;
}

.gallery img {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  object-position: center;
}

.gallery--single-landscape,
.gallery--single-portrait {
  align-self: center;
  width: var(--ratio-gallery-width, 100%);
  height: var(--ratio-gallery-height, 112mm);
}

.gallery--mosaic {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  align-self: center;
  width: var(--mosaic-gallery-width, 100%);
  height: var(--mosaic-gallery-height, 114mm);
}
```

## 内容页对齐规则

内容页必须顶部排版：

```css
.content-card {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: flex-start;
  gap: 5mm;
  min-height: 0;
}

.story-block--page-gallery {
  justify-content: flex-start;
}
```

不要在内容页使用以下规则：

```css
justify-content: center;
justify-content: safe center;
```

特别注意：

- 普通内容页不能垂直居中。
- 单条数据页不能垂直居中。
- 纯图片续页也不能垂直居中。

## 工具栏规则

预览页只保留打印按钮：

- 固定悬浮在页面右侧。
- 不展示主题数量、总页数、mock 数据等额外信息。
- 打印时隐藏。

示例：

```vue
<section class="toolbar">
  <button type="button" @click="printReport">打印 / 导出 PDF</button>
</section>
```

```css
.toolbar {
  position: fixed;
  top: 5%;
  right: 24px;
  z-index: 10;
  transform: translateY(-50%);
}
```

## Mock 数据规则

URL 参数：

- `mock`：mock 文章总数，默认 `20`，最大 `120`。
- `themes`：mock 主题数量，默认 `3`，最大 `12`。

示例：

```text
http://127.0.0.1:5173/?mock=40&themes=5
```

mock 主题标题：

- 必须限制在 `5` 个字以内。
- 推荐格式：`主题01`、`主题02`。

mock 应覆盖：

- 长中文正文。
- 带标点正文。
- 短尾巴正文。
- 单图。
- 单张竖图。
- 2 图。
- 3 图。
- 4 到 6 图。
- 超过 6 图的图片续页。
- 纯图片续页。

## 建议文件结构

```text
src/
  App.vue
  main.ts
  components/
    report/
      ReportPreview.vue
      PrintToolbar.vue
      FrontCoverSheet.vue
      TocSheet.vue
      ReportPageSheet.vue
      ThemeCover.vue
      ContentPage.vue
      StoryBlock.vue
      GalleryView.vue
  assets/
    base.css
    main.css
  types/
    report.ts
  utils/
    pagination.ts
    mockReport.ts
api.json
images/
font/
README.md
```

核心职责：

- `src/App.vue`：应用入口，只挂载 `ReportPreview`，不要放业务功能和排版逻辑。
- `src/components/report/ReportPreview.vue`：读取数据、处理 mock 参数、调用分页、生成目录分页、触发打印。
- `src/components/report/TocSheet.vue`：渲染目录页和最终页码。
- `src/components/report/ReportPageSheet.vue`：渲染主题封面页或内容页，并注入页面背景变量。
- `src/components/report/ContentPage.vue`：渲染内容页容器，判断纯图片满页场景。
- `src/components/report/StoryBlock.vue`：渲染单条文章切片、标题、日期、正文和图库入口。
- `src/components/report/GalleryView.vue`：读取图片真实比例，计算单图、竖图、多图和满页图库尺寸。
- `src/types/report.ts`：定义主题、文章、图片、页面和切片类型。
- `src/utils/pagination.ts`：实现分页、文本拆分、图片容量估算、目录项生成、背景选择。
- `src/utils/mockReport.ts`：生成 mock 主题、文章、正文和图片。
- `src/assets/main.css`：页面尺寸、字体、首页、目录、主题封面、内容页、图库和打印样式。

## 验收清单

真实数据：

- 打开默认地址，确认首页、目录、主题封面、内容页顺序正确。
- 目录页码应等于最终打印页码。
- 普通文章结尾最后一行自然左对齐，不被强制撑满。
- 内容页整体从上往下排版，不垂直居中。
- 单张竖图在一页时宽度不超过内容区 `50%`。

Mock 数据：

- 打开 `?mock=40&themes=5`。
- mock 主题标题不超过 `5` 个字。
- 长文字分页时，如果会拆文字且当前页已有内容，该条数据应从新页开始。
- 如果当前页只放文字、图片被挤到下一页，该条数据应从新页开始。
- 单张图的数据中文字和图片应尽量在同一页。
- 纯图片续页顶部对齐。
- 多图布局不变形、不溢出页面。

构建检查：

```sh
npm run build
```

浏览器检查：

- 桌面宽度下预览页面无横向裁切。
- 打印预览为 A4 竖版。
- 打印时工具栏隐藏。
- 背景图和文章图片正常加载。

## 可直接复用的生成提示

可以把下面这段提示交给其他开发者或 AI 工具生成同类项目：

```text
请生成一个 Vue 3 + TypeScript + Vite 的 A4 成长档案自动排版项目。

项目读取本地 api.json，数据结构为 ReportTheme[]。每个主题包含主题背景、内容页背景、主题标题、副标题、描述和文章列表。每篇文章包含日期、标题、正文和图片列表。

页面顺序为：首页、目录页、主题封面页、主题内容页。首页使用 images/shouye.jpg 整页 cover。目录页使用 images/mulu.jpg 整页 cover，每页最多 32 条目录，目录页码要加上首页和目录页数量，显示最终打印页码。每个主题固定生成一张主题封面页。内容页背景优先使用 contentImages，其次 background.contentImages，最后回退主题背景。

使用 A4 竖版，页面尺寸 210mm x 297mm，打印 @page margin 为 0。内容页从上往下排版，不允许垂直居中。工具栏只保留一个右侧悬浮的“打印 / 导出 PDF”按钮，打印时隐藏。

字体规则：全局默认思源黑体 font-weight 400。主题标题用优设好身体。文章标题用思源黑体 font-weight 700。正文、日期、目录和其他内容用思源黑体 font-weight 400。

正文全部左对齐，首段首行缩进 2em，续页文字不缩进，字号约 15px，行高约 2.08，不使用两端对齐，不强制撑满最后一行。

分页算法需要用 mm 高度估算。内容可用高度约 242mm，文章标题高度约 9mm，文章块间距约 5mm，正文行高约 8.3mm。新文章首行按 33 字估算，后续行按 35 字估算，最短文本切片 42 字，新文章在当前页至少要能放 2 行正文。如果文字会分页且当前页已有内容，则这条数据重新从新页开始。如果一条数据在当前页只放下文字、图片被分到下一页，则这条数据重新从新页开始。单张图的数据要尽量让文字和图片同页，计算文字容量前先预留单图高度。避免下一页文字以中文标点开头。

图片按实际宽高比排版。单图默认高度约 112mm。单张竖图在一页展示时宽度不超过内容区 50%。2 图使用一行 mosaic。3 图及以上按三图模块加双图模块排版，有横图时横图在上，无横图时左大右二。多图最大高度约 176mm，超出时缩小图库宽度。一页最多优先放 6 张图。纯图片续页可以使用更大的图库高度，但仍然顶部对齐。

支持 ?mock=40&themes=5 生成 mock 数据。mock 主题标题必须控制在 5 个字以内，并覆盖长中文、标点、短尾巴、单图、竖图、多图和纯图片续页场景。

请提供 src/App.vue、src/components/report/*、src/types/report.ts、src/utils/pagination.ts、src/utils/mockReport.ts、src/assets/main.css、README.md，并确保 npm run build 通过。App.vue 只能作为入口挂载组件，不要承载业务功能和排版逻辑。
```
