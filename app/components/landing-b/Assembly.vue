<script setup lang="ts">
/**
 * The signature scene. Loose pieces of work arrive over MCP, settle into the
 * frames of a workspace, and one of them gets shared. Progress comes from
 * scroll position; with reduced motion the scene renders in its final state.
 */
const HEADER = 64
const scene = ref<HTMLElement | null>(null)
const p = ref(0)
const reduced = ref(false)
let raf = 0

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const span = (from: number, to: number) => clamp((p.value - from) / (to - from))
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeOut = (t: number) => 1 - (1 - t) ** 3

function measure() {
  raf = 0
  const el = scene.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const distance = r.height - (window.innerHeight - HEADER)
  p.value = distance > 0 ? clamp((HEADER - r.top) / distance) : 1
}
function onScroll() {
  if (!raf) raf = requestAnimationFrame(measure)
}

onMounted(() => {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  const apply = () => {
    reduced.value = mq.matches
    if (mq.matches) {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      p.value = 1
    }
    else {
      window.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('resize', onScroll, { passive: true })
      measure()
    }
  }
  mq.addEventListener('change', apply)
  apply()
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  if (raf) cancelAnimationFrame(raf)
})

const steps = [
  {
    title: 'An agent publishes over MCP',
    body: 'It calls create_rangka at /api/mcp with a token you approved. Reports, charts, and diagrams arrive as Markdown; a custom tool arrives as HTML.',
  },
  {
    title: 'Each piece settles into its own frame',
    body: 'Every rangka gets a page, a folder, a version history, and the renderer that suits it. All of it starts private.',
  },
  {
    title: 'You organize and share',
    body: 'Edit, move, or restore an older version from the web. When someone else should see it, make a signed unlisted link or publish it.',
  },
]
const step = computed(() => (p.value < 0.34 ? 0 : p.value < 0.7 ? 1 : 2))
const stepFill = (i: number) => {
  const bounds = [[0, 0.34], [0.34, 0.7], [0.7, 1]] as const
  const [a, b] = bounds[i]!
  return span(a, b)
}

const pieces = [
  { kind: 'report', title: 'Q3 revenue review', meta: 'Markdown', slug: 'q3-revenue-review', dx: -9, dy: -8, rot: -7 },
  { kind: 'chart', title: 'Weekly signups', meta: 'Chart', slug: 'weekly-signups', dx: 8, dy: -10, rot: 6 },
  { kind: 'diagram', title: 'Ingest pipeline', meta: 'Mermaid', slug: 'ingest-pipeline', dx: 13, dy: 4, rot: 4 },
  { kind: 'app', title: 'Seat estimator', meta: 'HTML', slug: 'seat-estimator', dx: 6, dy: 11, rot: -6 },
] as const

// Each piece pops in as its result line prints, then settles in turn.
const appear = (i: number) => easeOut(span(0.1 + i * 0.045, 0.16 + i * 0.045))
const settle = (i: number) => easeInOut(span(0.36 + i * 0.06, 0.53 + i * 0.06))

function pieceStyle(i: number) {
  const piece = pieces[i]!
  const a = appear(i)
  const s = settle(i)
  const k = 1 - s
  const lift = (1 - a) * -3
  return {
    opacity: String(a),
    transform: `translate3d(${(piece.dx * k).toFixed(3)}cqw, ${(piece.dy * k + lift).toFixed(3)}cqw, 0) rotate(${(piece.rot * k).toFixed(3)}deg) scale(${(1 + 0.04 * k - (1 - a) * 0.06).toFixed(4)})`,
    '--shadow-mix': `${(k * 100).toFixed(1)}%`,
    zIndex: String(10 + (s >= 1 ? 0 : 4 - i)),
  }
}
const settledCount = computed(() => pieces.filter((_, i) => settle(i) >= 0.98).length)

