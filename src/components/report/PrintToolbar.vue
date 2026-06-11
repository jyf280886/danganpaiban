<script setup lang="ts">
const emit = defineEmits<{
  print: []
}>()
</script>

<template>
  <section class="toolbar">
    <button type="button" @click="emit('print')">打印 / 导出 PDF</button>
  </section>
</template>
