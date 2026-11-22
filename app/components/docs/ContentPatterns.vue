<script setup lang="ts">
const steps = [
  {
    title: 'Add a Markdown file',
    description: 'Create a page under the content directory.',
  },
  {
    title: 'Write the page',
    description: 'Add frontmatter, headings, examples, and links.',
  },
  {
    title: 'Publish your docs',
    description: 'Build the site and deploy it to your preferred host.',
  },
]

const fileTree = [
  {
    name: 'content/',
    children: [
      { name: 'index.md', language: 'markdown', code: '# Welcome\n\nStart here.' },
      {
        name: 'guide/',
        children: [
          { name: 'getting-started.md', language: 'markdown', code: '# Getting started' },
          { name: 'writing-content.md', language: 'markdown', code: '# Writing content' },
        ],
      },
      {
        name: 'reference/',
        children: [
          { name: 'api.md', language: 'markdown', code: '# API reference' },
        ],
      },
    ],
  },
]
</script>

<template>
  <div class="space-y-8">
    <section class="space-y-3">
      <h2>Link cards</h2>
      <SCardGroup :cols="2">
        <SCard>
          <template #header>
            <h3>Guides</h3>
          </template>
          <p>Organize instructions into short, task-focused pages.</p>
          <NuxtLink to="/guide/getting-started">Read the getting started guide →</NuxtLink>
        </SCard>
        <SCard>
          <template #header>
            <h3>Reference</h3>
          </template>
          <p>Use structured pages for endpoint details and response examples.</p>
          <NuxtLink to="/reference/api">Browse the API reference →</NuxtLink>
        </SCard>
      </SCardGroup>
    </section>

    <section class="space-y-3">
      <h2>Guided steps</h2>
      <SStepper :items="steps" :default-value="1" />
    </section>

    <section class="space-y-3">
      <h2>File tree</h2>
      <SCodeTree :items="fileTree" />
    </section>
  </div>
</template>
