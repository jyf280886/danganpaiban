<script setup lang="ts">
import reportData from '../api.json'
import { reactive } from 'vue'
import type { ArticleSlice, ReportImage, ReportPage, ReportTheme } from '@/types/report'
import { createMockReportData } from '@/utils/mockReport'
import { buildReportPages, getGalleryClass } from '@/utils/pagination'

const DEFAULT_MOCK_COUNT = 20
const DEFAULT_MOCK_THEME_COUNT = 3
const MAX_MOCK_COUNT = 120
const MAX_MOCK_THEME_COUNT = 12
const TOC_ITEMS_PER_PAGE = 15
const LANDSCAPE_IMAGE_RATIO = 1.15
const PORTRAIT_IMAGE_RATIO = 1 / LANDSCAPE_IMAGE_RATIO
const SINGLE_IMAGE_ROW_HEIGHT_MM = 112
const PAIR_IMAGE_ROW_HEIGHT_MM = 106
const MULTI_IMAGE_MAX_HEIGHT_MM = 176
const PAGE_FILL_GALLERY_MAX_HEIGHT_MM = 248
const GALLERY_CONTENT_WIDTH_MM = 154
const PAGE_FILL_GALLERY_CONTENT_WIDTH_MM = 168
const FLOW_GAP_MM = 4

interface MosaicItem {
  image: ReportImage
  sourceIndex: number
  width: number
  height: number
}

interface MosaicModule {
  kind: 'pair' | 'triple-top' | 'triple-left'
  width: number
  height: number
  rows: MosaicItem[][]
  leftItem?: MosaicItem
  rightItems?: MosaicItem[]
}

const searchParams = new URLSearchParams(globalThis.location.search)
const useMockData = searchParams.has('mock')
const mockCount = readPositiveIntegerParam('mock', DEFAULT_MOCK_COUNT, MAX_MOCK_COUNT)
const mockThemeCount = readPositiveIntegerParam('themes', DEFAULT_MOCK_THEME_COUNT, MAX_MOCK_THEME_COUNT)
const themes = useMockData
  ? createMockReportData(reportData as ReportTheme[], mockCount, mockThemeCount)
  : (reportData as ReportTheme[])
const { pages, toc, totalPages } = buildReportPages(themes)
const tocPages = paginateToc(toc)
const tocPageOffset = tocPages.length

function readPositiveIntegerParam(name: string, fallback: number, max: number) {
  const rawValue = searchParams.get(name)
  const parsedValue = rawValue === null || rawValue === '' ? fallback : Number(rawValue)

  if (!Number.isFinite(parsedValue)) return fallback

  return Math.min(Math.max(1, Math.trunc(parsedValue)), max)
}

function paginateToc(items: typeof toc) {
  const pages: typeof toc[] = []
  let currentPage: typeof toc = []

  items.forEach((item, index) => {
    const nextItem = items[index + 1]
    const wouldOverflow = currentPage.length >= TOC_ITEMS_PER_PAGE
    const wouldOrphanTheme =
      item.level === 'theme' &&
      currentPage.length > 0 &&
      nextItem?.level === 'article' &&
      currentPage.length + 2 > TOC_ITEMS_PER_PAGE

    if (currentPage.length > 0 && (wouldOverflow || wouldOrphanTheme)) {
      pages.push(currentPage)
      currentPage = []
    }

    currentPage.push(item)
  })

  if (currentPage.length > 0) pages.push(currentPage)

  return pages.length > 0 ? pages : [[]]
}

function printReport() {
  globalThis.print()
}

function readRatio(event: Event, image: ReportImage) {
  const target = event.target as HTMLImageElement
  if (target.naturalWidth <= 0 || target.naturalHeight <= 0) return

  imageRatios[image.url] = target.naturalWidth / target.naturalHeight
}

function imageRatio(image: ReportImage) {
  return imageRatios[image.url] ?? 1
}

