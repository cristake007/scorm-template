<template>
  <div class="scorm-card">
    <div :class="cls" style="white-space: pre-wrap">{{ text }}</div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  text: string;
  variant?: "body" | "muted" | "h1" | "h2";
}>();

const cls =
  props.variant === "h1"
    ? "scorm-h1"
    : props.variant === "h2"
      ? "scorm-h2"
      : props.variant === "muted"
        ? "scorm-muted"
        : "scorm-body";
</script>