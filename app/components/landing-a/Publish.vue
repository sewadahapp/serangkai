<script setup lang="ts">
const milestones = [0, 380, 660, 920, 1180, 1430, 1760, 2240, 3050, 4200]
const steps = [
  { label: 'Agent sends', phase: 0 },
  { label: 'Rangka renders', phase: 7 },
  { label: 'Owner shares', phase: 9 },
]

const lastPhase = milestones.length - 1
const phase = ref(lastPhase)
const playing = ref(false)
const reducedMotion = ref(false)
const step = computed(() => phase.value >= 9 ? 2 : phase.value >= 7 ? 1 : 0)
const controlIcon = computed(() => playing.value ? 'pause' : phase.value === lastPhase ? 'replay' : 'play')
const controlLabel = computed(() => playing.value ? 'Pause' : phase.value === lastPhase ? 'Replay' : 'Resume')

let media: MediaQueryList
let frame = 0
let elapsed = 0
let started = 0

function tick(now: number) {
  const next = milestones.findLastIndex(time => time <= now - started)
  phase.value = next
  if (next === lastPhase) {
    playing.value = false
    return
  }
  frame = requestAnimationFrame(tick)
}

function play() {
  if (phase.value === lastPhase) elapsed = 0
  started = performance.now() - elapsed
  if (!elapsed) phase.value = 0
  playing.value = true
  frame = requestAnimationFrame(tick)
}

function pause() {
  elapsed = performance.now() - started
  playing.value = false
  cancelAnimationFrame(frame)
}

function syncMotion() {
  reducedMotion.value = media.matches
  if (media.matches) {
    pause()
    phase.value = lastPhase
  }
}

onMounted(() => {
  media = window.matchMedia('(prefers-reduced-motion: reduce)')
  syncMotion()
  media.addEventListener('change', syncMotion)
  if (!reducedMotion.value) play()
})

onBeforeUnmount(() => {
  media?.removeEventListener('change', syncMotion)
  cancelAnimationFrame(frame)
})
</script>

<template>
  <figure class="publish-board" :data-phase="phase">
    <figcaption class="board-caption">
      <span class="board-title"><span class="signal" /> A publish walkthrough</span>
      <span class="board-example">Example · Weekly latency review</span>
    </figcaption>
    <p class="sr-only">
      A sample agent sends a private Markdown report through MCP. The report appears in the Engineering folder with a rendered chart and version 1. The owner then creates an unlisted share link.
    </p>

    <div class="board-flow" aria-hidden="true">
      <div class="terminal">
        <div class="pane-top">
          <span><LandingAIcon name="terminal" /> Agent</span>
          <code>POST /api/mcp</code>
        </div>
        <div class="terminal-body">
          <div class="request-label"><span>TOOL CALL</span><span>EXCERPT</span></div>
          <div class="code-block">
            <div :class="{ pending: phase < 1 }"><b>create_rangka</b>({</div>
            <div :class="{ pending: phase < 2 }">  title: <em>"Weekly latency review"</em>,</div>
            <div :class="{ pending: phase < 3 }">  type: <em>"markdown"</em>,</div>
            <div :class="{ pending: phase < 4 }">  content: <em>"# Latency by day…"</em>,</div>
            <div :class="{ pending: phase < 5 }">  folderId: <em>"eng_01"</em>,</div>
            <div :class="{ pending: phase < 6 }">})</div>
          </div>
        </div>
        <div class="terminal-result" :class="{ sent: phase >= 7 }">
          <LandingAIcon :name="phase >= 7 ? 'check' : 'terminal'" />
          <span>{{ phase >= 7 ? 'Rangka created' : 'Preparing request' }}</span>
        </div>
      </div>

      <div class="transfer" :class="{ arrived: phase >= 7 }">
        <span class="transfer-track" />
        <span class="transfer-icon"><LandingAIcon name="arrow-right" /></span>
      </div>

      <div class="workspace">
        <div class="pane-top">
          <span><LandingAIcon name="panels" /> Serangkai workspace</span>
          <span class="window-dots"><i /><i /><i /></span>
        </div>
        <div class="workspace-grid">
          <aside class="folders">
            <span class="folder-label">Folders</span>
            <span class="folder-item"><LandingAIcon name="folder" /> Engineering</span>
            <span class="selected" :class="{ pending: phase < 7 }"><LandingAIcon name="file" /> Latency review</span>
            <span class="folder-item"><LandingAIcon name="folder" /> Research</span>
          </aside>
          <div class="document">
            <div class="waiting" :class="{ pending: phase >= 7 }">
              <LandingAIcon name="file" />
              <span>Waiting for rangka…</span>
            </div>
            <div class="document-content" :class="{ pending: phase < 7 }">
              <div class="document-path">Folders <span>/</span> Engineering</div>
              <div class="document-title">Weekly latency review</div>
              <div class="document-subtitle">p95 response time · 3–9 August</div>
              <div class="chart-key">
                <span><i /> p95 latency (ms)</span>
                <span><i /> Target</span>
              </div>
              <LandingATrend compact :drawn="phase >= 7" />
            </div>
          </div>
        </div>
        <div class="workspace-meta">
          <span class="version" :class="{ pending: phase < 8 }"><LandingAIcon name="history" /> Version 1</span>
          <span class="share" :class="{ pending: phase < 7, shared: phase >= 9 }">
            <LandingAIcon :name="phase >= 9 ? 'link' : 'lock'" />
            {{ phase >= 9 ? 'Unlisted link created' : 'Private' }}
            <code v-if="phase >= 9" class="share-url">/share/weekly-latency-review?k=…</code>
          </span>
        </div>
      </div>
    </div>

    <div class="board-footer">
      <ol class="playback-steps" aria-hidden="true">
        <li v-for="(item, index) in steps" :key="item.label" :class="{ reached: phase >= item.phase, current: step === index }">
          <span class="step-number">0{{ index + 1 }}</span>{{ item.label }}
        </li>
      </ol>
      <button v-if="!reducedMotion" type="button" class="replay" :aria-label="`${controlLabel} publish walkthrough`" @click="playing ? pause() : play()">
        <LandingAIcon :name="controlIcon" /> {{ controlLabel }}
      </button>
    </div>
  </figure>