function isLandscapeImage(image: ReportImage) {
  return imageRatio(image) > LANDSCAPE_IMAGE_RATIO
}

function isPortraitImage(image: ReportImage) {
  return imageRatio(image) < PORTRAIT_IMAGE_RATIO
}

function singleImageClass(images: ReportImage[]) {
  const [image] = images
  if (images.length !== 1 || image === undefined) return ''
  if (isLandscapeImage(image)) return 'gallery--single-landscape'
  if (isPortraitImage(image)) return 'gallery--single-portrait'
  return ''
}

function isMosaicGallery(images: ReportImage[]) {
  return images.length > 1
}

function formatTrackRatio(ratio: number) {
  return Number(ratio.toFixed(3))
}

function gapWidthMm(ratios: number[]) {
  return Math.max(0, ratios.length - 1) * FLOW_GAP_MM
}

function ratioTotal(ratios: number[]) {
  return ratios.reduce((total, ratio) => total + ratio, 0)
}

function fitRatioRow(ratios: number[], preferredRowHeight: number, contentWidth = GALLERY_CONTENT_WIDTH_MM) {
  const totalRatio = ratioTotal(ratios)
  const gapWidth = gapWidthMm(ratios)
  const preferredWidth = totalRatio * preferredRowHeight + gapWidth
  const rowHeight =
    preferredWidth > contentWidth
      ? Math.max(1, (contentWidth - gapWidth) / totalRatio)
      : preferredRowHeight
  const width = totalRatio * rowHeight + gapWidth

  return {
    columns: ratios.map((ratio) => ratio * rowHeight),
    height: rowHeight,
    width,
  }
}

function pairMosaicModule(images: ReportImage[], sourceIndexes: number[], width: number): MosaicModule {
  const ratios = images.map((image) => imageRatio(image))
  const height = Math.max(1, (width - gapWidthMm(ratios)) / ratioTotal(ratios))

  return {
    kind: 'pair',
    width,
    height,
    rows: [
      images.map((image, index) => ({
        image,
        sourceIndex: sourceIndexes[index] ?? index,
        width: (ratios[index] ?? 1) * height,
        height,
      })),
    ],
  }
}

function tripleHeroIndex(images: ReportImage[]) {
  const landscapeIndex = images.findIndex(isLandscapeImage)
  return landscapeIndex >= 0 ? landscapeIndex : 0
}

function tripleTopMosaicModule(images: ReportImage[], sourceIndexes: number[], width: number): MosaicModule {
  const heroIndex = tripleHeroIndex(images)
  const heroImage = images[heroIndex] ?? images[0]
  if (!heroImage) return pairMosaicModule(images, sourceIndexes, width)

  const heroSourceIndex = sourceIndexes[heroIndex] ?? heroIndex
  const bottom = images
    .map((image, index) => ({ image, sourceIndex: sourceIndexes[index] ?? index }))
    .filter((_item, index) => index !== heroIndex)
  const heroHeight = width / imageRatio(heroImage)
  const bottomModule = pairMosaicModule(
    bottom.map((item) => item.image),
    bottom.map((item) => item.sourceIndex),
    width,
  )

  return {
    kind: 'triple-top',
    width,
    height: heroHeight + FLOW_GAP_MM + bottomModule.height,
    rows: [
      [
        {
          image: heroImage,
          sourceIndex: heroSourceIndex,
          width,
          height: heroHeight,
        },
      ],
      bottomModule.rows[0] ?? [],
    ],
  }
}

