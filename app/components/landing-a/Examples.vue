<script setup lang="ts">
const examples = [
  { value: 'report', label: 'Report', glyph: 'file' },
  { value: 'dashboard', label: 'Dashboard', glyph: 'chart' },
  { value: 'diagram', label: 'Diagram', glyph: 'diagram' },
  { value: 'app', label: 'HTML app', glyph: 'code' },
] as const

const sampleRows = [
  { period: 'Monday', latency: '238 ms', target: 'Above target' },
  { period: 'Friday', latency: '171 ms', target: 'Below target' },
  { period: 'Sunday', latency: '149 ms', target: 'Below target' },
]

const appSource = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style>
* { box-sizing: border-box; }
body { margin: 0; padding: 18px; color: light-dark(#25312b, #eff4ed); background: light-dark(#fffefa, #19211e); font: 14px/1.4 system-ui, sans-serif; }
form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
label { display: grid; gap: 5px; font-weight: 600; }
input { min-width: 0; width: 100%; padding: 8px; border: 1px solid light-dark(#b9c9be, #536259); border-radius: 5px; background: light-dark(#fffefa, #202924); font: inherit; color: inherit; }
output { grid-column: 1/-1; display: block; padding: 12px; color: light-dark(#17554a, #a3dccc); background: light-dark(#e7f1eb, #243b32); border-radius: 5px; font-weight: 650; }
</style>
</head>
<body>
<form id="budget">
<label>Target (ms)<input id="target" type="number" min="0" value="180"></label>
<label>Measured p95 (ms)<input id="measured" type="number" min="0" value="149"></label>
<output for="target measured">31 ms of headroom</output>
</form>
<script>
const form = document.getElementById('budget');
const target = document.getElementById('target');
const measured = document.getElementById('measured');
const result = form.querySelector('output');
form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', () => {
  const remaining = target.valueAsNumber - measured.valueAsNumber;
  result.value = !Number.isFinite(remaining) ? 'Enter both values' : remaining < 0 ? Math.abs(remaining) + ' ms over target' : remaining + ' ms of headroom';
});
<` + `/script></body></html>`
</script>

<template>
  <STabs
    class="examples"
    :items="[...examples]"
    default-value="report"
    variant="underline"
    :ui="{ list: 'example-tabs', trigger: 'example-tab', indicator: 'example-indicator', content: 'example-content' }"
  >
    <template #label="{ item, index }">
      <LandingAIcon :name="examples[index]?.glyph ?? 'file'" />
      <span>{{ item.label }}</span>
    </template>

    <template #report>
      <div class="example-layout">
        <div class="example-copy">
          <span class="type"><LandingAIcon name="file" /> Markdown</span>
          <h3>Write the review.</h3>
          <p>Headings, callouts, and tables come styled. An agent can send plain Markdown and the report is ready to read.</p>
        </div>
        <div class="sample report-sample">
          <div class="sample-top"><LandingAIcon name="file" /> latency-review.md</div>
          <div class="sample-body">
            <h4>Weekly latency review</h4>
            <p>API latency fell below our 180 ms target on Friday and stayed there over the weekend.</p>
            <table>
              <thead><tr><th scope="col">Period</th><th scope="col">p95</th><th scope="col">180 ms target</th></tr></thead>
              <tbody>
                <tr v-for="row in sampleRows" :key="row.period">
                  <th scope="row">{{ row.period }}</th><td>{{ row.latency }}</td><td>{{ row.target }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>

    <template #dashboard>
      <div class="example-layout">
        <div class="example-copy">
          <span class="type"><LandingAIcon name="chart" /> TanStack Charts</span>
          <h3>Plot the trend.</h3>
          <p>Put declarative chart JSON in a Markdown rangka. Use line, area, or bar charts alongside the numbers and their context.</p>
        </div>
        <div class="sample dashboard-sample">
          <div class="sample-top"><LandingAIcon name="chart" /> API performance</div>
          <div class="sample-body">
            <h4>p95 response time</h4>
            <p><strong>149 ms</strong> on Sunday · 180 ms target</p>
            <LandingATrend />
          </div>
        </div>
      </div>
    </template>

    <template #diagram>
      <div class="example-layout">
        <div class="example-copy">
          <span class="type"><LandingAIcon name="diagram" /> Mermaid</span>
          <h3>Map the flow.</h3>
          <p>Put a Mermaid code block in a rangka to render architecture, sequences, and flowcharts alongside the rest of the work.</p>
        </div>
        <div class="sample diagram-sample">
          <div class="sample-top"><LandingAIcon name="diagram" /> Request path</div>
          <div class="sample-body">
            <h4>How a request is served</h4>
            <svg class="diagram" viewBox="0 0 420 150" role="img" aria-labelledby="example-diagram-title">
              <title id="example-diagram-title">A client sends a request to the API. A cache hit returns a response. A cache miss queries SQLite before returning.</title>
              <defs>
                <marker id="landing-a-mermaid-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="m2 1 4 3-4 3" fill="none" stroke="var(--a-accent)" stroke-width="1" />
                </marker>
              </defs>
              <g class="diagram-paths" fill="none" stroke="var(--a-accent)" stroke-width="1.3" marker-end="url(#landing-a-mermaid-arrow)">
                <path d="M94 61h42" /><path d="M212 61h83" /><path d="M174 79v39h121" /><path d="M352 102V79" />
              </g>
              <g class="nodes">
                <rect x="10" y="44" width="84" height="34" rx="5" />
                <rect x="138" y="44" width="74" height="34" rx="5" />
                <rect x="297" y="44" width="111" height="34" rx="5" />
                <rect x="297" y="102" width="111" height="34" rx="5" />
              </g>
              <g text-anchor="middle" class="diagram-labels">
                <text x="52" y="66">Client</text><text x="175" y="66">API</text>
                <text x="352" y="66">Response</text><text x="352" y="124">SQLite</text>
                <text x="254" y="52" class="edge-label">Cache hit</text>
                <text x="247" y="110" class="edge-label">Cache miss</text>
              </g>
            </svg>
          </div>
        </div>
      </div>
    </template>

    <template #app>
      <div class="example-layout">
        <div class="example-copy">
          <span class="type"><LandingAIcon name="code" /> Sandboxed HTML</span>
          <h3>Build a tool.</h3>
          <p>Publish self-contained HTML and JavaScript or upload a static site bundle. Try changing a value in this example.</p>
        </div>
        <div class="sample app-sample">
          <div class="sample-top"><LandingAIcon name="lock" /> Sandbox · latency-budget.html</div>
          <div class="sample-body">
            <h4>Latency budget</h4>
            <iframe title="Sample latency budget calculator" sandbox="allow-scripts" :srcdoc="appSource" />
          </div>
        </div>
      </div>
    </template>
  </STabs>
</template>

<style scoped>
.examples {
  display: block;
  border: 1px solid var(--a-rule);
  border-radius: 13px;
  overflow: hidden;
  background: var(--a-panel);
}
.examples :deep(.example-tabs) {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  width: 100%;
  gap: 0;
  padding: 0;
  border: 0;
  border-bottom: 1px solid var(--a-rule);
  background: var(--a-windowbar);
}
.examples :deep(.example-tab) {
  display: flex;
  gap: 9px;
  justify-content: center;
  padding: 10px 4px;
  min-height: 53px;
  border-radius: 0;
  color: var(--a-muted);
  font-size: 14px;
  font-weight: 600;
}
.examples :deep(.example-tab + .example-tab) { border-inline-start: 1px solid var(--a-rule); }
.examples :deep(.example-tab svg) { width: 16px; height: 16px; flex: none; }
.examples :deep(.example-tab:hover) { background: var(--a-board); color: var(--a-ink); }
.examples :deep(.example-tab[data-state=active]) { background: var(--a-accent-soft); color: var(--a-accent); box-shadow: inset 0 -2px var(--a-accent); }
.examples :deep(.example-tab:focus-visible), .examples :deep(.example-content:focus-visible) { outline: 2px solid var(--a-accent); outline-offset: -3px; }
.examples :deep(.example-indicator) { display: none; }
.examples :deep(.example-content) { margin: 0; }
.example-layout {
  display: grid;
  grid-template-columns: minmax(0, .75fr) minmax(0, 1.25fr);
  align-items: center;
  gap: clamp(25px, 5vw, 75px);
  min-height: 348px;
  padding: clamp(23px, 4vw, 57px);
  background: var(--a-panel);
}
.example-copy h3 { margin: 16px 0 12px; font-size: clamp(29px, 3.1vw, 47px); font-weight: 630; line-height: 1.03; letter-spacing: -.055em; }
.example-copy p { max-width: 30ch; color: var(--a-muted); font-size: 16px; line-height: 1.61; }
.type { display: inline-flex; align-items: center; gap: 8px; color: var(--a-accent); font: 600 12px/1.4 var(--a-mono); }
.type svg, .sample-top svg { width: 15px; height: 15px; }
.sample { align-self: stretch; min-width: 0; background: var(--a-panel); border: 1px solid var(--a-rule); border-radius: 9px; overflow: hidden; }
.sample-top { display: flex; align-items: center; gap: 7px; min-height: 37px; padding: 7px 16px; color: var(--a-muted); border-bottom: 1px solid var(--a-rule); background: var(--a-windowbar); font: 11px/1.4 var(--a-mono); }
.sample-body { padding: 14px 17px 16px; }
.sample-body h4 { color: var(--a-ink); font-size: 21px; font-weight: 660; line-height: 1.2; letter-spacing: -.035em; }
.sample-body p { margin: 6px 0 12px; color: var(--a-muted); font-size: 13px; line-height: 1.5; }
.sample-body strong { color: var(--a-ink); }
.sample-body table { width: 100%; border-collapse: collapse; font-size: 12px; }
.sample-body th, .sample-body td { padding: 5px 8px; border-bottom: 1px solid var(--a-rule); text-align: left; }
.sample-body thead { background: var(--a-windowbar); color: var(--a-muted); }
.sample-body tbody th { font-weight: 600; }
.diagram { width: 100%; max-height: 158px; margin-top: 8px; }
.nodes { fill: var(--a-accent-soft); stroke: var(--a-board-rule); }
.diagram-labels { font: 600 14px var(--a-sans); fill: var(--a-ink); }
.edge-label { font: 11px var(--a-mono); fill: var(--a-muted); }
.sample iframe { width: 100%; height: 157px; margin-top: 8px; border: 1px solid var(--a-rule); border-radius: 6px; color-scheme: inherit; }
@media (max-width: 670px) {
  .examples :deep(.example-tab) { flex-direction: column; gap: 4px; font-size: 11px; line-height: 1.2; min-height: 56px; }
  .example-layout { min-height: 0; grid-template-columns: minmax(0, 1fr); gap: 20px; padding: 17px; }
  .example-copy h3 { margin: 9px 0 7px; }
  .example-copy p { max-width: 40ch; font-size: 14px; }
  .sample-top { padding-inline: 11px; }
  .sample-body { padding: 11px; }
  .sample-body h4 { font-size: 18px; }
  .sample-body th, .sample-body td { padding-inline: 5px; }
}
</style>
