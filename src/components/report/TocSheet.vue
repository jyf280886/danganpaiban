<script setup lang="ts">
import type { TocItem } from '@/types/report'

defineProps<{
  tocPage: TocItem[]
  pageIndex: number
  pageCount: number
  pageOffset: number
}>()

function formatTocPageNumber(pageNumber: number) {
  return String(pageNumber).padStart(2, '0')
}
</script>

<template>
  <section class="sheet toc-sheet">
    <div class="toc-card">
      <p class="eyebrow">Contents</p>
      <h2>目录<span v-if="pageCount > 1"> {{ pageIndex + 1 }}</span></h2>
      <ul>
        <li
          v-for="item in tocPage"
          :key="`${pageIndex}-${item.level}-${item.title}-${item.pageNumber}`"
          :class="`toc-${item.level}`"
        >
          <span>{{ item.title }}</span>
          <i />
          <b>{{ formatTocPageNumber(item.pageNumber + pageOffset) }}</b>
        </li>
      </ul>
    </div>
    <footer class="page-footer">
      <b>{{ pageIndex + 1 }}</b>
    </footer>
  </section>
</template>
