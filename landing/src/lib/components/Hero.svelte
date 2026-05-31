<script lang="ts">
  import { SITE } from "$lib/site.js";
  import Logo from "./Logo.svelte";
</script>

<section class="grid justify-items-center gap-7 text-center max-[760px]:gap-5" aria-labelledby="hero-heading">
  <Logo variant="sparkle" class="h-16 w-16" />
  <div class="max-w-[860px]">
    <h1
      id="hero-heading"
      class="m-0 max-w-[840px] text-balance text-[clamp(44px,5.5vw,76px)] font-bold leading-[1.02] text-foreground max-[760px]:text-[clamp(40px,13.2vw,54px)]">
      {SITE.headline}
    </h1>
    <p class="mx-auto mt-5 max-w-[690px] text-pretty text-[17px] leading-[1.6] text-muted-foreground max-[760px]:text-base">
      {SITE.description}
    </p>
  </div>
</section>