const callLines = [
  { t: 'req', text: 'tools/call create_rangka' },
  { t: 'res', text: '← q3-revenue-review · private' },
  { t: 'res', text: '← weekly-signups · private' },
  { t: 'res', text: '← ingest-pipeline · private' },
  { t: 'res', text: '← seat-estimator · private' },
]
const lineOn = (i: number) => p.value >= (i === 0 ? 0 : 0.1 + (i - 1) * 0.045)
const callStyle = computed(() => {
  const out = span(0.33, 0.41)
  return {
    opacity: String(1 - out),
    transform: `translate3d(0, ${(-3 * out).toFixed(3)}cqw, 0) scale(${(1 - 0.05 * out).toFixed(4)})`,
    visibility: out >= 1 ? 'hidden' as const : 'visible' as const,
  }
})

const share = computed(() => easeOut(span(0.74, 0.82)))
const unlisted = computed(() => p.value >= 0.86)
const copied = computed(() => p.value >= 0.94)
</script>

<template>
  <section id="how-it-works" class="assembly" aria-labelledby="assembly-title">
    <div ref="scene" class="track" :class="{ 'is-static': reduced }">
      <div class="sticky">
        <div class="lb-wrap layout">
          <div class="copy">
            <p class="sec-label lb-mono"><span>01</span> How it comes together</p>
            <h2 id="assembly-title" class="lb-h2 heading">From a tool call to a page you <em>keep</em>.</h2>
            <ol class="steps">
              <li v-for="(s, i) in steps" :key="s.title" :class="{ active: step === i, done: step > i }">
                <span class="rail" aria-hidden="true"><span class="rail-fill" :style="{ transform: `scaleY(${stepFill(i)})` }" /></span>
                <span class="n lb-mono" aria-hidden="true">{{ String(i + 1).padStart(2, '0') }}</span>
                <h3 class="step-title">{{ s.title }}</h3>
                <p class="step-body">{{ s.body }}</p>
              </li>
            </ol>
          </div>

          <div class="stage-col" aria-hidden="true">
            <div class="stage">
              <!-- the workspace window -->
              <div class="window">
                <div class="bar">
                  <span class="crumbs"><span class="muted">Workspace</span><span class="sep">/</span>Q3 review</span>
                  <span class="bar-actions">
                    <span class="btn" :class="{ pressed: share > 0 }">Share</span>
                    <span class="btn solid">New</span>
                  </span>
                </div>
                <div class="body">
                  <div class="side">
                    <span class="brand">Serangkai</span>
                    <span class="folder">All rangka</span>
                    <span class="folder on">Q3 review <b>{{ settledCount }}</b></span>
                    <span class="folder">Research</span>
                    <span class="folder">Ops notes</span>
                    <span class="folder last">Settings</span>
                  </div>
                  <div class="main">
                    <div class="main-head">
                      <span class="main-title">Q3 review</span>
                      <span class="main-meta">{{ settledCount }} rangka</span>
                    </div>
                    <div class="slots">
                      <div v-for="(piece, i) in pieces" :key="piece.slug" class="slot" :class="{ filled: settle(i) >= 0.98, selected: i === 0 && share > 0 }">
                        <span class="slot-empty">empty frame</span>
                        <div class="piece-wrap" :style="pieceStyle(i)">
                          <LandingBPiece
                            :kind="piece.kind"
                            :title="piece.title"
                            :meta="piece.meta"
                            :status="i === 0 && unlisted ? 'Unlisted' : 'Private'"
                            :status-tone="i === 0 && unlisted ? 'accent' : 'muted'"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- the MCP call -->
              <div class="call" :style="callStyle">
                <div class="call-head">
                  <span>research-agent</span>
                  <span class="muted">POST /api/mcp</span>
                </div>
                <div class="call-body">
                  <p v-for="(line, i) in callLines" :key="i" class="line" :class="[line.t, { on: lineOn(i) }]">
                    <template v-if="line.t === 'req'">
                      <span class="kw">tools/call</span> create_rangka<br>
                      <span class="json">{ "title": "Q3 revenue review",<br>&nbsp;&nbsp;"type": "markdown", "folderId": "q3" }</span>
                    </template>
                    <template v-else>{{ line.text }}</template>
                  </p>
                </div>
              </div>

              <!-- the share dialog -->
              <div class="share" :style="{ opacity: String(share), transform: `translate3d(0, ${((1 - share) * 2).toFixed(3)}cqw, 0) scale(${(0.97 + share * 0.03).toFixed(4)})`, visibility: share > 0 ? 'visible' : 'hidden' }">
                <p class="share-title">Share “Q3 revenue review”</p>
                <div class="opt" :class="{ on: !unlisted }"><span class="radio" /><span><b>Private</b><i>Only you</i></span></div>
                <div class="opt" :class="{ on: unlisted }"><span class="radio" /><span><b>Unlisted link</b><i>Anyone with the signed link</i></span></div>
                <div class="opt"><span class="radio" /><span><b>Public</b><i>Readable by anyone</i></span></div>
                <div class="link" :class="{ on: unlisted }">
                  <span class="url">/share/q3-revenue-review?k=…</span>
                  <span class="copy">{{ copied ? 'Copied' : 'Copy' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.assembly { border-top: 1px solid var(--b-line-soft); }
.track { position: relative; height: 330vh; }
.sticky {
  position: sticky;
  top: 64px;
  height: calc(100svh - 64px);
  min-height: 560px;
  display: flex;
  align-items: center;
  overflow: hidden;
}
.layout {
  display: grid;
  gap: 1.5rem;
  align-items: center;
}
@media (min-width: 1024px) {
  .layout { grid-template-columns: minmax(0, 0.72fr) minmax(0, 1.28fr); gap: clamp(3rem, 5vw, 5.5rem); }
}

/* copy */
.sec-label {
  display: flex; align-items: center; gap: 0.75rem;
  font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--b-muted);
  margin-bottom: 1.25rem;
}
.sec-label span { color: var(--b-accent); }
.sec-label::after { content: ''; flex: 0 0 3rem; height: 1px; background: var(--b-line); order: 1; }
.sec-label span { order: 0; }

.heading { font-size: clamp(1.9rem, 1.2rem + 2.6vw, 3.4rem); }
.steps { list-style: none; margin: 2.25rem 0 0; padding: 0; display: grid; gap: 0; }
.steps li {
  position: relative;
  display: grid;
  grid-template-columns: 2.5rem 1fr;
  column-gap: 0.5rem;
  padding: 1rem 0 1rem 1.25rem;
  opacity: 0.42;
  transition: opacity 0.5s var(--b-ease);
}
.steps li.active, .steps li.done { opacity: 1; }
.steps li.done .step-body { color: var(--b-muted); }
.rail { position: absolute; left: 0; top: 1rem; bottom: 1rem; width: 2px; background: var(--b-line); border-radius: 2px; overflow: hidden; }
.rail-fill { position: absolute; inset: 0; background: var(--b-accent-fill); transform-origin: top; }
.n { font-size: 0.78rem; color: var(--b-muted); padding-top: 0.3rem; }
.step-title { font-family: var(--b-serif); font-weight: 450; font-size: 1.35rem; line-height: 1.25; margin: 0; }
.step-body { grid-column: 2; margin: 0.4rem 0 0; color: var(--b-ink); line-height: 1.55; font-size: 0.98rem; max-width: 30rem; transition: color 0.5s; }

/* mobile: a compact caption under the stage */
@media (max-width: 1023px) {
  .sticky { align-items: flex-start; padding-top: 1.25rem; }
  .copy { display: contents; }
  .sec-label { margin-bottom: 0; }
  .heading { font-size: clamp(1.6rem, 1.1rem + 2.4vw, 2.2rem); margin-top: -0.75rem; }
  .stage-col { order: 3; }
  .steps { order: 4; position: relative; margin-top: 0.5rem; min-height: 9.5rem; }
  .steps li { position: absolute; inset: 0 0 auto 0; opacity: 0; transition: opacity 0.4s var(--b-ease), transform 0.4s var(--b-ease); transform: translateY(6px); }
  .steps li.active { opacity: 1; transform: none; }
  .steps li.done { opacity: 0; }
}

/* stage */
.stage-col { min-width: 0; }
.stage {
  container-type: inline-size;
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 11;
  font-family: inherit;
}
@media (min-width: 1024px) {
  .stage { width: min(100%, calc((100svh - 64px - 5rem) * 16 / 11)); margin-inline: auto; }
}

.window {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--b-table);
  border: 1px solid var(--b-line);
  border-radius: 1.4cqw;
  overflow: visible;
  font-size: max(7px, 1.35cqw);
  color: var(--b-ink);
}
.bar {
  display: flex; align-items: center; justify-content: space-between;
  height: 7cqw; padding: 0 2cqw;
  border-bottom: 1px solid var(--b-line);
  background: var(--b-card);
  border-radius: 1.4cqw 1.4cqw 0 0;
}
.crumbs .muted { color: var(--b-muted); }
.crumbs .sep { color: var(--b-line); margin: 0 0.8cqw; }
.bar-actions { display: flex; gap: 0.8cqw; }
.btn { border: 1px solid var(--b-line); border-radius: 0.8cqw; padding: 0.5cqw 1.4cqw; transition: background-color 0.3s, border-color 0.3s; }
.btn.solid { background: var(--b-ink); color: var(--b-paper); border-color: var(--b-ink); }
.btn.pressed { border-color: var(--b-accent-fill); background: var(--b-accent-soft); color: var(--b-accent); }

