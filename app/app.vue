<template>
  <SApp>
    <SerangkaiRouteProgress />
    <NuxtLayout>
      <NuxtErrorBoundary ref="errorBoundary" @error="onPageError">
        <NuxtPage />

        <template #error="{ error, clearError }">
          <SerangkaiErrorState
            title="This page hit an unexpected error"
            description="The rest of the app is still available. Try loading this page again, or go back to the workspace."
            :detail="pageErrorDetail(error)"
            retry-label="Try again"
            @retry="clearError"
          >
            <template #actions>
              <SButton variant="ghost" icon="lucide:arrow-left" @click="goToWorkspace">Back to workspace</SButton>
            </template>
          </SerangkaiErrorState>
        </template>
      </NuxtErrorBoundary>
    </NuxtLayout>
    <ClientOnly>
      <SToast />
    </ClientOnly>
  </SApp>
</template>

<script setup lang="ts">
const errorBoundary = ref<{ clearError: () => void }>()
const router = useRouter()

// A boundary error belongs to the route that produced it. Without this, the
// fallback would stay on screen after the next navigation and block the app.
router.afterEach(() => errorBoundary.value?.clearError())

const onPageError = (error: unknown) => {
  console.error('[serangkai] Page error:', error)
}

const pageErrorDetail = (error: unknown) => {
  if (!import.meta.dev) return ''
  return error instanceof Error ? error.message : String(error || '')
}

const goToWorkspace = async () => {
  errorBoundary.value?.clearError()
  await navigateTo('/workspace')
}
</script>