function tripleLeftMosaicModule(images: ReportImage[], sourceIndexes: number[], width: number): MosaicModule {
  const [leftImage, firstRightImage, secondRightImage] = images
  if (!leftImage || !firstRightImage || !secondRightImage) {
    return pairMosaicModule(images, sourceIndexes, width)
  }

  const leftRatio = imageRatio(leftImage)
  const rightRatios = [imageRatio(firstRightImage), imageRatio(secondRightImage)]
  const rightWidth =
    (width - FLOW_GAP_MM * (leftRatio + 1)) /
    (1 + leftRatio * rightRatios.reduce((total, ratio) => total + 1 / ratio, 0))
  const safeRightWidth = Math.max(1, rightWidth)
  const rightHeights = rightRatios.map((ratio) => safeRightWidth / ratio)
  const height = rightHeights.reduce((total, itemHeight) => total + itemHeight, 0) + FLOW_GAP_MM
  const leftWidth = leftRatio * height
  const rightItems = [firstRightImage, secondRightImage].map((image, index) => ({
    image,
    sourceIndex: sourceIndexes[index + 1] ?? index + 1,
    width: safeRightWidth,
    height: rightHeights[index] ?? 1,
  }))

  return {
    kind: 'triple-left',
    width: leftWidth + FLOW_GAP_MM + safeRightWidth,
    height,
    rows: [],
    leftItem: {
      image: leftImage,
      sourceIndex: sourceIndexes[0] ?? 0,
      width: leftWidth,
      height,
    },
    rightItems,
  }
}

function tripleMosaicModule(images: ReportImage[], sourceIndexes: number[], width: number) {
  if (images.some(isLandscapeImage)) return tripleTopMosaicModule(images, sourceIndexes, width)

  return tripleLeftMosaicModule(images, sourceIndexes, width)
}

function mosaicModulesForWidth(images: ReportImage[], width: number) {
  const modules: MosaicModule[] = []

  if (images.length % 2 === 1 && images.length >= 3) {
    modules.push(tripleMosaicModule(images.slice(0, 3), [0, 1, 2], width))

    for (let index = 3; index < images.length; index += 2) {
      modules.push(pairMosaicModule(images.slice(index, index + 2), [index, index + 1], width))
    }

    return modules
  }

  for (let index = 0; index < images.length; index += 2) {
    modules.push(pairMosaicModule(images.slice(index, index + 2), [index, index + 1], width))
  }

  return modules
}

function mosaicHeight(modules: MosaicModule[]) {
  return modules.reduce((total, module) => total + module.height, 0) + Math.max(0, modules.length - 1) * FLOW_GAP_MM
}

function isPageFillingGallery(page: ReportPage, slice: ArticleSlice) {
  return page.articles.length === 1 && !slice.includeHeader && !slice.text && slice.gallery.length > 0
}

function isPageFillingGalleryPage(page: ReportPage) {
  const [slice] = page.articles

  return slice !== undefined && isPageFillingGallery(page, slice)
}

function mosaicMaxHeight(images: ReportImage[], shouldFillPage = false) {
  if (shouldFillPage) return PAGE_FILL_GALLERY_MAX_HEIGHT_MM
  return images.length === 2 ? PAIR_IMAGE_ROW_HEIGHT_MM : MULTI_IMAGE_MAX_HEIGHT_MM
}

function mosaicMetrics(images: ReportImage[], shouldFillPage = false) {
  const maxHeight = mosaicMaxHeight(images, shouldFillPage)
  const contentWidth = shouldFillPage ? PAGE_FILL_GALLERY_CONTENT_WIDTH_MM : GALLERY_CONTENT_WIDTH_MM
  const fullWidthModules = mosaicModulesForWidth(images, contentWidth)

  if (mosaicHeight(fullWidthModules) <= maxHeight) {
    return {
      height: mosaicHeight(fullWidthModules),
      modules: fullWidthModules,
      width: contentWidth,
    }
  }

  let low = 1
  let high = contentWidth

  for (let index = 0; index < 24; index += 1) {
    const width = (low + high) / 2
    const modules = mosaicModulesForWidth(images, width)

    if (mosaicHeight(modules) <= maxHeight) {
      low = width
    } else {
      high = width
    }
  }

  const modules = mosaicModulesForWidth(images, low)

  return {
    height: mosaicHeight(modules),
    modules,
    width: low,
  }
}

