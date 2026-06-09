import type { ArticleSlice, ReportArticle, ReportImage, ReportPage, ReportTheme, TocItem } from '@/types/report'

const CONTENT_PAGE_HEIGHT_MM = 242
const STORY_HEADER_HEIGHT_MM = 9
const FLOW_GAP_MM = 5
const GALLERY_GAP_MM = 4
const GALLERY_CONTENT_WIDTH_MM = 154
const STORY_TEXT_LINE_HEIGHT_MM = 8.3
const MIN_TEXT_SLICE_CHARS = 42
const MIN_NEW_ARTICLE_TEXT_LINES = 2
const SINGLE_IMAGE_HEIGHT_MM = 112
const PAIR_IMAGE_HEIGHT_MM = 106
const MULTI_IMAGE_HEIGHT_MM = 176
const MAX_IMAGES_PER_SLICE = 6
const LANDSCAPE_IMAGE_RATIO = 1.15
const LEADING_PUNCTUATION = /^[，。！？；：、]+/
const MIN_LAST_LINE_FILL_RATIO = 0.75
const STORY_TEXT_FIRST_LINE_CHARS = 33
const STORY_TEXT_LINE_CHARS = 35
const IMAGE_RATIOS: Record<string, number> = {
  '/images/1.png': 1025 / 809,
  '/images/1.webp': 828 / 1104,
  '/images/2.webp': 427 / 569,
  '/images/3.webp': 427 / 569,
  '/images/4.webp': 678 / 904,
  '/images/5.webp': 626 / 904,
  '/images/6.webp': 652 / 869,
  '/images/7.webp': 652 / 869,
}

function estimatedTextLineCount(text: string, isTextContinuation: boolean) {
  if (!text) return 0

  const firstLineChars = isTextContinuation ? STORY_TEXT_LINE_CHARS : STORY_TEXT_FIRST_LINE_CHARS
  if (text.length <= firstLineChars) return 1

  return 1 + Math.ceil((text.length - firstLineChars) / STORY_TEXT_LINE_CHARS)
}

function textHeight(text: string, isTextContinuation: boolean) {
  return estimatedTextLineCount(text, isTextContinuation) * STORY_TEXT_LINE_HEIGHT_MM
}

function imageRatio(image: ReportImage) {
  return IMAGE_RATIOS[image.url] ?? 1
}

function galleryGapWidth(count: number) {
  return Math.max(0, count - 1) * GALLERY_GAP_MM
}

function ratioTotal(ratios: number[]) {
  return ratios.reduce((total, ratio) => total + ratio, 0)
}

function pairMosaicHeight(images: ReportImage[], width: number) {
  const ratios = images.map(imageRatio)
  return Math.max(1, (width - galleryGapWidth(ratios.length)) / ratioTotal(ratios))
}

function tripleTopMosaicHeight(images: ReportImage[], width: number) {
  const heroIndex = images.findIndex((image) => imageRatio(image) > LANDSCAPE_IMAGE_RATIO)
  const heroImage = images[heroIndex] ?? images[0]
  if (!heroImage) return pairMosaicHeight(images, width)

  const bottomImages = images.filter((_image, index) => index !== heroIndex)
  return width / imageRatio(heroImage) + GALLERY_GAP_MM + pairMosaicHeight(bottomImages, width)
}

function tripleLeftMosaicHeight(images: ReportImage[], width: number) {
  const [leftImage, firstRightImage, secondRightImage] = images
  if (!leftImage || !firstRightImage || !secondRightImage) return pairMosaicHeight(images, width)

  const leftRatio = imageRatio(leftImage)
  const rightRatios = [imageRatio(firstRightImage), imageRatio(secondRightImage)]
  const rightWidth =
    (width - GALLERY_GAP_MM * (leftRatio + 1)) /
    (1 + leftRatio * rightRatios.reduce((total, ratio) => total + 1 / ratio, 0))
  const safeRightWidth = Math.max(1, rightWidth)

  return rightRatios.reduce((total, ratio) => total + safeRightWidth / ratio, 0) + GALLERY_GAP_MM
}

