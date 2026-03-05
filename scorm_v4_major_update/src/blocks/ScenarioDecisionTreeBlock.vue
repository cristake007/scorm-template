<template>
  <div class="scorm-card scenarioTree">
    <div v-if="title" class="scorm-h2 scenarioTree__title">{{ title }}</div>
    <p class="scenarioTree__prompt">{{ prompt }}</p>

    <div class="scenarioTree__node">
      <div class="scenarioTree__nodeText">{{ currentNode?.text }}</div>

      <div class="scenarioTree__choices">
        <v-btn
          v-for="choice in currentNode?.choices ?? []"
          :key="choice.id"
          variant="tonal"
          color="primary"
          class="scenarioTree__choiceBtn"
          @click="pick(choice)"
        >
          {{ choice.label }}
        </v-btn>
      </div>

      <div v-if="feedback" class="scenarioTree__feedback">{{ feedback }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

type ScenarioChoice = {
  id: string;
  label: string;
  feedback: string;
  nextNodeId?: string;
};

type ScenarioNode = {
  id: string;
  text: string;
  choices: ScenarioChoice[];
};

const props = defineProps<{
  id?: string;
  type: "scenario.decisionTree";
  title?: string;
  prompt: string;
  startNodeId?: string;
  nodes: ScenarioNode[];
}>();

const emit = defineEmits<{ (e: "viewed-ids", ids: string[]): void }>();

const nodeId = ref(props.startNodeId || props.nodes[0]?.id || "");
const feedback = ref("");
const viewedSent = ref(false);

const currentNode = computed(() => props.nodes.find((n) => n.id === nodeId.value));

function markViewed() {
  if (viewedSent.value || !props.id) return;
  viewedSent.value = true;
  emit("viewed-ids", [props.id]);
}

function pick(choice: ScenarioChoice) {
  feedback.value = choice.feedback;
  markViewed();
  if (choice.nextNodeId) {
    nodeId.value = choice.nextNodeId;
  }
}
</script>
