<template>
  <div class="scorm-card">
    <img
      :src="src"
      :alt="alt || ''"
      class="imageBlock__media"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  src: string;
  alt?: string;
}>();
</script>