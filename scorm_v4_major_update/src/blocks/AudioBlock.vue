<template>
  <div class="scorm-card">
    <div v-if="title" class="scorm-h1" style="font-size:16px">{{ title }}</div>

    <div class="scorm-media" style="padding:12px">
      <audio controls preload="metadata" style="width:100%" :src="src">
        Your browser does not support audio playback.
      </audio>
    </div>

    <div v-if="caption" class="scorm-muted" style="margin-top:10px">{{ caption }}</div>
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