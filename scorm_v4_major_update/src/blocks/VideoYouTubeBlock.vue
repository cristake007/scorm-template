<template>
  <div class="scorm-card">
    <div v-if="title" class="scorm-h1 scorm-title-sm">{{ title }}</div>

    <!-- LINK MODE -->
    <template v-if="mode === 'link'">
      <div class="videoBlock__link">
        <img
          v-if="thumbnailUrl"
          :src="thumbnailUrl"
          alt=""
          class="videoBlock__thumb"
        />
        <div class="videoBlock__meta">
          <div class="scorm-muted videoBlock__hint">
            Opens YouTube in a new tab.
          </div>

          <v-btn :href="watchUrl" target="_blank" rel="noopener">
            Open on YouTube
          </v-btn>
        </div>
      </div>
    </template>

    <!-- EMBED MODE -->
    <template v-else>
      <div class="videoBlock__embed">
        <iframe
          :src="finalSrc"
          title="YouTube video player"
          class="videoBlock__frame"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerpolicy="strict-origin-when-cross-origin"
          allowfullscreen
          tabindex="-1"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  type: "video.youtube";
  id?: string;
  requiredView?: boolean;

  title?: string;
  mode?: "embed" | "link";

  videoId?: string;
  embedUrl?: string;
  url?: string;

  start?: number;
  privacyMode?: boolean;
}>();

const mode = computed(() => props.mode ?? "embed");

function tryExtractVideoIdFromUrl(input?: string): string {
  if (!input) return "";
  try {
    const u = new URL(input);
    const host = u.hostname.replace(/^www\./, "");

    // https://youtu.be/<id>
    if (host === "youtu.be") return (u.pathname.split("/").filter(Boolean)[0] ?? "").trim();

    // https://www.youtube.com/watch?v=<id>
    const v = u.searchParams.get("v");
    if (v) return v.trim();

    // https://www.youtube.com/embed/<id>
    const parts = u.pathname.split("/").filter(Boolean);
    const embedIdx = parts.indexOf("embed");
    if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1].trim();

    return "";
  } catch {
    return "";
  }
}

const derivedVideoId = computed(() => {
  return props.videoId || tryExtractVideoIdFromUrl(props.url) || tryExtractVideoIdFromUrl(props.embedUrl);
});

const watchUrl = computed(() => {
  if (props.url) return props.url;

  const vid = derivedVideoId.value;
  const u = new URL("https://www.youtube.com/watch");
  u.searchParams.set("v", vid);
  if (props.start) u.searchParams.set("t", `${Math.max(0, Math.floor(props.start))}s`);
  return u.toString();
});

const thumbnailUrl = computed(() => {
  const vid = derivedVideoId.value;
  return vid ? `https://i.ytimg.com/vi/${encodeURIComponent(vid)}/hqdefault.jpg` : "";
});

const finalSrc = computed(() => {
  if (props.embedUrl) return props.embedUrl;

  const vid = derivedVideoId.value;
  const host = props.privacyMode ? "https://www.youtube-nocookie.com" : "https://www.youtube.com";
  const u = new URL(`${host}/embed/${vid}`);

  u.searchParams.set("rel", "0");
  u.searchParams.set("modestbranding", "1");
  u.searchParams.set("playsinline", "1");

  u.searchParams.set("origin", window.location.origin);
  u.searchParams.set("enablejsapi", "1");

  if (props.start) u.searchParams.set("start", String(Math.max(0, Math.floor(props.start))));
  return u.toString();
});
</script>