.body { flex: 1; display: grid; grid-template-columns: 19cqw 1fr; min-height: 0; }
.side {
  display: flex; flex-direction: column; gap: 0.4cqw;
  padding: 2cqw 1.4cqw;
  border-right: 1px solid var(--b-line);
}
.brand { font-family: var(--b-serif); font-size: 1.9cqw; margin: 0 0.8cqw 1.6cqw; }
.folder { display: flex; justify-content: space-between; padding: 0.7cqw 0.9cqw; border-radius: 0.7cqw; color: var(--b-muted); }
.folder.on { background: var(--b-card); color: var(--b-ink); box-shadow: inset 0 0 0 1px var(--b-line); }
.folder b { font-weight: 500; font-variant-numeric: tabular-nums; color: var(--b-accent); }
.folder.last { margin-top: auto; }

.main { display: flex; flex-direction: column; padding: 2cqw 2.4cqw 2.4cqw; min-height: 0; }
.main-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 1.6cqw; }
.main-title { font-family: var(--b-serif); font-size: 2.4cqw; letter-spacing: -0.01em; }
.main-meta { color: var(--b-muted); font-variant-numeric: tabular-nums; }
.slots { flex: 1; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1.15fr 1fr; gap: 2cqw; min-height: 0; }

.slot {
  position: relative;
  border-radius: 1.2cqw;
  outline: 1px dashed var(--b-line);
  outline-offset: -1px;
  transition: outline-color 0.4s;
}
.slot.filled { outline-color: transparent; }
.slot-empty {
  position: absolute; inset: 0; display: grid; place-items: center;
  font-family: var(--b-mono); font-size: max(6px, 1.1cqw); color: var(--b-muted); opacity: 0.7;
}
.slot::after {
  /* the frame tightens once a piece has landed */
  content: ''; position: absolute; inset: -0.9cqw; border-radius: 1.8cqw; pointer-events: none;
  border: 1.5px solid var(--b-accent-fill); opacity: 0; transition: opacity 0.35s var(--b-ease);
}
.slot.selected::after { opacity: 1; }
.piece-wrap {
  position: absolute; inset: 0;
  will-change: transform, opacity;
  border-radius: 1.2cqw;
  box-shadow: var(--b-shadow-set);
}
.piece-wrap::before {
  content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  box-shadow: var(--b-shadow-loose);
  opacity: var(--shadow-mix);
}
.piece-wrap :deep(.piece) { border-radius: 1.2cqw; }

