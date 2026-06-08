import type { ArticleSlice, ReportArticle, ReportImage, ReportPage, ReportTheme, TocItem } from '@/types/report'

const CONTENT_PAGE_CAPACITY = 10.4
const HEADER_WEIGHT = 1.2
const MIN_IMAGE_REMAINING_CAPACITY = CONTENT_PAGE_CAPACITY / 4
const TEXT_CHARS_PER_WEIGHT = 76
const TEXT_WEIGHT_UNIT = 0.68
const MIN_TEXT_WEIGHT = 0.68
const MIN_TEXT_SLICE_CHARS = 42
const MIN_NEW_ARTICLE_CAPACITY = TEXT_WEIGHT_UNIT * 3
const SINGLE_IMAGE_WEIGHT = 4.4
const LEADING_PUNCTUATION = /^[，。！？；：、]+/
const NATURAL_LINE_BREAKS = ['。', '！', '？', '；', '，', '、', '：']
const STORY_TEXT_FIRST_LINE_CHARS = 39
const STORY_TEXT_LINE_CHARS = 41
const MIN_LINE_FILL_RATIO = 0.9

function textWeight(text: string) {
  if (!text) return 0
  return Math.max(1, Math.ceil(text.length / TEXT_CHARS_PER_WEIGHT)) * TEXT_WEIGHT_UNIT
}

function galleryWeight(count: number) {
  if (count <= 0) return 0
  if (count === 1) return SINGLE_IMAGE_WEIGHT
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
  if (remaining >= SINGLE_IMAGE_WEIGHT) return 1
  return 0
}

function imageTakeCount(remainingCount: number, capacity: number) {
  return Math.min(remainingCount, capacity)
}

function textCapacityChars(remaining: number) {
  if (remaining < MIN_TEXT_WEIGHT) return 0
  return Math.max(0, Math.floor(remaining / TEXT_WEIGHT_UNIT) * TEXT_CHARS_PER_WEIGHT)
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
  const lineIndex = Math.floor((charsAfterFirstLine - 1) / STORY_TEXT_LINE_CHARS)
  const lineStart = firstLineChars + lineIndex * STORY_TEXT_LINE_CHARS

  return {
    lineStart,
    lineEnd: lineStart + STORY_TEXT_LINE_CHARS,
  }
}

function findNaturalBreak(text: string, from: number, to: number, lineStart: number) {
  const minBreakAt = lineStart + Math.floor((to - lineStart) * MIN_LINE_FILL_RATIO)

  for (let index = to; index > from; index -= 1) {
    if (index < minBreakAt) break
    if (NATURAL_LINE_BREAKS.includes(text[index - 1] ?? '')) return index
  }

  return 0
}

function alignBreakToLineEnd(text: string, breakAt: number, isTextContinuation: boolean) {
  if (breakAt >= text.length) return breakAt

  const { lineStart, lineEnd } = estimatedLineBounds(breakAt, isTextContinuation)
  const safeLineEnd = Math.min(text.length, lineEnd)
  if (breakAt >= safeLineEnd) return breakAt

  return findNaturalBreak(text, breakAt, safeLineEnd, lineStart) || safeLineEnd
}

function splitText(text: string, maxChars: number, isTextContinuation = false) {
  const normalizedText = text.trimStart()

  if (!normalizedText) return ['', ''] as const
  if (maxChars < MIN_TEXT_SLICE_CHARS && normalizedText.length > maxChars) return ['', normalizedText] as const
  if (normalizedText.length <= maxChars) return [normalizedText, ''] as const

  const safeMax = Math.max(1, maxChars)
  const breakAt = alignBreakToLineEnd(normalizedText, safeMax, isTextContinuation)
  if (breakAt < MIN_TEXT_SLICE_CHARS) return ['', normalizedText] as const

  let finalBreakAt = breakAt
  const leadingPunctuation = normalizedText.slice(finalBreakAt).match(LEADING_PUNCTUATION)?.[0] ?? ''
  finalBreakAt += leadingPunctuation.length

  const remainingLength = normalizedText.length - finalBreakAt

  if (remainingLength > 0 && remainingLength < MIN_TEXT_SLICE_CHARS) {
    finalBreakAt = Math.max(finalBreakAt, MIN_TEXT_SLICE_CHARS, normalizedText.length - MIN_TEXT_SLICE_CHARS)
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
        if (
          currentArticles.length > 0 &&
          includeHeader &&
          availableAfterHeader < MIN_NEW_ARTICLE_CAPACITY &&
          (remainingText || remainingImages.length > 0)
        ) {
          pushContentPage()
          continue
        }

        const maxTextChars = textCapacityChars(availableAfterHeader)
        const [textPart, nextText] = splitText(remainingText, maxTextChars, isTextContinuation)
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
