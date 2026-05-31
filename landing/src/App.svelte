<script lang="ts">
  import Capabilities from "$lib/components/Capabilities.svelte";
  import Hero from "$lib/components/Hero.svelte";
  import Install from "$lib/components/Install.svelte";
  import { AGENT_BACKGROUND_VARIANTS } from "$lib/components/luma-backgrounds/agent-backgrounds.js";
  import LumaEventBackground from "$lib/components/luma-backgrounds/LumaEventBackground.svelte";
  import Nav from "$lib/components/Nav.svelte";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import { AGENTS, SITE } from "$lib/site.js";

  let selectedAgent = $state(AGENTS[0].name);
  const backgroundVariant = $derived(AGENT_BACKGROUND_VARIANTS[selectedAgent] ?? "serpent");
</script>

<svelte:head>
  <title>{SITE.productName} · Install</title>
</svelte:head>

<main class="relative isolate min-h-dvh overflow-hidden bg-background text-foreground antialiased">
  <LumaEventBackground variant={backgroundVariant} class="absolute inset-x-0 top-0 z-0 h-[930px] max-[760px]:h-[780px]" />

  <a
    class="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
    href="#install">
    Skip to install
  </a>

  <div class="relative z-10 mx-auto grid min-h-dvh w-[calc(100%_-_40px)] max-w-[1140px] grid-rows-[auto_1fr_auto] py-[34px] max-[760px]:w-[calc(100%_-_28px)] max-[760px]:pt-5">
    <Nav />

    <div class="grid content-center justify-items-center gap-16 py-16 max-[760px]:gap-12 max-[760px]:py-10">
      <Hero />
      <Install bind:value={selectedAgent} />
      <Capabilities />
    </div>

    <SiteFooter />
  </div>
</main>