function galleryClass(images: ReportImage[]) {
  const singleClass = singleImageClass(images)
  if (singleClass) return singleClass
  if (isMosaicGallery(images)) return 'gallery--mosaic'

  return getGalleryClass(images.length)
}

function imageRatiosForStyle(images: ReportImage[]) {
  return images.map((image) => imageRatio(image))
}

function galleryStyle(images: ReportImage[], shouldFillPage = false) {
  const singleClass = singleImageClass(images)
  if (singleClass) {
    const ratios = imageRatiosForStyle(images)
    const metrics = fitRatioRow(
      ratios,
      shouldFillPage ? PAGE_FILL_GALLERY_MAX_HEIGHT_MM : SINGLE_IMAGE_ROW_HEIGHT_MM,
      shouldFillPage ? PAGE_FILL_GALLERY_CONTENT_WIDTH_MM : GALLERY_CONTENT_WIDTH_MM,
    )

    return {
      '--ratio-gallery-height': `${formatTrackRatio(metrics.height)}mm`,
      '--ratio-gallery-width': `${formatTrackRatio(metrics.width)}mm`,
    }
  }

  if (isMosaicGallery(images)) {
    const metrics = mosaicMetrics(images, shouldFillPage)

    return {
      '--mosaic-gallery-height': `${formatTrackRatio(metrics.height)}mm`,
      '--mosaic-gallery-width': `${formatTrackRatio(metrics.width)}mm`,
    }
  }

  return {}
}

function mosaicModules(images: ReportImage[], shouldFillPage = false) {
  return mosaicMetrics(images, shouldFillPage).modules
}

function moduleStyle(module: MosaicModule) {
  return {
    '--mosaic-module-height': `${formatTrackRatio(module.height)}mm`,
    '--mosaic-module-width': `${formatTrackRatio(module.width)}mm`,
  }
}

function rowStyle(row: MosaicItem[]) {
  return {
    '--mosaic-row-height': `${formatTrackRatio(Math.max(...row.map((item) => item.height)))}mm`,
  }
}

function imageStyle(image: ReportImage) {
  return {
    '--image-ratio': imageRatio(image),
  }
}

function mosaicItemStyle(item: MosaicItem) {
  return {
    '--mosaic-item-height': `${formatTrackRatio(item.height)}mm`,
    '--mosaic-item-width': `${formatTrackRatio(item.width)}mm`,
  }
}

const imageRatios = reactive<Record<string, number>>({})
</script>

