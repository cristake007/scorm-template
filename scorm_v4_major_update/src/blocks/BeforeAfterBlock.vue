<template>
  <div class="scorm-card beforeAfter">
    <div v-if="title" class="scorm-h2 beforeAfter__title">{{ title }}</div>

    <div class="beforeAfter__grid">
      <section class="beforeAfter__col beforeAfter__col--before">
        <h3 class="beforeAfter__heading">{{ beforeTitle || "Before" }}</h3>
        <ul class="beforeAfter__list">
          <li v-for="(row, idx) in before" :key="`b-${idx}`">{{ row }}</li>
        </ul>
      </section>

      <section class="beforeAfter__col beforeAfter__col--after">
        <h3 class="beforeAfter__heading">{{ afterTitle || "After" }}</h3>
        <ul class="beforeAfter__list">
          <li v-for="(row, idx) in after" :key="`a-${idx}`">{{ row }}</li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";

const props = defineProps<{
  id?: string;
  type: "comparison.beforeAfter";
  title?: string;
  beforeTitle?: string;
  afterTitle?: string;
  before: string[];
  after: string[];
}>();

const emit = defineEmits<{ (e: "viewed-ids", ids: string[]): void }>();

onMounted(() => {
  if (props.id) emit("viewed-ids", [props.id]);
});
</script>
