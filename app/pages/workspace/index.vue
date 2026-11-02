<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">Workspace</h1>
      <div class="flex gap-2">
        <SButton @click="showNewFolder = true">New Folder</SButton>
        <SButton @click="showNewArtifact = true">New Artifact</SButton>
      </div>
    </div>
    
    <div class="grid md:grid-cols-4 gap-6">
      <aside class="md:col-span-1">
        <SCard>
          <SCardHeader>
            <SCardTitle>Folders</SCardTitle>
          </SCardHeader>
          <SCardContent>
            <div class="space-y-1">
              <div v-for="folder in folders" :key="folder.id" class="p-2 hover:bg-accent rounded cursor-pointer">
                {{ folder.name }}
              </div>
              <div v-if="folders.length === 0" class="text-sm text-muted-foreground">No folders</div>
            </div>
          </SCardContent>
        </SCard>
      </aside>
      
      <main class="md:col-span-3">
        <SCard>
          <SCardHeader>
            <SCardTitle>Artifacts</SCardTitle>
          </SCardHeader>
          <SCardContent>
            <div class="space-y-2">
              <NuxtLink v-for="artifact in artifacts" :key="artifact.id" :to="`/artifacts/${artifact.id}`" 
                class="block p-4 border rounded hover:bg-accent">
                <div class="flex justify-between">
                  <div>
                    <h3 class="font-semibold">{{ artifact.title }}</h3>
                    <p class="text-sm text-muted-foreground">{{ artifact.type }} • {{ artifact.visibility }}</p>
                  </div>
                </div>
              </NuxtLink>
              <div v-if="artifacts.length === 0" class="text-center text-muted-foreground py-8">
                No artifacts yet. Create your first artifact!
              </div>
            </div>
          </SCardContent>
        </SCard>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
const folders = ref([])
const artifacts = ref([])

onMounted(async () => {
  try {
    const [foldersRes, artifactsRes] = await Promise.all([
      $fetch('/api/folders'),
      $fetch('/api/artifacts')
    ])
    folders.value = foldersRes.folders || []
    artifacts.value = artifactsRes.artifacts || []
  } catch (e) {
    console.error(e)
  }
})

const showNewFolder = ref(false)
const showNewArtifact = ref(false)
</script>