function tripleMosaicHeight(images: ReportImage[], width: number) {
  if (images.some((image) => imageRatio(image) > LANDSCAPE_IMAGE_RATIO)) {
    return tripleTopMosaicHeight(images, width)
  }

  return tripleLeftMosaicHeight(images, width)
}

function mosaicModuleHeights(images: ReportImage[], width: number) {
  const heights: number[] = []

  if (images.length % 2 === 1 && images.length >= 3) {
    heights.push(tripleMosaicHeight(images.slice(0, 3), width))

    for (let index = 3; index < images.length; index += 2) {
      heights.push(pairMosaicHeight(images.slice(index, index + 2), width))
    }

    return heights
  }

  for (let index = 0; index < images.length; index += 2) {
    heights.push(pairMosaicHeight(images.slice(index, index + 2), width))
  }

  return heights
}

function mosaicHeight(images: ReportImage[], width: number) {
  const heights = mosaicModuleHeights(images, width)
  return heights.reduce((total, height) => total + height, 0) + Math.max(0, heights.length - 1) * GALLERY_GAP_MM
}

function mosaicGalleryHeight(images: ReportImage[]) {
  const maxHeight = images.length === 2 ? PAIR_IMAGE_HEIGHT_MM : MULTI_IMAGE_HEIGHT_MM
  const fullWidthHeight = mosaicHeight(images, GALLERY_CONTENT_WIDTH_MM)
  if (fullWidthHeight <= maxHeight) return fullWidthHeight

  let low = 1
  let high = GALLERY_CONTENT_WIDTH_MM

  for (let index = 0; index < 24; index += 1) {
    const width = (low + high) / 2

    if (mosaicHeight(images, width) <= maxHeight) {
      low = width
    } else {
      high = width
    }
  }

  return mosaicHeight(images, low)
}

function galleryHeight(images: ReportImage[]) {
  if (images.length <= 0) return 0
  if (images.length === 1) return SINGLE_IMAGE_HEIGHT_MM
  return mosaicGalleryHeight(images)
}

function sliceChildCount(slice: ArticleSlice) {
  return Number(slice.includeHeader) + Number(Boolean(slice.text)) + Number(slice.gallery.length > 0)
}

function articleHeight(slice: ArticleSlice) {
  const childCount = sliceChildCount(slice)
  if (childCount === 0) return 0

  const headerHeight = slice.includeHeader ? STORY_HEADER_HEIGHT_MM : 0
  const copyHeight = textHeight(slice.text, slice.isTextContinuation)
  const mediaHeight = galleryHeight(slice.gallery)

  return headerHeight + copyHeight + mediaHeight + (childCount - 1) * FLOW_GAP_MM
}

function imageCapacity(remainingHeight: number, images: ReportImage[]) {
  const maxTake = Math.min(MAX_IMAGES_PER_SLICE, images.length)

  for (let take = maxTake; take > 0; take -= 1) {
    if (galleryHeight(images.slice(0, take)) <= remainingHeight) return take
  }

  return 0
}

function imageTakeCount(remainingCount: number, capacity: number) {
  return Math.min(remainingCount, capacity)
}

function textCapacityChars(remainingHeight: number, isTextContinuation: boolean) {
  const lineCount = Math.floor(remainingHeight / STORY_TEXT_LINE_HEIGHT_MM)
  if (lineCount <= 0) return 0

  const firstLineChars = isTextContinuation ? STORY_TEXT_LINE_CHARS : STORY_TEXT_FIRST_LINE_CHARS
  return firstLineChars + Math.max(0, lineCount - 1) * STORY_TEXT_LINE_CHARS
}

