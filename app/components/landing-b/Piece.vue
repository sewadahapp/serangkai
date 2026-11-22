<script setup lang="ts">
/**
 * A miniature rangka, drawn in HTML/SVG. Sizes are in container units so the
 * same piece reads correctly as a small card or a large plate.
 */
defineProps<{
  kind: 'report' | 'chart' | 'diagram' | 'app' | 'bundle' | 'file'
  title?: string
  meta?: string
  status?: string
  statusTone?: 'muted' | 'accent'
}>()

const uid = useId()
const bars = [38, 52, 46, 61, 58, 72, 69, 84]
const line = [30, 34, 31, 42, 47, 45, 58, 63]
const linePath = line.map((v, i) => `${i === 0 ? 'M' : 'L'}${8 + i * 12},${70 - v * 0.7}`).join(' ')
</script>

<template>
  <div class="piece-c" aria-hidden="true">
  <div class="piece" :data-kind="kind">
    <div class="p-head">
      <span class="p-type">{{ meta }}</span>
      <span v-if="status" class="p-status" :data-tone="statusTone ?? 'muted'">{{ status }}</span>
    </div>
    <p class="p-title">{{ title }}</p>

    <!-- Report: Markdown styled by Selaras -->
    <div v-if="kind === 'report'" class="p-body report">
      <div class="r-lines">
        <span style="width: 96%" /><span style="width: 88%" /><span style="width: 64%" />
      </div>
      <div class="r-callout"><b>Note</b> EU totals include October.</div>
      <table class="r-table">
        <thead><tr><th>Region</th><th>Q2</th><th>Q3</th></tr></thead>
        <tbody>
          <tr><td>North</td><td>1.24</td><td>1.38</td></tr>
          <tr><td>EU</td><td>0.91</td><td>1.02</td></tr>
          <tr><td>APAC</td><td>0.66</td><td>0.79</td></tr>
        </tbody>
      </table>
      <div class="r-lines">
        <span style="width: 92%" /><span style="width: 71%" />
      </div>
    </div>

    <!-- Chart: declarative chart JSON -->
    <div v-else-if="kind === 'chart'" class="p-body chart">
      <div class="c-legend"><span class="sw a" />Signups <span class="sw b" />Trials</div>
      <svg viewBox="0 0 100 74" preserveAspectRatio="none" class="c-svg">
        <g class="grid">
          <line x1="2" x2="98" y1="14" y2="14" /><line x1="2" x2="98" y1="34" y2="34" /><line x1="2" x2="98" y1="54" y2="54" />
        </g>
        <rect v-for="(b, i) in bars" :key="i" class="bar" :x="4 + i * 12" :y="70 - b * 0.7" width="8" :height="b * 0.7" rx="0.8" />
        <path class="ln" :d="linePath" fill="none" vector-effect="non-scaling-stroke" />
        <line class="axis" x1="2" x2="98" y1="70" y2="70" vector-effect="non-scaling-stroke" />
      </svg>
      <div class="c-x"><span>W1</span><span>W4</span><span>W8</span></div>
    </div>

    <!-- Diagram: Mermaid flowchart -->
    <div v-else-if="kind === 'diagram'" class="p-body diagram">
      <svg viewBox="0 4 120 58" class="d-svg">
        <defs>
          <marker :id="`arrow-${uid}`" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,0 L6,3 L0,6 z" class="d-head" />
          </marker>
        </defs>
        <rect class="node" x="2" y="22" width="28" height="16" rx="2" /><text x="16" y="32.6">Ingest</text>
        <rect class="node" x="46" y="22" width="28" height="16" rx="2" /><text x="60" y="32.6">Validate</text>
        <rect class="node em" x="90" y="22" width="28" height="16" rx="8" /><text x="104" y="32.6">Publish</text>
        <rect class="node soft" x="46" y="48" width="28" height="13" rx="2" /><text x="60" y="56.6">Retry</text>
        <path class="edge" d="M30,30 H45" :marker-end="`url(#arrow-${uid})`" />
        <path class="edge" d="M74,30 H89" :marker-end="`url(#arrow-${uid})`" />
        <path class="edge dash" d="M60,38 V47" :marker-end="`url(#arrow-${uid})`" />
        <path class="edge dash" d="M46,54 H16 V39" :marker-end="`url(#arrow-${uid})`" />
        <text x="2" y="10" class="cap">flowchart LR</text>
      </svg>
    </div>

    <!-- HTML app: runs in a sandboxed iframe -->
    <div v-else-if="kind === 'app'" class="p-body app">
      <div class="a-field"><span>Seats</span><b>24</b></div>
      <div class="a-range"><span class="track"><span class="fill" /><span class="knob" /></span></div>
      <div class="a-seg"><span class="on">Monthly</span><span>Yearly</span></div>
      <div class="a-total"><span>Estimate</span><b>€1,240</b></div>
    </div>

    <!-- Static web app bundle -->
    <div v-else-if="kind === 'bundle'" class="p-body bundle">
      <div class="b-nav"><span class="dot" /><span class="pill on" /><span class="pill" /><span class="pill" /></div>
      <div class="b-cols">
        <div class="b-col"><span /><span /><span class="tall" /></div>
        <div class="b-col"><span class="tall" /><span /></div>
        <div class="b-col"><span /><span class="tall" /><span /></div>
      </div>
      <div class="b-files lb-mono">index.html · assets/app.js · assets/app.css</div>
    </div>

    <!-- Files: PDF and images -->
    <div v-else class="p-body file">
      <div class="f-sheet">
        <span class="f-band" />
        <span style="width: 80%" /><span style="width: 92%" /><span style="width: 60%" />
        <span class="f-img" />
        <span style="width: 86%" /><span style="width: 70%" />
      </div>
    </div>
  </div>
  </div>
