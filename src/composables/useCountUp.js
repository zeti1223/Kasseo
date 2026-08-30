import { ref, watch, onUnmounted } from "vue";

/**
 * Animates a displayed value from 0 (or its previous value) up to a
 * numeric target whenever the target changes, running `formatter` on
 * every animation frame to produce the string that should be shown.
 *
 * Respects `prefers-reduced-motion`: when the user has that set, the
 * value jumps straight to its final state instead of counting up.
 *
 * @param {import('vue').Ref<number>} targetRef
 * @param {(value: number) => string} formatter
 * @param {number} [duration] - animation duration in ms
 * @returns {import('vue').Ref<string>} the current display string
 */
export function useCountUp(targetRef, formatter, duration = 900) {
  const reduceMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const display = ref(formatter(0));
  let raf = null;
  let from = 0;

  function animateTo(to) {
    if (raf) cancelAnimationFrame(raf);
    const target = Number.isFinite(to) ? to : 0;

    if (reduceMotion) {
      display.value = formatter(target);
      from = target;
      return;
    }

    const start = performance.now();
    const startValue = from;
    const delta = target - startValue;

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      // ease-out cubic: quick start, gentle settle
      const eased = 1 - Math.pow(1 - progress, 3);
      display.value = formatter(startValue + delta * eased);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        from = target;
        raf = null;
      }
    }
    raf = requestAnimationFrame(tick);
  }

  watch(targetRef, (val) => animateTo(Number(val) || 0), { immediate: true });

  onUnmounted(() => {
    if (raf) cancelAnimationFrame(raf);
  });

  return display;
}
