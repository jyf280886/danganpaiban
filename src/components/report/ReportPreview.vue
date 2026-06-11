<script setup lang="ts">
import reportData from '../../../api.json'
import type { ReportTheme, TocItem } from '@/types/report'
import { createMockReportData } from '@/utils/mockReport'
import { buildReportPages } from '@/utils/pagination'
import FrontCoverSheet from './FrontCoverSheet.vue'
import PrintToolbar from './PrintToolbar.vue'
import ReportPageSheet from './ReportPageSheet.vue'
import TocSheet from './TocSheet.vue'

const DEFAULT_MOCK_COUNT = 20
const DEFAULT_MOCK_THEME_COUNT = 3
const MAX_MOCK_COUNT = 120
const MAX_MOCK_THEME_COUNT = 12
const TOC_ITEMS_PER_PAGE = 32
const FRONT_COVER_PAGE_COUNT = 1

const searchParams = new URLSearchParams(globalThis.location.search)
const mockCount = readPositiveIntegerParam('mock', DEFAULT_MOCK_COUNT, MAX_MOCK_COUNT)
const mockThemeCount = readPositiveIntegerParam('themes', DEFAULT_MOCK_THEME_COUNT, MAX_MOCK_THEME_COUNT)
const themes = searchParams.has('mock')
  ? createMockReportData(reportData as ReportTheme[], mockCount, mockThemeCount)
  : (reportData as ReportTheme[])
const { pages, toc } = buildReportPages(themes)
const tocPages = paginateToc(toc)
const tocPageOffset = FRONT_COVER_PAGE_COUNT + tocPages.length

function readPositiveIntegerParam(name: string, fallback: number, max: number) {
  const rawValue = searchParams.get(name)
  const parsedValue = rawValue === null || rawValue === '' ? fallback : Number(rawValue)

  if (!Number.isFinite(parsedValue)) return fallback

  return Math.min(Math.max(1, Math.trunc(parsedValue)), max)
}

function paginateToc(items: TocItem[]) {
  const pages: TocItem[][] = []
  let currentPage: TocItem[] = []

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
</script>

<template>
  <main class="report-preview">
    <PrintToolbar @print="printReport" />
    <FrontCoverSheet />

    <TocSheet
      v-for="(tocPage, tocPageIndex) in tocPages"
      :key="`toc-${tocPageIndex}`"
      :toc-page="tocPage"
      :page-index="tocPageIndex"
      :page-count="tocPages.length"
      :page-offset="tocPageOffset"
    />

    <ReportPageSheet
      v-for="page in pages"
      :key="page.id"
      :page="page"
      :toc-page-offset="tocPageOffset"
    />
  </main>
</template>
