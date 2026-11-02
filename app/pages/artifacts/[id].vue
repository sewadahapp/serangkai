<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">{{ artifact?.title || 'Loading...' }}</h1>
      <SButton v-if="artifact" :to="`/share/${artifact.slug}`" target="_blank">View Public</SButton>
    </div>
    
    <SCard v-if="artifact">
      <SCardHeader>
        <SCardTitle>Content</SCardTitle>
      </SCardHeader>
      <SCardContent>
        <div v-if="artifact.type === 'markdown'" class="prose max-w-none">
          <pre class="whitespace-pre-wrap">{{ content }}</pre>
        </div>
        <pre v-else class="whitespace-pre-wrap bg-muted p-4 rounded overflow-auto">{{ content }}</pre>
      </SCardContent>
    </SCard>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const artifact = ref(null)
const content = ref('')

onMounted(async () => {
  try {
    const res = await $fetch(`/api/artifacts/${route.params.id}`)
    artifact.value = res.artifact
    // We'd need to fetch content separately
    content.value = 'Content loading...'
  } catch (e) {
    console.error(e)
  }
})
</script>
