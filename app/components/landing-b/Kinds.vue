<script setup lang="ts">
const plates = [
  {
    fig: 1, kind: 'report', title: 'Q3 revenue review', meta: 'Markdown',
    name: 'Reports and documents',
    body: 'Headings, tables, callouts, cards, tabs, and timelines render finished, with no CSS from the author.',
    detail: 'type: markdown',
    span: 'wide', rot: '-1.2deg',
  },
  {
    fig: 2, kind: 'chart', title: 'Weekly signups', meta: 'Chart',
    name: 'Declarative charts',
    body: 'Bar, line, and area charts from a small JSON block inside Markdown. No chart code to ship.',
    detail: 'tanstack chart JSON',
    span: 'narrow', rot: '1.4deg',
  },
  {
    fig: 3, kind: 'diagram', title: 'Ingest pipeline', meta: 'Mermaid',
    name: 'Diagrams',
    body: 'Flowcharts, sequence, architecture, and state diagrams, written as Mermaid text.',
    detail: '```mermaid',
    span: 'narrow', rot: '1deg',
  },
  {
    fig: 4, kind: 'app', title: 'Seat estimator', meta: 'HTML', status: 'Sandboxed',
    name: 'Your own HTML and JavaScript',
    body: 'Custom dashboards and small tools run in a sandboxed iframe with a restrictive CSP. The Selaras document theme is there if you want it.',
    detail: 'type: html',
    span: 'wide', rot: '-1.4deg',
  },
  {
    fig: 5, kind: 'bundle', title: 'Field survey app', meta: 'Bundle', status: 'Sandboxed',
    name: 'A built frontend, as it is',
    body: 'Upload an existing Vue, React, or plain static build as a bundle. It is served in the same sandbox.',
    detail: 'type: bundle · REST upload',
    span: 'half', rot: '1.2deg',
  },
  {
    fig: 6, kind: 'file', title: 'Site inspection.pdf', meta: 'PDF',
    name: 'PDFs and images',
    body: 'Keep the source documents next to the work that explains them, in the same folders.',
    detail: 'type: pdf · image',
    span: 'half', rot: '-1deg',
  },
] as const
</script>

<template>
  <section id="kinds" class="lb-section" aria-labelledby="kinds-title">
    <div class="lb-wrap">
      <header class="head">
        <p class="sec-label lb-mono"><span>02</span> What a rangka can be</p>
        <h2 id="kinds-title" class="lb-h2">Whatever the agent makes, it gets a <em>frame</em>.</h2>
        <p class="lb-lede">
          Markdown looks finished without any styling. When a piece needs its own code,
          HTML and static web apps run in a sandbox. Each one is a rangka with its own page,
          folder, and history.
        </p>
      </header>

      <ol class="wall">
        <li v-for="(plate, i) in plates" :key="plate.fig" class="plate" :data-span="plate.span" :data-kind="plate.kind">
          <div class="mount lb-marks" data-reveal :style="{ '--reveal-rot': plate.rot, '--reveal-delay': `${(i % 2) * 0.08}s` }">
            <div class="print">
              <LandingBPiece :kind="plate.kind" :title="plate.title" :meta="plate.meta" :status="'status' in plate ? plate.status : undefined" />
            </div>
          </div>
          <div class="caption" data-reveal :style="{ '--reveal-delay': `${(i % 2) * 0.08 + 0.12}s` }">
            <p class="fig lb-mono">Fig. {{ plate.fig }}</p>
            <h3 class="name lb-serif">{{ plate.name }}</h3>
            <p class="body">{{ plate.body }}</p>
            <p class="detail lb-mono">{{ plate.detail }}</p>
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.head { max-width: 50rem; }
.head .lb-lede { margin-top: 1.5rem; }
.sec-label {
  display: flex; align-items: center; gap: 0.75rem;
  font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--b-muted);
  margin-bottom: 1.25rem;
}
.sec-label span { color: var(--b-accent); }
.sec-label::after { content: ''; flex: 0 0 3rem; height: 1px; background: var(--b-line); }

.wall {
  list-style: none;
  margin: clamp(3.5rem, 7vw, 6rem) 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: clamp(3rem, 6vw, 5.5rem) clamp(1.5rem, 3.5vw, 3.5rem);
}
.plate { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 1.5rem; }
@media (min-width: 900px) {
  .plate[data-span='wide'] { grid-column: span 7; }
  .plate[data-span='narrow'] { grid-column: span 5; }
  .plate[data-span='half'] { grid-column: span 6; }
  .plate:nth-child(2) { margin-top: 5rem; }
  .plate:nth-child(4) { margin-top: 3rem; }
  .plate:nth-child(6) { margin-top: 4rem; }
}

.mount {
  background: var(--b-table);
  display: grid;
  place-items: center;
  aspect-ratio: 5 / 4;
  padding: 1.25rem;
}
.print {
  width: min(100%, 24rem);
  aspect-ratio: 4 / 3.3;
  border-radius: 10px;
  box-shadow: var(--b-shadow-set);
}
.plate[data-kind='report'] .print, .plate[data-kind='app'] .print { width: min(100%, 26rem); aspect-ratio: 4 / 3.7; }
.print :deep(.piece) { border-radius: 10px; }

.caption { display: grid; grid-template-columns: 4.5rem 1fr; column-gap: 1rem; max-width: 36rem; }
.fig { grid-row: span 3; font-size: 0.75rem; color: var(--b-accent); padding-top: 0.4rem; }
.name { font-size: 1.5rem; font-weight: 420; line-height: 1.2; margin: 0; letter-spacing: -0.01em; }
.body { margin: 0.4rem 0 0; color: var(--b-muted); line-height: 1.55; }
.detail { margin: 0.6rem 0 0; font-size: 0.75rem; color: var(--b-muted); }
@media (max-width: 520px) {
  .caption { grid-template-columns: 1fr; }
  .fig { grid-row: auto; padding: 0 0 0.25rem; }
}
</style>
