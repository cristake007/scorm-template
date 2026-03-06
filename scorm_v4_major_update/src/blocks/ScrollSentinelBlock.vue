<template>
  <div class="scorm-card scrollSentinelBlock">
    <div class="scorm-muted">{{ text || "You reached the end of the chapter." }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ text?: string }>();
</script>