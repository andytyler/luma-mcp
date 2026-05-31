<script lang="ts">
  import { ENDPOINT, SITE } from "$lib/site.js";

  const linkClass = "font-bold text-foreground hover:text-ring hover:underline hover:underline-offset-3 inline-flex items-center gap-1.5";
  const githubIcon = "https://www.google.com/s2/favicons?sz=64&domain=github.com";
  const ajtIcon = "https://www.google.com/s2/favicons?sz=64&domain=ajt.dev";
</script>

<footer class="grid justify-items-center gap-2 text-center text-[13px] leading-[1.4] text-muted-foreground">
  <div class="flex flex-wrap items-center justify-center gap-2">
    <span>{SITE.footer.lead}</span>
    <a class={linkClass} href={SITE.footer.xUrl} target="_blank" rel="noreferrer">{SITE.footer.name}</a>
    <span aria-hidden="true">·</span>
    <a class={linkClass} href={SITE.footer.url} target="_blank" rel="noreferrer">
      <img src={ajtIcon} alt="" class="size-3.5 rounded-sm object-cover ring-1 ring-border/50" aria-hidden="true" />
      ajt.dev
    </a>
    <span aria-hidden="true">·</span>
    <a class={linkClass} href={ENDPOINT}>
      <span class="leading-none" aria-hidden="true">❇️</span>
      MCP endpoint
    </a>
    <span aria-hidden="true">·</span>
    <a class={linkClass} href={SITE.githubUrl}>
      <img src={githubIcon} alt="" class="size-3.5 rounded-sm object-cover ring-1 ring-border/50" aria-hidden="true" />
      GitHub source
    </a>
    <span aria-hidden="true">·</span>
    <span>{SITE.footer.program}</span>
  </div>
  <p class="text-[12px] text-muted-foreground/80">{SITE.disclaimer}</p>
</footer>
