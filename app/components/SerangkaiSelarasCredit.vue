<template>
  <SButton
    to="https://selarasui.my.id"
    target="_blank"
    rel="noopener noreferrer"
    variant="link"
    color="neutral"
    aria-label="Powered by Selaras (opens in a new tab)"
    :ui="{ base: 'h-auto justify-start gap-2 px-2.5 py-1 text-[0.6875rem] font-normal text-[var(--selaras-resolved-text-muted)] hover:text-[var(--selaras-resolved-text-default)]' }"
  >
    <span class="selaras-credit-mark" aria-hidden="true" />
    <span>Powered by Selaras</span>
    <SIcon name="lucide:arrow-up-right" class="size-3 opacity-70" aria-hidden="true" />
  </SButton>
</template>

<style scoped>
/* Official small-size artwork from https://selarasui.my.id/design-kit.
   MIT, Copyright (c) 2026 Sewadah; covered by the repository LICENSE. */
.selaras-credit-mark { width: 1rem; height: 1rem; flex-shrink: 0; background-color: var(--selaras-resolved-color-primary-text); mask: url('/brand/selaras-symbol-small.svg') center / contain no-repeat; }
</style>
