<template>
  <AppShell
    :course-title="courseTitle"
    :course-version="courseVersion"
    :nav="nav"
    :locked-message="lockedMessage"
    :logo-url="logoUrl"
  />
</template>

<script setup lang="ts">
import AppShell from "./app/AppShell.vue";
import logoUrl from "./assets/images/logo.svg";
import type { NavLesson } from "./engine/navigation/navModel";

defineProps<{
  courseTitle: string;
  courseVersion: string;
  nav: NavLesson[];
  lockedMessage: string;
}>();
</script>