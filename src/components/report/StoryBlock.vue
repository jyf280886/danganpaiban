<script setup lang="ts">
import type { ArticleSlice } from '@/types/report'
import GalleryView from './GalleryView.vue'

defineProps<{
  slice: ArticleSlice
  isPageFillingGallery: boolean
}>()

function formatStoryDate(date: string) {
  const [year, month, day] = date.split('/')
  if (!year || !month || !day) return date.replaceAll('/', '.')

  return `${year}.${month.padStart(2, '0')}.${day.padStart(2, '0')}`
}
</script>

<template>
  <article
    class="story-block"
    :class="{
      'story-block--with-header': slice.includeHeader,
      'story-block--with-gallery': slice.gallery.length > 0,
      'story-block--gallery-only': !slice.includeHeader && !slice.text && slice.gallery.length > 0,
      'story-block--page-gallery': isPageFillingGallery,
    }"
  >
    <header v-if="slice.includeHeader" class="story-header">
      <h3>{{ slice.article.content.title }}</h3>
      <time>{{ formatStoryDate(slice.article.content.date) }}</time>
    </header>

    <p
      v-if="slice.text"
      class="story-text"
      :class="{
        'story-text--continuation': slice.isTextContinuation,
        'story-text--continues': slice.continuesText,
      }"
    >
      {{ slice.text }}
    </p>

    <GalleryView
      v-if="slice.gallery.length"
      :images="slice.gallery"
      :title="slice.article.content.title"
      :should-fill-page="isPageFillingGallery"
    />
  </article>
</template>
