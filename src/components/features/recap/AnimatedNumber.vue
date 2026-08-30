<script setup>
import { toRef } from "vue";
import { useCountUp } from "@/composables/useCountUp";

const props = defineProps({
  target: { type: Number, required: true },
  formatter: { type: Function, required: true },
  duration: { type: Number, default: 1000 },
});

const targetRef = toRef(props, "target");
const display = useCountUp(targetRef, props.formatter, props.duration);
</script>

<template>
  <span class="money">{{ display }}</span>
</template>
