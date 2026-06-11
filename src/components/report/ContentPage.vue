<script setup lang="ts">
import { computed } from 'vue'
import type { ArticleSlice, ReportPage } from '@/types/report'
import StoryBlock from './StoryBlock.vue'

const props = defineProps<{
  page: ReportPage
}>()

function isPageFillingGallery(slice: ArticleSlice) {
  return props.page.articles.length === 1 && !slice.includeHeader && !slice.text && slice.gallery.length > 0
}

const isPageFillingGalleryPage = computed(() => {
  const [slice] = props.page.articles

  return slice !== undefined && isPageFillingGallery(slice)
})
</script>

<template>
  <div
    class="content-card content-card--compact"
    :class="{
      'content-card--single': page.articles.length === 1,
      'content-card--page-gallery': isPageFillingGalleryPage,
    }"
  >
    <StoryBlock
      v-for="(slice, index) in page.articles"
      :key="`${page.id}-${slice.article.content.title}-${index}`"
      :slice="slice"
      :is-page-filling-gallery="isPageFillingGallery(slice)"
    />
  </div>
</template>
