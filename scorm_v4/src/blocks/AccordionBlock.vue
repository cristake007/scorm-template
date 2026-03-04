<template>
  <div class="scorm-card">
    <div v-if="title" class="scorm-h2" style="margin-bottom: 10px">{{ title }}</div>

    <v-expansion-panels variant="accordion" multiple>
      <v-expansion-panel
        v-for="(it, idx) in items"
        :key="it.id || idx"
        @group:selected="(val:any) => onPanelSelected(val, it, idx)"
      >
        <v-expansion-panel-title>
          {{ it.title }}
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <div class="scorm-body" style="white-space: pre-wrap">{{ it.body }}</div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

type Item = { id?: string; title: string; body: string };

const props = defineProps<{
  id?: string;
  title?: string;
  items: Item[];
}>();

const emit = defineEmits<{
  (e: "viewed-ids", ids: string[]): void;
}>();

const opened = ref<Set<string>>(new Set());

function itemTrackId(it: Item, idx: number) {
  // courseLoader will normalize item ids, but keep a fallback
  return it.id || `${props.id || "accordion"}::item::${idx + 1}`;
}

function onPanelSelected(val: any, it: Item, idx: number) {
  // When a panel becomes selected/open, mark as viewed
  const isOpen = !!val;
  if (!isOpen) return;

  const trackId = itemTrackId(it, idx);
  if (opened.value.has(trackId)) return;

  opened.value.add(trackId);
  emit("viewed-ids", [trackId]);
}
</script>