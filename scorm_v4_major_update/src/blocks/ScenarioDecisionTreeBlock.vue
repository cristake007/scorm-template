<template>
  <div class="scorm-card scenarioTree">
    <div v-if="title" class="scorm-h2 scenarioTree__title">{{ title }}</div>
    <p class="scenarioTree__prompt">{{ prompt }}</p>

    <div class="scenarioTree__workflow">
      <div v-for="(step, index) in steps" :key="`${step.nodeId}-${index}`" class="scenarioTree__step">
        <div class="scenarioTree__questionCard">
          <div class="scenarioTree__nodeText">{{ step.nodeText }}</div>
        </div>

        <div class="scenarioTree__branchWrap" aria-hidden="true">
          <svg viewBox="0 0 100 44" preserveAspectRatio="none" class="scenarioTree__branches scenarioTree__branches--selected">
            <path :d="selectedConnectorPath(step)" />
          </svg>
          <v-icon
            icon="mdi-arrow-down-thin"
            class="scenarioTree__lineEndArrow"
            :style="selectedArrowStyle(step)"
            size="22"
          />
        </div>

        <div
          class="scenarioTree__choices scenarioTree__choices--split"
          :style="{ '--scenario-columns': Math.min(3, Math.max(1, step.branches.length)) }"
        >
          <div
            v-for="branch in step.branches"
            :key="branch.id"
            class="scenarioTree__branchCard"
            :class="[
              `is-${branch.outcome}`,
              { 'is-selected': branch.id === step.selectedChoiceId, 'is-dimmed': branch.id !== step.selectedChoiceId }
            ]"
          >
            <div class="scenarioTree__branchLabel">{{ branch.label }}</div>
            <div v-if="branch.id === step.selectedChoiceId" class="scenarioTree__feedback">
              {{ step.feedback }}
            </div>
          </div>
        </div>
      </div>

      <div v-if="currentNode" class="scenarioTree__step">
        <div class="scenarioTree__questionCard scenarioTree__questionCard--active">
          <div class="scenarioTree__nodeText">{{ currentNode.text }}</div>
        </div>

        <div
          class="scenarioTree__choices scenarioTree__choices--split"
          :style="{ '--scenario-columns': Math.min(3, Math.max(1, currentBranches.length)) }"
        >
          <v-btn
            v-for="choice in currentBranches"
            :key="choice.id"
            variant="outlined"
            color="primary"
            class="scenarioTree__choiceBtn"
            @click="pick(choice)"
          >
            {{ choice.label }}
          </v-btn>
        </div>
      </div>

      <div v-if="!currentNode && steps.length" class="scenarioTree__outcome">Scenario complete. Review your path above.</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

type ChoiceOutcome = "correct" | "wrong" | "neutral";

type ScenarioChoice = {
  id: string;
  label: string;
  feedback: string;
  nextNodeId?: string;
  outcome?: ChoiceOutcome;
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
const steps = ref<Array<{
  nodeId: string;
  nodeText: string;
  selectedChoiceId: string;
  feedback: string;
  branches: Array<{ id: string; label: string; outcome: ChoiceOutcome }>;
}>>([]);
const viewedSent = ref(false);

const currentNode = computed(() => props.nodes.find((n) => n.id === nodeId.value));
const currentBranches = computed(() => (currentNode.value ? branchChoices(currentNode.value.choices) : []));

function markViewed() {
  if (viewedSent.value || !props.id) return;
  viewedSent.value = true;
  emit("viewed-ids", [props.id]);
}

function detectOutcome(choice: ScenarioChoice): ChoiceOutcome {
  if (choice.outcome) return choice.outcome;

  const feedback = choice.feedback.toLowerCase();
  if (["wrong", "incorrect", "not recommended", "not ideal", "avoid", "high risk", "risk increases"].some((token) => feedback.includes(token))) {
    return "wrong";
  }
  if (["correct", "great", "excellent", "good"].some((token) => feedback.includes(token))) {
    return "correct";
  }
  return "neutral";
}

function branchChoices(choices: ScenarioChoice[]): ScenarioChoice[] {
  return choices.slice(0, 3);
}

function selectedConnectorX(step: { selectedChoiceId: string; branches: Array<{ id: string }> }) {
  const total = Math.max(1, Math.min(3, step.branches.length));
  const selectedIndex = Math.max(0, step.branches.findIndex((branch) => branch.id === step.selectedChoiceId));
  const clamped = Math.min(selectedIndex, total - 1);
  return ((clamped + 0.5) * 100) / total;
}

function selectedConnectorPath(step: { selectedChoiceId: string; branches: Array<{ id: string }> }) {
  const x = selectedConnectorX(step);
  return `M50 2 L50 16 L${x} 16 L${x} 38`;
}

function selectedArrowStyle(step: { selectedChoiceId: string; branches: Array<{ id: string }> }) {
  const x = selectedConnectorX(step);
  return { left: `${x}%` };
}

function pick(choice: ScenarioChoice) {
  const node = currentNode.value;
  if (!node) return;

  const branches = branchChoices(node.choices).map((branch) => ({
    id: branch.id,
    label: branch.label,
    outcome: detectOutcome(branch)
  }));

  steps.value.push({
    nodeId: node.id,
    nodeText: node.text,
    selectedChoiceId: choice.id,
    feedback: choice.feedback,
    branches
  });

  markViewed();
  if (choice.nextNodeId) {
    nodeId.value = choice.nextNodeId;
    return;
  }

  nodeId.value = "";
}
</script>
