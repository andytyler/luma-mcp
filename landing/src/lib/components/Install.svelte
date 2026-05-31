<script lang="ts">
  import * as Tabs from "$lib/components/ui/tabs/index.js";
  import { AGENTS, ENDPOINT, LOCAL_ENDPOINT, PACKAGE_MANAGERS, SITE, buildLocalSetup, type PackageManager } from "$lib/site.js";
  import { Check, Copy } from "@lucide/svelte";
  import type { Attachment } from "svelte/attachments";
  import { prefersReducedMotion } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { slide } from "svelte/transition";

  type Mode = "hosted" | "local";

  // Motion that collapses to instant when the user prefers reduced motion.
  const reveal = $derived({ duration: prefersReducedMotion.current ? 0 : 240, easing: cubicOut });

  // Smoothly tween a wrapper's height to its content as the command/config changes.
  const animatedHeight: Attachment<HTMLElement> = (node) => {
    const inner = node.firstElementChild as HTMLElement | null;
    if (!inner) return;
    node.style.overflow = "hidden";
    node.style.height = `${inner.offsetHeight}px`;
    const ro = new ResizeObserver(() => {
      node.style.transition = prefersReducedMotion.current ? "none" : "height 280ms cubic-bezier(0.22, 1, 0.36, 1)";
      node.style.height = `${inner.offsetHeight}px`;
    });
    ro.observe(inner);
    return () => ro.disconnect();
  };

  let { value = $bindable(AGENTS[0].name) }: { value?: string } = $props();

  let mode = $state<Mode>("hosted");
  let pm = $state<PackageManager>("bun");
  let copiedKey = $state<string | null>(null);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  const agent = $derived(AGENTS.find((a) => a.name === value) ?? AGENTS[0]);
  const endpoint = $derived(mode === "local" ? LOCAL_ENDPOINT : ENDPOINT);
  const command = $derived(agent.build(endpoint));
  // Preserve indentation for JSON configs; wrap long single-line commands/URLs.
  const codeWrap = $derived(agent.language === "json" ? "whitespace-pre" : "whitespace-pre-wrap break-all");

  const setupSteps = $derived(buildLocalSetup(pm));
  const setupScript = $derived(setupSteps.map((s) => s.command).join("\n"));

  // Shared, token-based styling so colours stay uniform across the section.
  const segmented = "inline-flex flex-none gap-1 rounded-xl border border-border bg-card p-1 shadow-sm";
  const segmentedItem =
    "h-7 rounded-lg px-4 font-mono text-[11.25px] font-semibold uppercase tracking-wide text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  const terminal = "relative overflow-hidden rounded-xl bg-popover shadow-lg ring-1 ring-foreground/5";
  const terminalCopy =
    "absolute right-2.5 top-2.5 z-10 inline-flex size-8 items-center justify-center rounded-lg border border-popover-foreground/15 bg-popover-foreground/5 text-popover-foreground/70 transition-colors hover:border-accent/60 hover:bg-popover-foreground/10 hover:text-popover-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

  async function copyText(text: string, key: string) {
    copiedKey = key;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => (copiedKey = null), 1800);

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.append(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      } catch {
        // Keep the click feedback even if the browser blocks clipboard access.
      }
    }
  }

  function resetCopiedKey() {
    clearTimeout(copyTimer);
    copiedKey = null;
  }
</script>

