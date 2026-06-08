import type { ArticleSlice, ReportArticle, ReportImage, ReportPage, ReportTheme, TocItem } from '@/types/report'

const CONTENT_PAGE_CAPACITY = 9.2
const HEADER_WEIGHT = 1.2
const MIN_IMAGE_REMAINING_CAPACITY = CONTENT_PAGE_CAPACITY / 4
const TEXT_CHARS_PER_WEIGHT = 58
const TEXT_WEIGHT_UNIT = 0.68
const MIN_TEXT_WEIGHT = 0.68
const MIN_TEXT_SLICE_CHARS = 42
const SENTENCE_BREAKS = ['。', '！', '？', '；']
const LEADING_PUNCTUATION = /^[，。！？；：、]+/

function textWeight(text: string) {
  if (!text) return 0
  return Math.max(1, Math.ceil(text.length / TEXT_CHARS_PER_WEIGHT)) * TEXT_WEIGHT_UNIT
}

function galleryWeight(count: number) {
  if (count <= 0) return 0
  if (count === 1) return 4.6
  if (count === 2) return 5.2
  if (count === 3) return 6.1
  if (count === 4) return 7.0
  return 8.0
}

function articleWeight(slice: ArticleSlice) {
  const headerWeight = slice.includeHeader ? HEADER_WEIGHT : 0
  return headerWeight + textWeight(slice.text) + galleryWeight(slice.gallery.length)
}

function imageCapacity(remaining: number) {
  if (remaining >= 8.0) return 6
  if (remaining >= 7.0) return 4
  if (remaining >= 6.1) return 3
  if (remaining >= 5.2) return 2
  if (remaining >= 4.6) return 1
  return 0
}

function imageTakeCount(remainingCount: number, capacity: number) {
  return Math.min(remainingCount, capacity)
}

function textCapacityChars(remaining: number) {
  if (remaining < MIN_TEXT_WEIGHT) return 0
  return Math.max(0, Math.floor(remaining / TEXT_WEIGHT_UNIT) * TEXT_CHARS_PER_WEIGHT)
}

function splitText(text: string, maxChars: number) {
  const normalizedText = text.trimStart()

  if (!normalizedText) return ['', ''] as const
  if (maxChars < MIN_TEXT_SLICE_CHARS && normalizedText.length > maxChars) return ['', normalizedText] as const
  if (normalizedText.length <= maxChars) return [normalizedText, ''] as const

  const safeMax = Math.max(1, maxChars)
  const punctuationBreak = Math.max(...SENTENCE_BREAKS.map((mark) => normalizedText.lastIndexOf(mark, safeMax)))
  const breakAt = punctuationBreak > Math.floor(safeMax * 0.55) ? punctuationBreak + 1 : safeMax
  if (breakAt < MIN_TEXT_SLICE_CHARS) return ['', normalizedText] as const

  let finalBreakAt = breakAt
  const leadingPunctuation = normalizedText.slice(finalBreakAt).match(LEADING_PUNCTUATION)?.[0] ?? ''
  finalBreakAt += leadingPunctuation.length

  const remainingLength = normalizedText.length - finalBreakAt

  if (remainingLength > 0 && remainingLength < MIN_TEXT_SLICE_CHARS) {
    finalBreakAt = Math.max(MIN_TEXT_SLICE_CHARS, normalizedText.length - MIN_TEXT_SLICE_CHARS)
  }

  const current = normalizedText.slice(0, finalBreakAt).trim()
  const next = normalizedText.slice(finalBreakAt).trimStart()

  return [current, next] as const
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
    isThemeStart,
    articles,
  }
}

function makeSlice(article: ReportArticle, options: Partial<ArticleSlice>): ArticleSlice {
  return {
    article,
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
    let currentWeight = 0

    const pushContentPage = () => {
      if (currentArticles.length === 0) return

      pages.push(createPage(theme, themeIndex, themePageNumber, globalPageNumber, currentArticles))

      currentArticles.forEach(({ article, includeHeader }) => {
        if (includeHeader) {
          toc.push({ title: article.content.title, pageNumber: globalPageNumber, level: 'article' })
        }
      })

      currentArticles = []
      currentWeight = 0
      themePageNumber += 1
      globalPageNumber += 1
    }

    const addSlice = (slice: ArticleSlice) => {
      currentArticles.push(slice)
      currentWeight += articleWeight(slice)
    }

    theme.pages.forEach((article) => {
      let remainingText = article.content.text
      let remainingImages: ReportImage[] = [...article.gallery]
      let includeHeader = true
      let isTextContinuation = false

      while (includeHeader || remainingText || remainingImages.length > 0) {
        let remainingCapacity = CONTENT_PAGE_CAPACITY - currentWeight
        let requiredHeaderWeight = includeHeader ? HEADER_WEIGHT : 0

        if (currentArticles.length > 0 && requiredHeaderWeight >= remainingCapacity) {
          pushContentPage()
          remainingCapacity = CONTENT_PAGE_CAPACITY
        }

        const availableAfterHeader = remainingCapacity - requiredHeaderWeight
        const maxTextChars = textCapacityChars(availableAfterHeader)
        const [textPart, nextText] = splitText(remainingText, maxTextChars)
        let gallery: ReportImage[] = []
        let usedText = textPart
        let nextRemainingText = nextText

        if (!usedText && remainingText && currentArticles.length > 0) {
          pushContentPage()
          continue
        }

        const usedTextWeight = textWeight(usedText)
        const roomForImages = remainingCapacity - requiredHeaderWeight - usedTextWeight
        const take =
          roomForImages >= MIN_IMAGE_REMAINING_CAPACITY
            ? imageTakeCount(remainingImages.length, imageCapacity(roomForImages))
            : 0

        if (remainingImages.length > 0 && take > 0) {
          gallery = remainingImages.slice(0, take)
          remainingImages = remainingImages.slice(take)
        }

        if (!usedText && gallery.length === 0 && remainingImages.length > 0) {
          if (currentArticles.length > 0) {
            pushContentPage()
            continue
          }

          const forcedTake = Math.max(
            1,
            imageTakeCount(remainingImages.length, imageCapacity(CONTENT_PAGE_CAPACITY - requiredHeaderWeight)),
          )
          gallery = remainingImages.slice(0, forcedTake)
          remainingImages = remainingImages.slice(forcedTake)
        }

        addSlice(
          makeSlice(article, {
            gallery,
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
