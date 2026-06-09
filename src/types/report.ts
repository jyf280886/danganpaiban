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

export interface ArticleSlice {
  article: ReportArticle
  continuesText: boolean
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
  backgroundImage: string
  isThemeStart: boolean
  articles: ArticleSlice[]
}

export interface TocItem {
  title: string
  pageNumber: number
  level: 'theme' | 'article'
}