function estimatedLineBounds(breakAt: number, isTextContinuation: boolean) {
  const firstLineChars = isTextContinuation ? STORY_TEXT_LINE_CHARS : STORY_TEXT_FIRST_LINE_CHARS

  if (breakAt <= firstLineChars) {
    return {
      lineStart: 0,
      lineEnd: firstLineChars,
    }
  }

  const charsAfterFirstLine = breakAt - firstLineChars
  const lineIndex = Math.max(0, Math.ceil(charsAfterFirstLine / STORY_TEXT_LINE_CHARS) - 1)
  const lineStart = firstLineChars + lineIndex * STORY_TEXT_LINE_CHARS

  return {
    lineStart,
    lineEnd: lineStart + STORY_TEXT_LINE_CHARS,
  }
}

function fillLastEstimatedLine(
  breakAt: number,
  maxBreakAt: number,
  isTextContinuation: boolean,
) {
  const { lineStart, lineEnd } = estimatedLineBounds(breakAt, isTextContinuation)
  const lineLength = lineEnd - lineStart
  const currentFill = lineLength > 0 ? (breakAt - lineStart) / lineLength : 1

  if (currentFill >= MIN_LAST_LINE_FILL_RATIO) return breakAt

  return Math.min(lineEnd, maxBreakAt)
}

function avoidLeadingPunctuation(text: string, breakAt: number, minBreakAt: number) {
  let safeBreakAt = breakAt

  while (
    safeBreakAt > minBreakAt &&
    LEADING_PUNCTUATION.test(text.slice(safeBreakAt).trimStart())
  ) {
    safeBreakAt -= 1
  }

  return safeBreakAt
}

function pullLeadingPunctuation(
  text: string,
  breakAt: number,
  maxBreakAt: number,
  lineCapacity: number,
  isTextContinuation: boolean,
) {
  const leadingPunctuation = text.slice(breakAt).match(LEADING_PUNCTUATION)?.[0] ?? ''
  if (!leadingPunctuation) return breakAt

  const pulledBreakAt = Math.min(breakAt + leadingPunctuation.length, maxBreakAt)
  if (
    pulledBreakAt > breakAt &&
    estimatedTextLineCount(text.slice(0, pulledBreakAt), isTextContinuation) <= lineCapacity
  ) {
    return pulledBreakAt
  }

  return avoidLeadingPunctuation(text, breakAt, MIN_TEXT_SLICE_CHARS)
}

function splitText(text: string, maxChars: number, isTextContinuation = false) {
  const normalizedText = text.trimStart()

  if (!normalizedText) return { current: '', next: '', continues: false } as const
  if (maxChars < MIN_TEXT_SLICE_CHARS && normalizedText.length > maxChars) {
    return { current: '', next: normalizedText, continues: true } as const
  }
  if (normalizedText.length <= maxChars) {
    return { current: normalizedText, next: '', continues: false } as const
  }

  const safeMax = Math.max(1, maxChars)
  const breakAt = Math.min(normalizedText.length, safeMax)
  if (breakAt < MIN_TEXT_SLICE_CHARS) {
    return { current: '', next: normalizedText, continues: true } as const
  }

  const lineCapacity = estimatedTextLineCount(normalizedText.slice(0, breakAt), isTextContinuation)

  let maxBreakAt = breakAt
  let finalBreakAt = fillLastEstimatedLine(breakAt, maxBreakAt, isTextContinuation)
  finalBreakAt = pullLeadingPunctuation(
    normalizedText,
    finalBreakAt,
    maxBreakAt,
    lineCapacity,
    isTextContinuation,
  )

  const remainingLength = normalizedText.length - finalBreakAt

  if (remainingLength > 0 && remainingLength < MIN_TEXT_SLICE_CHARS) {
    const balancedBreakAt = normalizedText.length - MIN_TEXT_SLICE_CHARS

    if (balancedBreakAt >= MIN_TEXT_SLICE_CHARS) {
      maxBreakAt = Math.min(maxBreakAt, balancedBreakAt)
      finalBreakAt = fillLastEstimatedLine(balancedBreakAt, maxBreakAt, isTextContinuation)
      finalBreakAt = pullLeadingPunctuation(
        normalizedText,
        finalBreakAt,
        maxBreakAt,
        lineCapacity,
        isTextContinuation,
      )
    }
  }

  const current = normalizedText.slice(0, finalBreakAt).trim()
  const next = normalizedText.slice(finalBreakAt).trimStart()

  return { current, next, continues: Boolean(next) } as const
}

