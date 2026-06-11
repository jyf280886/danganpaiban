<script setup lang="ts">
import type { ReportTheme } from '@/types/report'

defineProps<{
  theme: ReportTheme
}>()
</script>

<template>
  <div class="theme-cover">
    <div class="quote-mark">“</div>
    <div class="theme-copy">
      <h2>{{ theme.header.title }}</h2>
      <h3 v-if="theme.header.subtitle">{{ theme.header.subtitle }}</h3>
      <p>{{ theme.header.description }}</p>
    </div>
  </div>
</template>