/* MCP call card */
.call {
  position: absolute;
  left: 3cqw; bottom: 4cqw;
  width: 44cqw;
  z-index: 30;
  background: var(--selaras-resolved-surface-inverted);
  color: var(--selaras-resolved-text-inverted);
  border-radius: 1.4cqw;
  box-shadow: var(--b-shadow-loose);
  font-family: var(--b-mono);
  font-size: max(6.5px, 1.3cqw);
  line-height: 1.6;
  overflow: hidden;
  transform-origin: bottom left;
}
.call-head { display: flex; justify-content: space-between; padding: 1.2cqw 1.8cqw; border-bottom: 1px solid color-mix(in oklab, currentColor 14%, transparent); }
.call-head .muted { opacity: 0.6; }
.call-body { padding: 1.4cqw 1.8cqw 1.8cqw; }
.line { margin: 0; opacity: 0; transform: translateY(0.6cqw); transition: opacity 0.25s, transform 0.3s var(--b-ease); white-space: nowrap; }
.line.on { opacity: 1; transform: none; }
.line.req { margin-bottom: 0.8cqw; }
.line .kw { color: color-mix(in oklab, var(--selaras-resolved-color-primary-fill) 60%, currentColor); }
.line .json { opacity: 0.66; }
.line.res { opacity: 0; }
.line.res.on { opacity: 0.9; }

