<template>
  <div class="scorm-card">
    <div v-if="title" class="scorm-h1 scorm-title-sm">{{ title }}</div>

    <div class="scorm-media audioBlock__media">
      <audio controls preload="metadata" class="audioBlock__player" :src="src">
        Your browser does not support audio playback.
      </audio>
    </div>

    <div v-if="caption" class="scorm-muted audioBlock__caption">{{ caption }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  type: "audio";
  id?: string;
  requiredView?: boolean;
  title?: string;
  caption?: string;
  src: string; // relative path inside package
}>();
</script>