<template>
  <main class="report-preview">
    <section class="toolbar">
      <div>
        <p class="eyebrow">A4 Report Preview</p>
        <h1>成长记录册预览</h1>
        <p>
          共 {{ themes.length }} 个主题，{{ totalPages + tocPageOffset }} 页。点击浏览器打印可导出 PDF。
          <span v-if="useMockData">当前为 {{ mockCount }} 条 mock 数据，{{ mockThemeCount }} 个 mock 主题。</span>
        </p>
      </div>
      <button type="button" @click="printReport">打印 / 导出 PDF</button>
    </section>

    <section v-for="(tocPage, tocPageIndex) in tocPages" :key="`toc-${tocPageIndex}`" class="sheet toc-sheet">
      <div class="toc-card">
        <p class="eyebrow">Contents</p>
        <h2>目录<span v-if="tocPages.length > 1"> {{ tocPageIndex + 1 }}</span></h2>
        <ul>
          <li
            v-for="item in tocPage"
            :key="`${tocPageIndex}-${item.level}-${item.title}-${item.pageNumber}`"
            :class="`toc-${item.level}`"
          >
            <span>{{ item.title }}</span>
            <i />
            <b>{{ item.pageNumber + tocPageOffset }}</b>
          </li>
        </ul>
      </div>
      <footer class="page-footer">
        <span>目录</span>
        <b>{{ tocPageIndex + 1 }}</b>
      </footer>
    </section>

    <section
      v-for="page in pages"
      :key="page.id"
      class="sheet report-sheet"
      :style="{
        '--theme-bg': page.theme.background.color,
        '--theme-image': `url(${page.theme.background.image})`,
      }"
    >
      <div v-if="page.isThemeStart" class="theme-cover">
        <div class="quote-mark">“</div>
        <div>
          <h2>{{ page.theme.header.title }}</h2>
          <p>{{ page.theme.header.description }}</p>
        </div>
      </div>

      <div
        v-else
        class="content-card content-card--compact"
        :class="{
          'content-card--single': page.articles.length === 1,
          'content-card--page-gallery': isPageFillingGalleryPage(page),
        }"
      >
        <article
          v-for="(slice, index) in page.articles"
          :key="`${page.id}-${slice.article.content.title}-${index}`"
          class="story-block"
          :class="{
            'story-block--with-header': slice.includeHeader,
            'story-block--with-gallery': slice.gallery.length > 0,
            'story-block--gallery-only': !slice.includeHeader && !slice.text && slice.gallery.length > 0,
            'story-block--page-gallery': isPageFillingGallery(page, slice),
          }"
        >
          <header v-if="slice.includeHeader" class="story-header">
            <time>
              <strong>{{ slice.article.content.date.split('/').at(-1) }}</strong>
              <span>{{ slice.article.content.date.slice(0, 7) }}</span>
            </time>
            <div>
              <h3>{{ slice.article.content.title }}</h3>
              <p class="meta">👶 老师记　　💛 亲子活动</p>
            </div>
          </header>

          <p v-if="slice.text" class="story-text" :class="{ 'story-text--continuation': slice.isTextContinuation }">{{ slice.text }}</p>

          <div
            v-if="slice.gallery.length"
            class="gallery"
            :class="galleryClass(slice.gallery)"
            :style="galleryStyle(slice.gallery, isPageFillingGallery(page, slice))"
          >
            <template v-if="isMosaicGallery(slice.gallery)">
              <div
                v-for="(module, moduleIndex) in mosaicModules(slice.gallery, isPageFillingGallery(page, slice))"
                :key="`${slice.article.content.title}-module-${moduleIndex}`"
                class="gallery-module"
                :class="`gallery-module--${module.kind}`"
                :style="moduleStyle(module)"
              >
                <template v-if="module.kind === 'triple-left' && module.leftItem">
                  <figure :style="mosaicItemStyle(module.leftItem)">
                    <img
                      :src="module.leftItem.image.url"
                      :alt="slice.article.content.title"
                      @load="readRatio($event, module.leftItem.image)"
                    />
                  </figure>
                  <div class="gallery-module-column">
                    <figure
                      v-for="item in module.rightItems"
                      :key="`${item.image.id}-${item.sourceIndex}`"
                      :style="mosaicItemStyle(item)"
                    >
                      <img :src="item.image.url" :alt="slice.article.content.title" @load="readRatio($event, item.image)" />
                    </figure>
                  </div>
                </template>

                <template v-else>
                  <div
                    v-for="(row, rowIndex) in module.rows"
                    :key="`${slice.article.content.title}-module-${moduleIndex}-row-${rowIndex}`"
                    class="gallery-module-row"
                    :style="rowStyle(row)"
                  >
                    <figure
                      v-for="item in row"
                      :key="`${item.image.id}-${item.sourceIndex}`"
                      :style="mosaicItemStyle(item)"
                    >
                      <img :src="item.image.url" :alt="slice.article.content.title" @load="readRatio($event, item.image)" />
                    </figure>
                  </div>
                </template>
              </div>
            </template>

            <figure v-else v-for="image in slice.gallery" :key="image.id + image.url" :style="imageStyle(image)">
              <img :src="image.url" :alt="slice.article.content.title" @load="readRatio($event, image)" />
            </figure>
          </div>
        </article>
      </div>

      <footer class="page-footer">
        <span>{{ page.theme.header.title }}</span>
        <b>{{ page.globalPageNumber + tocPageOffset }}</b>
      </footer>
    </section>
  </main>
</template>
