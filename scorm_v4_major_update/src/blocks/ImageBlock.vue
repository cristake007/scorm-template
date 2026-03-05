<template>
  <div class="scorm-card">
    <img
      :src="src"
      :alt="alt || ''"
      style="max-width: 100%; height: auto; border-radius: 12px; display: block;"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  src: string;
  alt?: string;
}>();
</script>