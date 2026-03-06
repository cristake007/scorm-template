<!-- src/blocks/IconListBlock.vue -->
<template>
  <div class="iconList scorm-card">
    <div v-if="title" class="iconList__title">{{ title }}</div>

    <div class="iconList__items">
      <div v-for="(it, idx) in items" :key="it.id ?? idx" class="iconList__row">
        <div class="iconList__icon" aria-hidden="true">
          <span v-if="it.icon === 'book'">📘</span>
          <span v-else-if="it.icon === 'check'">✓</span>
          <span v-else-if="it.icon === 'info'">i</span>
          <span v-else>•</span>
        </div>

        <div class="iconList__text">
          <span class="iconList__label">{{ it.label }}</span>
          <span class="iconList__sep">:</span>
          <span class="iconList__body">{{ it.text }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
type IconListItem = {
  id?: string;
  icon?: "info" | "book" | "check" | "dot";
  label: string;
  text: string;
};

defineProps<{
  type: "iconList";
  id?: string;
  requiredView?: boolean;

  title?: string;
  items: IconListItem[];
}>();
</script>

