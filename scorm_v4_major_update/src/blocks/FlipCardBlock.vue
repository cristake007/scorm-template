<template>
  <div
    class="scorm-card flipWrap"
    @click="toggle"
    role="button"
    tabindex="0"
    @keydown.enter.prevent="toggle"
  >
    <div v-if="title" class="scorm-h2 flipCardBlock__title">{{ title }}</div>

    <div class="flipCard" :class="{ flipped }" aria-live="polite">
      <div class="flipFace flipFront">
        <div class="scorm-body scorm-prewrap">{{ front }}</div>
        <div class="scorm-muted flipCard__hint">Click to flip</div>
      </div>

      <div class="flipFace flipBack">
        <div class="scorm-body scorm-prewrap">{{ back }}</div>
        <div class="scorm-muted flipCard__hint">Click to flip back</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  id?: string;
  title?: string;
  front: string;
  back: string;
}>();

const emit = defineEmits<{
  (e: "viewed-ids", ids: string[]): void;
}>();

const flipped = ref(false);
const counted = ref(false);

function toggle() {
  flipped.value = !flipped.value;

  // Count “viewed” the first time the learner flips to back
  if (!counted.value && flipped.value && props.id) {
    counted.value = true;
    emit("viewed-ids", [props.id]);
  }
}
</script>

