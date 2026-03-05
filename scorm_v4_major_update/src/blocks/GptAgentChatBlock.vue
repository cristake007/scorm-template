<template>
  <div class="scorm-card gptChat">
    <div v-if="title" class="scorm-h2 gptChat__title">{{ title }}</div>

    <div class="gptChat__messages">
      <div v-for="(msg, idx) in visibleMessages" :key="`${msg.role}-${idx}`" class="gptChat__row" :class="`gptChat__row--${msg.role}`">
        <div class="gptChat__bubble" :class="`gptChat__bubble--${msg.role}`">
          {{ msg.text }}
        </div>
      </div>
    </div>

    <div v-if="nextUserReplyLabel" class="gptChat__actions">
      <v-btn color="primary" variant="tonal" @click="onSimulateUserReply">{{ nextUserReplyLabel }}</v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

type GptTurn = {
  agent: string;
  userReply?: string;
  userReplyLabel?: string;
};

type VisibleMessage = { role: "agent" | "user"; text: string };

const props = defineProps<{
  id?: string;
  type: "agent.gptChat";
  title?: string;
  typingSpeedMs?: number;
  turns: GptTurn[];
}>();

const emit = defineEmits<{ (e: "viewed-ids", ids: string[]): void }>();

const visibleMessages = ref<VisibleMessage[]>([]);
const currentTurn = ref(0);
const completed = ref(false);

const typingSpeed = computed(() => Math.max(8, props.typingSpeedMs ?? 22));

const nextUserReplyLabel = computed(() => {
  const turn = props.turns[currentTurn.value];
  if (!turn?.userReply) return "";
  return turn.userReplyLabel || "Simulate user reply";
});

function markViewedOnce() {
  if (completed.value) return;
  completed.value = true;
  if (props.id) emit("viewed-ids", [props.id]);
}

function typeAgentMessage(text: string, onDone: () => void) {
  const row: VisibleMessage = { role: "agent", text: "" };
  visibleMessages.value.push(row);

  let i = 0;
  const tick = () => {
    i += 1;
    row.text = text.slice(0, i);
    if (i < text.length) {
      window.setTimeout(tick, typingSpeed.value);
      return;
    }
    onDone();
  };

  tick();
}

function playCurrentTurn() {
  const turn = props.turns[currentTurn.value];
  if (!turn) {
    markViewedOnce();
    return;
  }

  typeAgentMessage(turn.agent, () => {
    if (!turn.userReply) {
      currentTurn.value += 1;
      playCurrentTurn();
    }
  });
}

function onSimulateUserReply() {
  const turn = props.turns[currentTurn.value];
  if (!turn?.userReply) return;

  visibleMessages.value.push({ role: "user", text: turn.userReply });
  currentTurn.value += 1;
  playCurrentTurn();
}

onMounted(() => {
  playCurrentTurn();
});
</script>
