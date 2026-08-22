<script setup>
import { computed } from "vue";
import { useTranslation } from "i18next-vue";

const { i18next } = useTranslation();

const commitHash =
  typeof __APP_COMMIT_HASH__ !== "undefined" ? __APP_COMMIT_HASH__ : "";
const commitDate =
  typeof __APP_COMMIT_DATE__ !== "undefined" ? __APP_COMMIT_DATE__ : "";
const repoUrl =
  typeof __APP_REPO_URL__ !== "undefined"
    ? __APP_REPO_URL__
    : "https://github.com/zeti1223/Kasseo";

const commitUrl = computed(() => {
  if (!commitHash || commitHash === "dev") return "";
  return `${repoUrl}/commit/${commitHash}`;
});

const formattedFullDate = computed(() => {
  if (!commitDate) return "";
  const d = new Date(commitDate);
  return isNaN(d.getTime()) ? "" : d.toLocaleString();
});

const timeAgo = computed(() => {
  if (!commitDate) return "";
  const date = new Date(commitDate);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  const lang = i18next.language || "en";

  if (diffInSeconds < 45) {
    return lang === "hu"
      ? "épp most"
      : lang === "de"
        ? "gerade eben"
        : lang === "fr"
          ? "à l'instant"
          : lang === "es"
            ? "justo ahora"
            : lang === "zh"
              ? "刚刚"
              : "just now";
  }

  try {
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return rtf.format(-diffInMinutes, "minute");

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return rtf.format(-diffInHours, "hour");

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return rtf.format(-diffInDays, "day");

    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) return rtf.format(-diffInMonths, "month");

    const diffInYears = Math.floor(diffInDays / 365);
    return rtf.format(-diffInYears, "year");
  } catch {
    return "";
  }
});
</script>

<template>
  <footer
    v-if="commitHash"
    class="py-4 px-4 text-center text-xs text-gray-500 dark:text-gray-500 opacity-20 hover:opacity-100 dark:hover:opacity-75 transition-opacity duration-200 select-none"
  >
    <div class="flex items-center justify-center gap-1 flex-wrap">
      <span>{{ $t("footer.build") }}</span>
      <a
        v-if="commitUrl"
        :href="commitUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="font-mono underline hover:text-primary dark:hover:text-primary transition-colors"
        :title="formattedFullDate"
      >
        {{ commitHash }}
      </a>
      <span v-else class="font-mono">{{ commitHash }}</span>
      <template v-if="timeAgo">
        <span>{{ $t("footer.from") }}</span>
        <span>{{ timeAgo }}.</span>
      </template>
    </div>
  </footer>
</template>
