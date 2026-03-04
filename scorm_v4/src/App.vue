<template>
  <AppShell
    :course-title="courseTitle"
    :course-version="courseVersion"
    :nav="nav"
    :locked-message="lockedMessage"
    @exit="exit"
  />
</template>

<script setup lang="ts">
import AppShell from "./app/AppShell.vue";
import type { NavLesson } from "./engine/navigation/navModel";

defineProps<{
  courseTitle: string;
  courseVersion: string;
  nav: NavLesson[];
  lockedMessage: string;
  exit: () => void;
}>();
</script>