</template>

<style scoped>
.publish-board {
  margin: 0;
  border: 1px solid var(--a-board-rule);
  border-radius: 16px;
  overflow: hidden;
  background: var(--a-board);
}
.board-caption, .board-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-inline: 23px;
  min-height: 50px;
  background: var(--a-board);
}
.board-caption { border-bottom: 1px solid var(--a-board-rule); }
.board-title, .board-example {
  font: 600 11px/1.45 var(--a-mono);
  letter-spacing: .025em;
}
.board-title { display: flex; align-items: center; gap: 9px; color: var(--a-ink); }
.board-example { color: var(--a-muted); }
.signal { width: 7px; height: 7px; border-radius: 50%; background: var(--a-copper); box-shadow: 0 0 0 3px var(--a-copper-soft); }
.board-flow {
  display: grid;
  grid-template-columns: minmax(245px, .68fr) 60px minmax(0, 1.32fr);
  align-items: center;
  padding: 23px;
  background-image: radial-gradient(var(--a-dot) 1px, transparent 1px);
  background-size: 15px 15px;
}
.terminal, .workspace {
  min-width: 0;
  border: 1px solid var(--a-board-rule);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 7px 18px var(--a-shadow);
}
.terminal { background: var(--a-terminal); color: var(--a-terminal-text); border-color: var(--a-terminal-rule); }
.workspace { background: var(--a-panel); color: var(--a-ink); }
.pane-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 14px;
  min-height: 39px;
  border-bottom: 1px solid var(--a-rule);
  background: var(--a-windowbar);
  font-size: 12px;
  font-weight: 650;
}
.pane-top span { display: inline-flex; gap: 7px; align-items: center; }
.pane-top svg, .terminal-result svg, .workspace-meta svg { width: 14px; height: 14px; flex: none; }
.pane-top code { color: var(--a-terminal-muted); font: 10px var(--a-mono); }
.terminal .pane-top { background: var(--a-terminal-top); border-color: var(--a-terminal-rule); }
.terminal .pane-top svg { color: var(--a-terminal-accent); }
.terminal-body { padding: 16px 14px 15px; min-height: 172px; }
.request-label { display: flex; justify-content: space-between; font: 10px var(--a-mono); letter-spacing: .1em; color: var(--a-terminal-muted); margin-bottom: 10px; }
.code-block { font: clamp(10px, 1vw, 13px)/1.65 var(--a-mono); white-space: pre; }
.code-block b { color: var(--a-terminal-accent); font-weight: 650; }
.code-block em { color: var(--a-terminal-string); font-style: normal; }
.code-block > div, .selected, .document-content, .waiting, .version, .share { transition: opacity .24s ease, transform .24s ease; }
.pending { opacity: 0; transform: translateY(3px); }
.terminal-result {
  display: flex;
  gap: 7px;
  align-items: center;
  padding: 10px 14px;
  color: var(--a-terminal-muted);
  border-top: 1px solid var(--a-terminal-rule);
  font: 11px var(--a-mono);
}
.terminal-result.sent { color: var(--a-terminal-accent); }
.transfer { position: relative; display: grid; place-items: center; }
.transfer-track { position: absolute; width: 100%; border-block-start: 1px dashed var(--a-board-rule); }
.transfer-icon {
  position: relative;
  display: grid;
  place-items: center;
  width: 29px;
  height: 29px;
  border: 1px solid var(--a-board-rule);
  border-radius: 50%;
  background: var(--a-panel);
  color: var(--a-muted);
  transition: background .3s, color .3s, border-color .3s;
}
.transfer-icon svg { width: 14px; height: 14px; }
.arrived .transfer-track { border-color: var(--a-accent); }
.arrived .transfer-icon { color: var(--a-on-accent); background: var(--a-action); border-color: var(--a-action); }
.window-dots i { width: 4px; height: 4px; background: var(--a-dot); border-radius: 50%; }
.workspace-grid { display: grid; grid-template-columns: 139px minmax(0, 1fr); min-height: 249px; }
.folders { padding: 13px 7px 10px 8px; border-inline-end: 1px solid var(--a-rule); background: var(--a-windowbar); white-space: nowrap; }
.folder-label { display: block; margin: 1px 7px 10px; color: var(--a-muted); font-size: 10px; }
.folder-item, .selected { display: flex; align-items: center; gap: 6px; padding: 6px 7px; font-size: 11px; line-height: 1.2; }
.folder-item svg, .selected svg { width: 13px; height: 13px; flex: none; }
.selected { background: var(--a-accent-soft); color: var(--a-accent); border-radius: 5px; font-weight: 650; padding-left: 11px; }
.document { position: relative; min-width: 0; padding: 15px 19px 11px; }
.waiting { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 8px; font-size: 12px; color: var(--a-muted); }
.document-path { color: var(--a-muted); font-size: 11px; }
.document-path span { padding: 0 4px; color: var(--a-dot); }
.document-title { margin-top: 4px; font-size: clamp(17px, 2vw, 26px); line-height: 1.2; font-weight: 680; letter-spacing: -.04em; }
.document-subtitle { margin-top: 4px; color: var(--a-muted); font-size: 11px; }
.chart-key { display: flex; justify-content: end; gap: 12px; margin: 11px 0 4px; color: var(--a-muted); font: 10px var(--a-mono); }
.chart-key span { display: flex; align-items: center; gap: 5px; }
.chart-key i { width: 11px; border-top: 2px solid var(--a-accent); }
.chart-key span + span i { border-top: 1px dashed var(--a-copper); }
.workspace-meta {
  min-height: 37px;
  padding-inline: 14px;
  border-top: 1px solid var(--a-rule);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  background: var(--a-windowbar);
  color: var(--a-muted);
  font: 10px var(--a-mono);
}
.workspace-meta > span { display: inline-flex; align-items: center; gap: 5px; }
.workspace-meta .shared { color: var(--a-accent); }
.share-url { margin-inline-start: 4px; padding: 3px 5px; border-radius: 4px; background: var(--a-accent-soft); font: inherit; }
.board-footer { border-top: 1px solid var(--a-board-rule); }
.playback-steps { display: flex; align-items: center; gap: 22px; margin: 0; padding: 0; list-style: none; }
.playback-steps li { display: flex; gap: 7px; align-items: center; font: 11px/1.3 var(--a-mono); color: var(--a-muted); }
.step-number { color: var(--a-muted); }
.reached .step-number { color: var(--a-accent); }
.playback-steps .current { color: var(--a-ink); font-weight: 700; }
.replay {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  gap: 6px;
  font: 600 11px var(--a-mono);
  color: var(--a-accent);
  cursor: pointer;
}
.replay:hover { text-decoration: underline; }
.replay svg { width: 14px; height: 14px; }
@media (max-width: 1050px) {
  .share-url { display: none; }
}
@media (max-width: 970px) {
  .board-flow { grid-template-columns: minmax(218px, .68fr) 40px minmax(0, 1.32fr); padding: 17px; }
  .workspace-grid { grid-template-columns: 110px minmax(0, 1fr); }
  .document { padding-inline: 14px; }
  .selected { padding-left: 4px; }
  .folder-item { padding-left: 3px; }
}
@media (max-width: 740px) {
  .board-caption, .board-footer { min-height: 44px; padding-inline: 13px; }
  .board-flow { grid-template-columns: minmax(0, 1fr); padding: 12px; }
  .transfer { height: 29px; }
  .transfer-track { width: auto; height: 100%; border-inline-start: 1px dashed var(--a-board-rule); border-block-start: 0; }
  .transfer-icon { width: 23px; height: 23px; }
  .transfer-icon svg { transform: rotate(90deg); width: 12px; }
  .terminal-body { min-height: 0; padding-block: 12px 11px; }
  .code-block { font-size: 11px; line-height: 1.52; }
  .pane-top { min-height: 35px; }
  .terminal-result { padding-block: 7px; }
  .workspace-grid { grid-template-columns: minmax(0, 1fr); min-height: 0; }
  .folders { display: none; }
  .document-title { font-size: 20px; }
  .playback-steps { gap: 9px; }
  .playback-steps li { font-size: 9px; gap: 4px; }
  .step-number { display: none; }
  .replay { min-width: 57px; justify-content: end; font-size: 10px; }
}
@media (max-width: 420px) {
  .board-example { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .replay { display: none; }
  .publish-board * { transition: none; }
}
</style>
