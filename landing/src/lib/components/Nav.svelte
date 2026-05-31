<script lang="ts">
  import { NAV_LINKS, SITE } from "$lib/site.js";
  import { ArrowUpRight } from "@lucide/svelte";
  import Logo from "./Logo.svelte";
</script>

<nav class="flex items-center justify-between gap-6" aria-label="Primary navigation">
  <a class="group inline-flex items-center gap-2.5 text-[15px] font-bold tracking-tight text-foreground" href="/" aria-label="{SITE.productName} home">
    <Logo class="h-7 w-7 transition-transform duration-300 ease-out group-hover:rotate-[20deg]" />
    <span>{SITE.productName}</span>
  </a>

  <div class="flex items-center gap-6 text-[13px] font-semibold max-[640px]:gap-5">
    {#each NAV_LINKS as link (link.label)}
      <a
        href={link.href}
        target="_blank"
        rel="noreferrer"
        class="group/link relative inline-flex items-center gap-0.5 py-1 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground {link.label ===
        'Endpoint'
          ? 'max-[640px]:hidden'
          : ''}">
        <span>{link.label}</span>
        <ArrowUpRight
          class="size-3.5 -translate-x-1 opacity-0 transition-all duration-200 ease-out group-hover/link:translate-x-0 group-hover/link:opacity-100 group-focus-visible/link:translate-x-0 group-focus-visible/link:opacity-100"
          strokeWidth={2.4}
          aria-hidden="true" />
        <span
          class="absolute -bottom-0.5 left-0 h-0.5 w-full origin-left scale-x-0 rounded-full bg-accent transition-transform duration-200 ease-out group-hover/link:scale-x-100 group-focus-visible/link:scale-x-100"
          aria-hidden="true"></span>
      </a>
    {/each}
  </div>
</nav>
