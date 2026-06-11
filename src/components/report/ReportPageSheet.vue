<script setup lang="ts">
import { computed } from 'vue'
import type { ReportPage } from '@/types/report'
import ContentPage from './ContentPage.vue'
import ThemeCover from './ThemeCover.vue'

const props = defineProps<{
  page: ReportPage
  tocPageOffset: number
}>()

const pageStyle = computed(() => ({
  '--theme-bg': props.page.theme.background.color,
  '--theme-image': `url(${props.page.backgroundImage})`,
}))
</script>

<template>
  <section
    class="sheet report-sheet"
    :class="{ 'report-sheet--theme': page.isThemeStart }"
    :style="pageStyle"
  >
    <ThemeCover v-if="page.isThemeStart" :theme="page.theme" />
    <ContentPage v-else :page="page" />

    <footer class="page-footer">
      <b>{{ page.globalPageNumber + tocPageOffset }}</b>
    </footer>
  </section>
</template>