function firstStringArray(...values: Array<string[] | undefined>) {
  return values.find((value) => Array.isArray(value) && value.length > 0) ?? []
}

function stableIndex(seed: string, count: number) {
  let hash = 2166136261

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  hash += hash << 13
  hash ^= hash >>> 7
  hash += hash << 3
  hash ^= hash >>> 17
  hash += hash << 5

  return (hash >>> 0) % count
}

function themeBackgroundImage(theme: ReportTheme) {
  return theme.image || theme.background.image
}

function contentBackgroundImages(theme: ReportTheme) {
  return firstStringArray(
    theme.contentImages,
    theme.background.contentImages,
  ).filter((image) => image.trim().length > 0)
}

function contentBackgroundImage(theme: ReportTheme, themeIndex: number, pageNumber: number, globalPageNumber: number) {
  const images = contentBackgroundImages(theme)
  if (images.length === 0) return themeBackgroundImage(theme)

  return images[stableIndex(`${theme.theme}:${themeIndex}:${pageNumber}:${globalPageNumber}`, images.length)] ?? images[0] ?? themeBackgroundImage(theme)
}

function createPage(
  theme: ReportTheme,
  themeIndex: number,
  pageNumber: number,
  globalPageNumber: number,
  articles: ArticleSlice[],
  isThemeStart = false,
): ReportPage {
  return {
    id: `theme-${themeIndex + 1}-page-${pageNumber}`,
    themeIndex,
    pageNumber,
    globalPageNumber,
    theme,
    backgroundImage: isThemeStart
      ? themeBackgroundImage(theme)
      : contentBackgroundImage(theme, themeIndex, pageNumber, globalPageNumber),
    isThemeStart,
    articles,
  }
}

function makeSlice(article: ReportArticle, options: Partial<ArticleSlice>): ArticleSlice {
  return {
    article,
    continuesText: options.continuesText ?? false,
    gallery: options.gallery ?? [],
    includeHeader: options.includeHeader ?? false,
    isTextContinuation: options.isTextContinuation ?? false,
    text: options.text ?? '',
  }
}