/* share dialog */
.share {
  position: absolute;
  right: 2cqw; top: 8.4cqw;
  width: 38cqw;
  z-index: 40;
  background: var(--b-card);
  border: 1px solid var(--b-line);
  border-radius: 1.4cqw;
  box-shadow: var(--b-shadow-loose);
  padding: 2cqw;
  font-size: max(7px, 1.3cqw);
  transform-origin: top right;
}
.share-title { font-family: var(--b-serif); font-size: 1.9cqw; margin: 0 0 1.4cqw; }
.opt { display: flex; gap: 1.2cqw; align-items: flex-start; padding: 0.9cqw 1cqw; border-radius: 0.8cqw; transition: background-color 0.3s; }
.opt b { display: block; font-weight: 500; }
.opt i { display: block; font-style: normal; color: var(--b-muted); }
.opt .radio { flex: none; width: 1.6cqw; height: 1.6cqw; margin-top: 0.3cqw; border-radius: 50%; border: 1px solid var(--b-line); transition: border 0.3s; }
.opt.on { background: var(--b-table); }
.opt.on .radio { border: 0.5cqw solid var(--b-accent-fill); }
.link {
  display: flex; align-items: center; justify-content: space-between; gap: 1cqw;
  margin-top: 1.2cqw; padding: 0.8cqw 0.8cqw 0.8cqw 1.2cqw;
  border: 1px solid var(--b-line); border-radius: 0.8cqw;
  font-family: var(--b-mono); font-size: max(6px, 1.15cqw);
  opacity: 0.35; transition: opacity 0.3s;
}
.link.on { opacity: 1; }
.link .url { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--b-muted); }
.link .copy { flex: none; padding: 0.4cqw 1.2cqw; border-radius: 0.6cqw; background: var(--b-ink); color: var(--b-paper); font-family: inherit; }

/* Reduced motion: a complete, static composition with every caption visible. */
.track.is-static { height: auto; }
.track.is-static .sticky { position: relative; top: 0; height: auto; min-height: 0; padding-block: clamp(5rem, 10vw, 8rem); }
.track.is-static .steps li { opacity: 1; position: relative; transform: none; }
.track.is-static .steps li .step-body { color: var(--b-ink); }
.track.is-static .steps { min-height: 0; }
@media (prefers-reduced-motion: reduce) {
  .track { height: auto; }
  .sticky { position: relative; top: 0; height: auto; min-height: 0; padding-block: clamp(5rem, 10vw, 8rem); }
  .steps li, .steps li.done { opacity: 1 !important; position: relative !important; transform: none !important; }
  .steps { min-height: 0 !important; }
  .piece-wrap { transform: none !important; opacity: 1 !important; }
  .piece-wrap::before { opacity: 0 !important; }
  .call { display: none; }
  .line, .rail-fill, .steps li { transition: none; }
}
</style>
