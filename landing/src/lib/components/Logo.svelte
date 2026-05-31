<script lang="ts">
  import { cn } from "$lib/utils.js";

  // `variant` kept for backwards-compatible call sites; the mark is now the brand emoji.
  type LogoVariant = "plain" | "sparkle";

  let { class: className, variant: _variant = "sparkle" }: { class?: string; variant?: LogoVariant } = $props();
</script>

<span class={cn("inline-grid shrink-0 place-items-center leading-none", className)} aria-hidden="true">
  <svg class="h-full w-full" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <text x="16" y="17" font-size="27" text-anchor="middle" dominant-baseline="central">❇️</text>
  </svg>
</span>