</template>

<style scoped>
.piece-c { container-type: inline-size; height: 100%; }
.piece {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--b-card);
  color: var(--b-ink);
  border: 1px solid var(--b-line);
  border-radius: 1.6cqw;
  padding: 4.5cqw 5cqw 5cqw;
  overflow: hidden;
  font-size: 4.2cqw;
  line-height: 1.35;
}
.p-head { display: flex; align-items: center; justify-content: space-between; gap: 2cqw; }
.p-type {
  font-family: var(--b-mono);
  font-size: 3.4cqw;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--b-muted);
}
.p-status {
  font-family: var(--b-mono);
  font-size: 3.2cqw;
  padding: 0.6cqw 2.2cqw;
  border-radius: 99px;
  border: 1px solid var(--b-line);
  color: var(--b-muted);
  white-space: nowrap;
  transition: color 0.3s, border-color 0.3s, background-color 0.3s;
}
.p-status[data-tone='accent'] { color: var(--b-accent); border-color: color-mix(in oklab, var(--b-accent-fill) 45%, transparent); background: var(--b-accent-soft); }
.p-title {
  font-family: var(--b-serif);
  font-optical-sizing: auto;
  font-size: 6.6cqw;
  line-height: 1.1;
  letter-spacing: -0.01em;
  margin: 2cqw 0 3.4cqw;
}
.p-body { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 3.5cqw; }

/* report */
.r-lines { display: grid; gap: 2.2cqw; }
.r-lines span { display: block; height: 2.2cqw; border-radius: 1cqw; background: var(--b-line); }
.r-callout {
  border-left: 0.9cqw solid var(--b-accent-fill);
  background: var(--b-accent-soft);
  color: var(--b-ink);
  padding: 2cqw 3cqw;
  font-size: 3.6cqw;
  border-radius: 0 1cqw 1cqw 0;
}
.r-callout b { color: var(--b-accent); margin-right: 1.4cqw; font-weight: 600; }
.r-table { width: 100%; border-collapse: collapse; font-size: 3.6cqw; font-variant-numeric: tabular-nums; }
.r-table th { text-align: left; font-weight: 600; color: var(--b-muted); border-bottom: 1px solid var(--b-line); padding: 1.2cqw 0; }
.r-table td { padding: 1.2cqw 0; border-bottom: 1px solid var(--b-line-soft); }
.r-table th:not(:first-child), .r-table td:not(:first-child) { text-align: right; }

