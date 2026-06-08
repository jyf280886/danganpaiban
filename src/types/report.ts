export interface ReportImage {
  id: string
  url: string
}

export interface ReportArticle {
  content: {
    date: string
    title: string
    text: string
  }
  gallery: ReportImage[]
}

export interface ReportTheme {
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

export interface ArticleSlice {
  article: ReportArticle
  gallery: ReportImage[]
  includeHeader: boolean
  isTextContinuation: boolean
  text: string
}

export interface ReportPage {
  id: string
  themeIndex: number
  pageNumber: number
  globalPageNumber: number
  theme: ReportTheme
  isThemeStart: boolean
  articles: ArticleSlice[]
}

export interface TocItem {
  title: string
  pageNumber: number
  level: 'theme' | 'article'
}
