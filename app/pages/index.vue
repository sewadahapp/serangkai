<template>
  <div class="space-y-8">
    <section class="text-center py-12">
      <h1 class="text-4xl font-bold mb-4">Serangkai</h1>
      <p class="text-xl text-muted-foreground mb-8">
        A production-minded, open-source, self-hosted artifact and knowledge workspace for AI agents and humans
      </p>
      <div class="flex gap-4 justify-center">
        <SButton to="/auth/register" size="lg">Get Started</SButton>
        <SButton to="/workspace" size="lg" variant="outline">Go to Workspace</SButton>
      </div>
    </section>
    
    <section class="grid md:grid-cols-3 gap-6">
      <SCard>
        <SCardHeader>
          <SCardTitle>Organize</SCardTitle>
        </SCardHeader>
        <SCardContent>
          <p>Nested folders, pages, and artifacts. Keep your knowledge organized like Notion.</p>
        </SCardContent>
      </SCard>
      <SCard>
        <SCardHeader>
          <SCardTitle>Interactive Artifacts</SCardTitle>
        </SCardHeader>
        <SCardContent>
          <p>Create and share interactive HTML, charts, diagrams, and web applications.</p>
        </SCardContent>
      </SCard>
      <SCard>
        <SCardHeader>
          <SCardTitle>Agent-Ready</SCardTitle>
        </SCardHeader>
        <SCardContent>
          <p>MCP and REST APIs let AI agents create, read, and update artifacts seamlessly.</p>
        </SCardContent>
      </SCard>
    </section>
  </div>
</template>