<section id="install" class="grid w-full max-w-3xl scroll-mt-12 justify-self-center gap-6" aria-labelledby="install-heading">
  <div class="flex items-center justify-between gap-4 max-[620px]:flex-col max-[620px]:items-start max-[620px]:gap-3">
    <div class="grid gap-2 text-left">
      <h2 id="install-heading" class="m-0 text-[22px] font-bold text-foreground">Quick install</h2>
      {#if mode === "hosted"}
        <p class="text-sm text-muted-foreground">Connect to the hosted server and copy the matching setup value.</p>
      {/if}
    </div>

    <!-- hosted / local mode toggle -->
    <div class={segmented} role="group" aria-label="Installation type">
      {#each [{ id: "hosted", label: "Hosted" }, { id: "local", label: "Local" }] as opt (opt.id)}
        <button
          type="button"
          aria-pressed={mode === opt.id}
          onclick={() => {
            mode = opt.id as Mode;
            resetCopiedKey();
          }}
          class="{segmentedItem} aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:shadow-sm">
          {opt.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- local server setup (run once) -->
  {#if mode === "local"}
    <div class="grid gap-2" transition:slide={reveal}>
      <div class="flex items-center justify-between gap-3 px-1">
        <span class="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">1 · Run the server</span>
        <div class="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground" role="group" aria-label="Package manager">
          {#each PACKAGE_MANAGERS as p, i (p)}
            {#if i > 0}<span class="text-muted-foreground/40" aria-hidden="true">·</span>{/if}
            <button
              type="button"
              aria-pressed={pm === p}
              onclick={() => {
                pm = p;
                resetCopiedKey();
              }}
              class="rounded-sm outline-none transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-pressed:font-semibold aria-pressed:text-foreground">
              {p}
            </button>
          {/each}
        </div>
      </div>
      <div class={terminal}>
        <button
          class={terminalCopy}
          type="button"
          aria-label="Copy all setup commands"
          title={copiedKey === "setup" ? "Copied" : "Copy all setup commands"}
          onclick={() => copyText(setupScript, "setup")}>
          {#if copiedKey === "setup"}<Check class="size-4 text-popover-foreground" strokeWidth={2.6} />{:else}<Copy class="size-4" strokeWidth={2.4} />{/if}
        </button>
        <div class="grid gap-2.5 px-5 py-4 pr-12 font-mono text-[12px] leading-relaxed text-popover-foreground max-[620px]:px-4 max-[620px]:text-[11px]">
          {#each setupSteps as step (step.label)}
            <div class="grid gap-0.5">
              <span class="select-none text-popover-foreground/55"># {step.label}</span>
              <code class="block min-w-0 overflow-x-auto whitespace-pre-wrap break-all">
                <span class="select-none pr-2.5 text-popover-foreground/55">$</span><span>{step.command}</span>
              </code>
            </div>
          {/each}
        </div>
      </div>
      <p class="px-1 text-[13px] leading-relaxed text-muted-foreground">
        The server starts at <span class="font-mono text-foreground">http://localhost:3000</span>. Keep it running, then connect your client below.
      </p>
    </div>
  {/if}

  <div class="grid gap-2">
    {#if mode === "local"}
      <span class="px-1 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground" transition:slide={reveal}>
        2 · Connect your client
      </span>
    {/if}

    <Tabs.Root
      {value}
      onValueChange={(nextValue) => {
        value = nextValue;
        resetCopiedKey();
      }}
      class="gap-4">
    <Tabs.List class="flex h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0 max-[620px]:gap-1.5">
      {#each AGENTS as a (a.name)}
        <Tabs.Trigger
          value={a.name}
          class="h-9 flex-none gap-2 rounded-full border border-border bg-card pl-1.5 pr-4 text-[13px] font-semibold text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground data-active:border-transparent data-active:bg-accent data-active:text-accent-foreground data-active:hover:bg-accent data-active:hover:text-accent-foreground">
          <span class="grid size-6 flex-none place-items-center overflow-hidden rounded-full bg-card ring-1 ring-inset ring-border/60">
            <img class="size-full object-cover" src={a.iconUrl} alt="" width="24" height="24" decoding="async" />
          </span>
          <span>{a.name}</span>
        </Tabs.Trigger>
      {/each}
    </Tabs.List>

    <!-- command / config block -->
    <div class={terminal}>
      <button
        class={terminalCopy}
        type="button"
        aria-label={`Copy ${agent.name} install command`}
        title={copiedKey === "client" ? "Copied" : `Copy ${agent.name} install command`}
        onclick={() => copyText(command, "client")}>
        {#if copiedKey === "client"}
          <Check class="size-4 text-popover-foreground" strokeWidth={2.6} />
        {:else}
          <Copy class="size-4" strokeWidth={2.4} />
        {/if}
      </button>
      <div {@attach animatedHeight}>
        <div>
          <code
            class="block min-w-0 overflow-x-auto px-5 py-4 pr-12 font-mono text-[12px] leading-relaxed text-popover-foreground {codeWrap} max-[620px]:px-4 max-[620px]:text-[11px]">{#if agent.language === "shell"}<span class="select-none pr-2.5 text-popover-foreground/55">$</span>{/if}{command}</code>
        </div>
      </div>
    </div>
  </Tabs.Root>

    <span class="sr-only" aria-live="polite">{copiedKey ? "Copied to clipboard" : ""}</span>

    <p class="px-1 text-[13px] leading-relaxed text-muted-foreground">
      {agent.note}
      {#if mode === "local"}
        Complete the OAuth prompt and paste your key when asked.
      {/if}
      Needs Node 18+ and a
      <a
        href={SITE.lumaApiDocsUrl}
        target="_blank"
        rel="noreferrer"
        class="font-medium text-foreground underline decoration-muted-foreground/40 underline-offset-2 transition-colors hover:text-ring hover:decoration-ring">Luma API key</a>.
    </p>
  </div>
</section>
