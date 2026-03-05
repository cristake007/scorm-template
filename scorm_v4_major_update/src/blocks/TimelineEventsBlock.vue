<template>
  <div class="scorm-card timelineBlock" :class="`timelineBlock--${orientation || 'vertical'}`">
    <div v-if="title" class="scorm-h2 timelineBlock__title">{{ title }}</div>

    <div class="timelineBlock__list">
      <article v-for="(item, idx) in items" :key="item.id || idx" class="timelineBlock__item">
        <div class="timelineBlock__dot" aria-hidden="true"></div>
        <div class="timelineBlock__content">
          <div class="timelineBlock__meta" v-if="item.date">{{ item.date }}</div>
          <div class="timelineBlock__heading">{{ item.title }}</div>
          <p class="timelineBlock__desc">{{ item.description }}</p>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  id?: string;
  type: "timeline.events";
  title?: string;
  orientation?: "vertical" | "horizontal";
  items: Array<{ id?: string; title: string; date?: string; description: string }>;
}>();
</script>
