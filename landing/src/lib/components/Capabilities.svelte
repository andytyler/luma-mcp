<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Tabs from "$lib/components/ui/tabs/index.js";
  import { ACTIONS, LUMA_TOOL_GLYPH } from "$lib/site.js";

  let selectedActionId = $state(ACTIONS[0].id);
</script>

<section class="grid w-full max-w-3xl justify-self-center gap-6" aria-labelledby="actions-heading">
  <div class="grid gap-2 text-left">
    <h2 id="actions-heading" class="m-0 text-[22px] font-bold text-foreground">What agents can do with Luma</h2>
    <p class="text-sm text-muted-foreground">{ACTIONS.length} tools your AI client can call — pick one to see what it does.</p>
  </div>

  <Tabs.Root
    value={selectedActionId}
    onValueChange={(value) => (selectedActionId = value)}
    orientation="vertical"
    class="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 max-[700px]:grid-cols-1 max-[700px]:gap-4">
    <div class="min-w-0 overflow-hidden rounded-xl bg-card shadow-lg ring-1 ring-foreground/5">
      <Tabs.List
        variant="default"
        class="h-fit max-h-[390px] w-full min-w-0 !items-stretch !justify-start space-y-0.5 overflow-y-auto bg-transparent p-3 text-left   max-[700px]:flex-col">
        {#each ACTIONS as action (action.id)}
          <Tabs.Trigger
            value={action.id}
            class="!h-8 !flex-none min-h-0 w-full justify-start gap-2 overflow-hidden rounded-sm border-0 px-3 py-1 text-left font-medium transition-all duration-150 hover:bg-accent/15 active:bg-accent/25 group-data-[variant=default]/tabs-list:data-active:shadow-none data-active:bg-accent/10 data-active:font-semibold data-active:text-foreground data-active:shadow-none data-active:before:opacity-100 data-focus-visible:bg-accent/15 data-focus-visible:text-foreground">
            <div class="flex min-w-0 w-full items-center gap-2">
              <span class="grid size-4 flex-none place-items-center text-[11px] leading-none" aria-hidden="true">{LUMA_TOOL_GLYPH}</span>
              <span class="grid min-w-0 w-full grid-cols-[1fr_auto] items-center gap-1.5">
                <span class="truncate text-[12px] font-medium leading-none text-foreground">{action.title}</span>
                <span class="max-w-[130px] justify-self-end truncate text-right text-[10.5px] leading-none text-muted-foreground">{action.id}</span>
              </span>
            </div>
          </Tabs.Trigger>
        {/each}
      </Tabs.List>
    </div>

    <Card.Root class="relative min-h-[390px] min-w-0 overflow-hidden rounded-xl border-0 bg-card p-2 shadow-lg ring-1 ring-foreground/5">
      <Card.Content class="px-5 py-4">
        {#each ACTIONS as action (action.id)}
          <Tabs.Content value={action.id} class="outline-none">
            <div class="space-y-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
              <div class="grid gap-0.5">
                <div class="flex items-start justify-between gap-3">
                  <div class="space-y-1">
                    <Card.Title class="text-lg font-semibold leading-tight">{action.title}</Card.Title>
                    <p class="text-[11px] font-medium tracking-wide text-muted-foreground">{action.id}</p>
                  </div>
                </div>
              </div>
              <p class="text-[14px] leading-relaxed text-muted-foreground">{action.description}</p>
            </div>
          </Tabs.Content>
        {/each}
      </Card.Content>
      <span class="absolute bottom-5 right-5 text-lg leading-none opacity-80" aria-hidden="true">{LUMA_TOOL_GLYPH}</span>
    </Card.Root>
  </Tabs.Root>
</section>