export function buildReportPages(themes: ReportTheme[]) {
  const pages: ReportPage[] = []
  const toc: TocItem[] = []
  let globalPageNumber = 1

  themes.forEach((theme, themeIndex) => {
    let themePageNumber = 1

    pages.push(createPage(theme, themeIndex, themePageNumber, globalPageNumber, [], true))
    toc.push({ title: theme.header.title, pageNumber: globalPageNumber, level: 'theme' })
    themePageNumber += 1
    globalPageNumber += 1

    let currentArticles: ArticleSlice[] = []
    let currentHeight = 0

    const pushContentPage = () => {
      if (currentArticles.length === 0) return

      pages.push(createPage(theme, themeIndex, themePageNumber, globalPageNumber, currentArticles))

      currentArticles.forEach(({ article, includeHeader }) => {
        if (includeHeader) {
          toc.push({ title: article.content.title, pageNumber: globalPageNumber, level: 'article' })
        }
      })

      currentArticles = []
      currentHeight = 0
      themePageNumber += 1
      globalPageNumber += 1
    }

    const addSlice = (slice: ArticleSlice) => {
      const gapHeight = currentArticles.length > 0 ? FLOW_GAP_MM : 0
      currentArticles.push(slice)
      currentHeight += gapHeight + articleHeight(slice)
    }

    theme.pages.forEach((article) => {
      let remainingText = article.content.text
      let remainingImages: ReportImage[] = [...article.gallery]
      let includeHeader = true
      let isTextContinuation = false

      while (includeHeader || remainingText || remainingImages.length > 0) {
        const nextSliceGap = currentArticles.length > 0 ? FLOW_GAP_MM : 0
        let remainingCapacity = CONTENT_PAGE_HEIGHT_MM - currentHeight - nextSliceGap
        const requiredHeaderHeight = includeHeader ? STORY_HEADER_HEIGHT_MM : 0

        if (currentArticles.length > 0 && requiredHeaderHeight >= remainingCapacity) {
          pushContentPage()
          remainingCapacity = CONTENT_PAGE_HEIGHT_MM
        }

        const availableAfterHeader = remainingCapacity - requiredHeaderHeight
        const minNewArticleTextHeight =
          remainingText.length > 0
            ? FLOW_GAP_MM + MIN_NEW_ARTICLE_TEXT_LINES * STORY_TEXT_LINE_HEIGHT_MM
            : 0
        if (
          currentArticles.length > 0 &&
          includeHeader &&
          availableAfterHeader < minNewArticleTextHeight &&
          (remainingText || remainingImages.length > 0)
        ) {
          pushContentPage()
          continue
        }

        const textGapHeight = includeHeader && remainingText ? FLOW_GAP_MM : 0
        const maxTextChars = textCapacityChars(
          availableAfterHeader - textGapHeight,
          isTextContinuation,
        )
        const { current: textPart, next: nextText, continues: continuesText } = splitText(
          remainingText,
          maxTextChars,
          isTextContinuation,
        )
        let gallery: ReportImage[] = []
        let usedText = textPart
        let nextRemainingText = nextText

        if (!usedText && remainingText && currentArticles.length > 0) {
          pushContentPage()
          continue
        }

        const provisionalSlice = makeSlice(article, {
          includeHeader,
          isTextContinuation: isTextContinuation && Boolean(usedText),
          text: usedText,
        })
        const roomForImages =
          remainingCapacity -
          articleHeight(provisionalSlice) -
          (sliceChildCount(provisionalSlice) > 0 ? FLOW_GAP_MM : 0)
        const take = imageTakeCount(
          remainingImages.length,
          imageCapacity(roomForImages, remainingImages),
        )

        if (remainingImages.length > 0 && take > 0) {
          gallery = remainingImages.slice(0, take)
          remainingImages = remainingImages.slice(take)
        }

        if (!usedText && gallery.length === 0 && remainingImages.length > 0) {
          if (currentArticles.length > 0) {
            pushContentPage()
            continue
          }

          const forcedRoomForImages =
            CONTENT_PAGE_HEIGHT_MM -
            requiredHeaderHeight -
            (includeHeader ? FLOW_GAP_MM : 0)
          const forcedTake = Math.max(
            1,
            imageTakeCount(
              remainingImages.length,
              imageCapacity(forcedRoomForImages, remainingImages),
            ),
          )
          gallery = remainingImages.slice(0, forcedTake)
          remainingImages = remainingImages.slice(forcedTake)
        }

        addSlice(
          makeSlice(article, {
            gallery,
            continuesText: continuesText && Boolean(usedText),
            includeHeader,
            isTextContinuation: isTextContinuation && Boolean(usedText),
            text: usedText,
          }),
        )

        remainingText = nextRemainingText
        includeHeader = false
        isTextContinuation = Boolean(remainingText)
      }
    })

    pushContentPage()
  })

  return { pages, toc, totalPages: pages.length }
}

export function getGalleryClass(count: number) {
  if (count <= 1) return 'gallery--single'
  return 'gallery--mosaic'
}
