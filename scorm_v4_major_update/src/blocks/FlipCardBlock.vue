<template>
  <div
    class="scorm-card flipWrap"
    @click="toggle"
    role="button"
    tabindex="0"
    @keydown.enter.prevent="toggle"
  >
    <div v-if="title" class="scorm-h2" style="margin-bottom: 10px">{{ title }}</div>

    <div class="flipCard" :class="{ flipped }" aria-live="polite">
      <div class="flipFace flipFront">
        <div class="scorm-body" style="white-space: pre-wrap">{{ front }}</div>
        <div class="scorm-muted" style="margin-top: 10px">Click to flip</div>
      </div>

      <div class="flipFace flipBack">
        <div class="scorm-body" style="white-space: pre-wrap">{{ back }}</div>
        <div class="scorm-muted" style="margin-top: 10px">Click to flip back</div>
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

<style scoped>
.flipWrap { cursor: pointer; }
.flipCard { position: relative; perspective: 1000px; min-height: 120px; }
.flipFace {
  backface-visibility: hidden;
  transition: transform 0.35s ease;
  border-radius: 0;
  padding: 14px;
  border: 0;
}
.flipFront { transform: rotateY(0deg); }
.flipBack { position: absolute; inset: 0; transform: rotateY(180deg); }
.flipCard.flipped .flipFront { transform: rotateY(180deg); }
.flipCard.flipped .flipBack { transform: rotateY(360deg); }
</style>