<script setup lang="ts">
import { reactive } from 'vue'
import type { ReportImage } from '@/types/report'
import { getGalleryClass } from '@/utils/pagination'

const LANDSCAPE_IMAGE_RATIO = 1.15
const PORTRAIT_IMAGE_RATIO = 1 / LANDSCAPE_IMAGE_RATIO
const SINGLE_IMAGE_ROW_HEIGHT_MM = 112
const PAIR_IMAGE_ROW_HEIGHT_MM = 106
const MULTI_IMAGE_MAX_HEIGHT_MM = 176
const PAGE_FILL_GALLERY_MAX_HEIGHT_MM = 248
const GALLERY_CONTENT_WIDTH_MM = 154
const PAGE_FILL_GALLERY_CONTENT_WIDTH_MM = 168
const FLOW_GAP_MM = 4
const PORTRAIT_SINGLE_IMAGE_MAX_WIDTH_RATIO = 0.5

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

withDefaults(
  defineProps<{
    images: ReportImage[]
    title: string
    shouldFillPage?: boolean
  }>(),
  {
    shouldFillPage: false,
  },
)

const imageRatios = reactive<Record<string, number>>({})

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
    const contentWidth = shouldFillPage ? PAGE_FILL_GALLERY_CONTENT_WIDTH_MM : GALLERY_CONTENT_WIDTH_MM
    const maxWidth =
      singleClass === 'gallery--single-portrait'
        ? contentWidth * PORTRAIT_SINGLE_IMAGE_MAX_WIDTH_RATIO
        : contentWidth
    const metrics = fitRatioRow(
      ratios,
      shouldFillPage ? PAGE_FILL_GALLERY_MAX_HEIGHT_MM : SINGLE_IMAGE_ROW_HEIGHT_MM,
      maxWidth,
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
</script>

<template>
  <div
    class="gallery"
    :class="galleryClass(images)"
    :style="galleryStyle(images, shouldFillPage)"
  >
    <template v-if="isMosaicGallery(images)">
      <div
        v-for="(module, moduleIndex) in mosaicModules(images, shouldFillPage)"
        :key="`${title}-module-${moduleIndex}`"
        class="gallery-module"
        :class="`gallery-module--${module.kind}`"
        :style="moduleStyle(module)"
      >
        <template v-if="module.kind === 'triple-left' && module.leftItem">
          <figure :style="mosaicItemStyle(module.leftItem)">
            <img
              :src="module.leftItem.image.url"
              :alt="title"
              @load="readRatio($event, module.leftItem.image)"
            />
          </figure>
          <div class="gallery-module-column">
            <figure
              v-for="item in module.rightItems"
              :key="`${item.image.id}-${item.sourceIndex}`"
              :style="mosaicItemStyle(item)"
            >
              <img :src="item.image.url" :alt="title" @load="readRatio($event, item.image)" />
            </figure>
          </div>
        </template>

        <template v-else>
          <div
            v-for="(row, rowIndex) in module.rows"
            :key="`${title}-module-${moduleIndex}-row-${rowIndex}`"
            class="gallery-module-row"
            :style="rowStyle(row)"
          >
            <figure
              v-for="item in row"
              :key="`${item.image.id}-${item.sourceIndex}`"
              :style="mosaicItemStyle(item)"
            >
              <img :src="item.image.url" :alt="title" @load="readRatio($event, item.image)" />
            </figure>
          </div>
        </template>
      </div>
    </template>

    <figure v-else v-for="image in images" :key="image.id + image.url" :style="imageStyle(image)">
      <img :src="image.url" :alt="title" @load="readRatio($event, image)" />
    </figure>
  </div>
</template>
