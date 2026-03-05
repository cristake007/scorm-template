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

<style scoped>
.iconList__title { font-weight: 700; margin-bottom: 8px; font-size: 16px; }
.iconList__items { display: grid; gap: 10px; }

.iconList__row {
  display: grid;
  grid-template-columns: 34px 1fr;
  gap: 10px;
  align-items: center;
}

.iconList__icon {
  width: 28px;
  height: 28px;
  border-radius: 0;
  border: 0;
  display: grid;
  place-items: center;
  font-size: 14px;
}

.iconList__label { font-weight: 700; }
.iconList__sep { margin: 0 6px; }
</style>