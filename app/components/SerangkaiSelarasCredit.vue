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
    <SerangkaiSelarasMark class="text-[var(--selaras-resolved-color-primary-text)]" />
    <span>Powered by Selaras</span>
    <SIcon name="lucide:arrow-up-right" class="size-3 opacity-70" aria-hidden="true" />
  </SButton>
</template>