/* chart */
.c-legend { display: flex; align-items: center; gap: 1.6cqw; font-size: 3.4cqw; color: var(--b-muted); }
.c-legend .sw { width: 2.6cqw; height: 2.6cqw; border-radius: 0.6cqw; display: inline-block; }
.c-legend .sw.a { background: color-mix(in oklab, var(--b-ink) 18%, transparent); }
.c-legend .sw.b { background: var(--b-accent-fill); margin-left: 2cqw; height: 0.8cqw; }
.c-svg { width: 100%; flex: 1; min-height: 0; }
.c-svg .grid line { stroke: var(--b-line-soft); stroke-width: 0.4; }
.c-svg .bar { fill: color-mix(in oklab, var(--b-ink) 14%, transparent); }
.c-svg .ln { stroke: var(--b-accent-fill); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.c-svg .axis { stroke: var(--b-line); stroke-width: 1; }
.c-x { display: flex; justify-content: space-between; font-family: var(--b-mono); font-size: 3cqw; color: var(--b-muted); }

/* diagram */
.d-svg { width: 100%; flex: 1; min-height: 0; overflow: visible; }
.d-svg .node { fill: var(--b-card); stroke: var(--b-ink); stroke-width: 0.5; }
.d-svg .node.em { fill: var(--b-accent-soft); stroke: var(--b-accent-fill); }
.d-svg .node.soft { stroke: var(--b-line); stroke-dasharray: 1.5 1; }
.d-svg text { font-size: 5px; text-anchor: middle; fill: var(--b-ink); font-family: inherit; }
.d-svg text.cap { text-anchor: start; font-family: var(--b-mono); font-size: 4px; fill: var(--b-muted); }
.d-svg .edge { fill: none; stroke: var(--b-muted); stroke-width: 0.6; }
.d-svg .edge.dash { stroke-dasharray: 1.6 1.2; }
.d-svg .d-head { fill: var(--b-muted); }

/* app */
.app { gap: 3.2cqw; }
.a-field, .a-total { display: flex; justify-content: space-between; align-items: baseline; font-size: 3.8cqw; color: var(--b-muted); }
.a-field b { color: var(--b-ink); font-variant-numeric: tabular-nums; border: 1px solid var(--b-line); border-radius: 1cqw; padding: 0.4cqw 2.4cqw; font-weight: 500; }
.a-range .track { position: relative; display: block; height: 1.2cqw; border-radius: 1cqw; background: var(--b-line); }
.a-range .fill { position: absolute; inset: 0 42% 0 0; border-radius: inherit; background: var(--b-accent-fill); }
.a-range .knob { position: absolute; left: 58%; top: 50%; width: 4.4cqw; height: 4.4cqw; transform: translate(-50%, -50%); border-radius: 50%; background: var(--b-card); border: 0.6cqw solid var(--b-accent-fill); }
.a-seg { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--b-line); border-radius: 1.4cqw; padding: 0.8cqw; font-size: 3.5cqw; text-align: center; color: var(--b-muted); }
.a-seg span { padding: 1cqw 0; border-radius: 1cqw; }
.a-seg .on { background: var(--b-ink); color: var(--b-paper); }
.a-total { margin-top: auto; border-top: 1px solid var(--b-line); padding-top: 2.6cqw; }
.a-total b { font-family: var(--b-serif); font-weight: 400; font-size: 8cqw; color: var(--b-ink); letter-spacing: -0.02em; }

/* bundle */
.b-nav { display: flex; align-items: center; gap: 1.6cqw; padding-bottom: 2.4cqw; border-bottom: 1px solid var(--b-line); }
.b-nav .dot { width: 3.4cqw; height: 3.4cqw; border-radius: 50%; background: var(--b-accent-fill); margin-right: 2cqw; }
.b-nav .pill { width: 9cqw; height: 2cqw; border-radius: 1cqw; background: var(--b-line); }
.b-nav .pill.on { background: color-mix(in oklab, var(--b-ink) 40%, transparent); }
.b-cols { flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.2cqw; min-height: 0; }
.b-col { display: flex; flex-direction: column; gap: 2cqw; overflow: hidden; min-height: 0; background: var(--b-table); border-radius: 1.2cqw; padding: 2cqw; }
.b-col span { display: block; flex: none; height: 6cqw; border-radius: 0.8cqw; background: var(--b-card); border: 1px solid var(--b-line-soft); }
.b-col span.tall { height: 10cqw; }
.b-files { font-size: 3cqw; color: var(--b-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* file */
.file { align-items: center; justify-content: center; padding-bottom: 1.6cqw; }
.f-sheet {
  height: 100%;
  max-width: 100%;
  aspect-ratio: 1 / 1.25;
  background: var(--b-card);
  border: 1px solid var(--b-line);
  box-shadow: 1.6cqw 1.6cqw 0 -0.2cqw var(--b-table), 1.6cqw 1.6cqw 0 0 var(--b-line);
  padding: 5cqw 4.5cqw;
  display: flex;
  flex-direction: column;
  gap: 2cqw;
}
.f-sheet span { display: block; height: 1.6cqw; border-radius: 0.8cqw; background: var(--b-line); }
.f-sheet .f-band { height: 3cqw; width: 50%; background: color-mix(in oklab, var(--b-ink) 40%, transparent); margin-bottom: 1.5cqw; }
.f-sheet .f-img { height: 16cqw; border-radius: 0.6cqw; background: linear-gradient(135deg, var(--b-accent-soft), color-mix(in oklab, var(--b-accent-fill) 35%, var(--b-card))); margin: 1cqw 0; }
</style>
