<script setup lang="ts">
const facts = [
  { term: 'OAuth 2.1 with PKCE', text: 'Clients find Serangkai from a 401 and send you to a consent screen. Nothing secret is pasted into the client.' },
  { term: 'Device codes for headless clients', text: 'From SSH, a container, or CI, approve a short code at /oauth/device in any browser.' },
  { term: 'Scoped and revocable', text: 'OAuth grants are capped at read and write. Tokens are hashed at rest, can expire, and can be revoked at any time.' },
  { term: 'Private by default', text: 'Only the owner sees a rangka until it is shared. Unlisted links are signed, and read-only tokens cannot create them.' },
  { term: 'Sandboxed code', text: 'HTML and JavaScript run in a sandboxed iframe with an opaque origin and a restrictive CSP.' },
  { term: 'One owner, no sign-up', text: 'The account comes from environment variables. There is no public registration.' },
]

const tokens = [
  { name: 'research-agent', via: 'OAuth', scopes: 'read, write', when: 'used 2 min ago' },
  { name: 'nightly-report', via: 'Token', scopes: 'read, write', when: 'expires in 30 days' },
  { name: 'laptop-cli', via: 'Token', scopes: 'read', when: 'used yesterday', revoke: true },
]

const history = [
  { v: 'v1', who: 'research-agent', call: 'create_rangka', note: 'First draft' },
  { v: 'v2', who: 'You', call: 'web editor', note: 'Rewrote the summary' },
  { v: '409', who: 'research-agent', call: 'update_rangka · baseVersion 1', note: 'Refused: the current version is 2', refused: true },
  { v: 'v3', who: 'research-agent', call: 'update_rangka · baseVersion 2', note: 'Re-read v2 and merged onto your edit' },
]
</script>

<template>
  <section id="permissions" class="lb-section" aria-labelledby="perm-title">
    <div class="lb-wrap">
      <div class="top">
        <header class="head">
          <p class="sec-label lb-mono"><span>03</span> Agents, with permission</p>
          <h2 id="perm-title" class="lb-h2">Agents work with keys you can <em>take back</em>.</h2>
          <p class="lb-lede">
            Serangkai is its own OAuth server. An agent asks, you approve exactly what it may
            do, and you can withdraw that at any time. A browser session never authorizes MCP.
          </p>
        </header>

        <div class="visual" aria-hidden="true">
          <div class="consent lb-marks" data-reveal style="--reveal-rot: -1.5deg">
            <div class="c-head">
              <span class="mark">S</span>
              <span>Serangkai</span>
            </div>
            <p class="c-title lb-serif">Authorize research-agent</p>
            <p class="c-sub">It wants to connect to <span class="lb-mono">example.com/api/mcp</span> and will be able to:</p>
            <ul class="c-scopes">
              <li><span class="tick" /><span class="scope lb-mono">read</span>List and read rangka and folders</li>
              <li><span class="tick" /><span class="scope lb-mono">write</span>Create and update rangka</li>
            </ul>
            <div class="c-actions"><span class="b">Deny</span><span class="b solid">Approve</span></div>
            <p class="c-foot lb-mono">PKCE S256 · bound to this MCP resource</p>
          </div>

          <div class="tokens" data-reveal style="--reveal-delay: 0.15s; --reveal-rot: 1deg">
            <p class="t-title">API tokens</p>
            <div v-for="t in tokens" :key="t.name" class="t-row" :class="{ revoking: t.revoke }">
              <span class="t-id">
                <span class="t-name lb-mono">{{ t.name }}</span>
                <span class="t-meta"><span>{{ t.via }}</span><span>{{ t.scopes }}</span><span>{{ t.when }}</span></span>
              </span>
              <span class="t-btn"><span class="label-on">Revoke</span><span class="label-off">Revoked</span></span>
            </div>
          </div>
        </div>
      </div>

      <dl class="facts">
        <div v-for="(f, i) in facts" :key="f.term" class="fact" data-reveal :style="{ '--reveal-delay': `${(i % 3) * 0.07}s` }">
          <dt class="lb-serif">{{ f.term }}</dt>
          <dd>{{ f.text }}</dd>
        </div>
      </dl>

      <div class="history">
        <div class="h-head">
          <h3 class="lb-serif">No silent overwrites.</h3>
          <p>
            A content change carries the version the agent read. If you edited in the
            meantime, the write is refused with the current version, and the agent re-reads
            and merges.
          </p>
        </div>
        <ol class="timeline" data-reveal>
          <li v-for="(h, i) in history" :key="h.v" :class="{ refused: h.refused }" :style="{ '--i': i }">
            <span class="dot" aria-hidden="true" />
            <span class="v lb-mono">{{ h.v }}</span>
            <span class="who">{{ h.who }}</span>
            <span class="call lb-mono">{{ h.call }}</span>
            <span class="note">{{ h.note }}</span>
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>

<style scoped>
.sec-label {
  display: flex; align-items: center; gap: 0.75rem;
  font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--b-muted);
  margin-bottom: 1.25rem;
}
.sec-label span { color: var(--b-accent); }
.sec-label::after { content: ''; flex: 0 0 3rem; height: 1px; background: var(--b-line); }
.head .lb-lede { margin-top: 1.5rem; }

.top { display: grid; gap: 3.5rem; align-items: center; }
@media (min-width: 1024px) { .top { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 5rem; } }

/* consent + tokens */
.visual { position: relative; display: grid; gap: 1.25rem; }
@media (min-width: 640px) {
  .visual { display: block; padding: 0.75rem 0.75rem 0; }
  .consent { width: min(24rem, 80%); z-index: 2; }
  .tokens { margin: -3.75rem 0 0 auto; width: min(31rem, 94%); padding-top: 4.75rem !important; }
}
.consent {
  position: relative;
  background: var(--b-card);
  border: 1px solid var(--b-line);
  border-radius: 14px;
  padding: 1.5rem;
  box-shadow: var(--b-shadow-loose);
  font-size: 0.9rem;
}
.c-head { display: flex; align-items: center; gap: 0.6rem; font-size: 0.85rem; color: var(--b-muted); }
.mark {
  display: grid; place-items: center; width: 1.6rem; height: 1.6rem; border-radius: 6px;
  background: var(--b-ink); color: var(--b-paper); font-family: var(--b-serif); font-size: 1rem; font-style: italic;
}
.c-title { font-size: 1.45rem; line-height: 1.2; margin: 1.1rem 0 0.4rem; }
.c-sub { color: var(--b-muted); margin: 0; line-height: 1.5; }
.c-sub .lb-mono { color: var(--b-ink); font-size: 0.8rem; white-space: nowrap; }
.c-scopes { list-style: none; margin: 1rem 0 0; padding: 0; border-top: 1px solid var(--b-line); }
.c-scopes li { display: flex; align-items: center; gap: 0.6rem; padding: 0.65rem 0; border-bottom: 1px solid var(--b-line-soft); }
.tick {
  flex: none; width: 1rem; height: 1rem; border-radius: 4px; background: var(--b-accent-fill); position: relative;
}
.tick::after {
  content: ''; position: absolute; left: 0.32rem; top: 0.15rem; width: 0.3rem; height: 0.55rem;
  border: solid var(--selaras-resolved-surface-canvas); border-width: 0 2px 2px 0; transform: rotate(45deg);
}
.dark .tick::after { border-color: var(--b-ink); }
.scope { font-size: 0.75rem; padding: 0.05rem 0.4rem; border: 1px solid var(--b-line); border-radius: 4px; }
.c-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.1rem; }
.c-actions .b { padding: 0.4rem 0.9rem; border-radius: 8px; border: 1px solid var(--b-line); font-weight: 500; font-size: 0.85rem; }
.c-actions .b.solid { background: var(--selaras-resolved-color-primary-fill); border-color: transparent; color: #fff; }
.c-foot { margin: 1rem 0 0; font-size: 0.7rem; color: var(--b-muted); }

.tokens {
  background: var(--b-card);
  border: 1px solid var(--b-line);
  border-radius: 14px;
  padding: 1.1rem 1.25rem 0.5rem;
  box-shadow: var(--b-shadow-set);
  font-size: 0.82rem;
}
@media (min-width: 640px) { .tokens { background: var(--b-table); } }
.t-title { font-weight: 600; margin: 0 0 0.5rem; }
.t-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 1rem;
  align-items: center;
  padding: 0.75rem 0;
  border-top: 1px solid var(--b-line);
  transition: opacity 0.4s;
}
.t-id { display: flex; flex-direction: column; min-width: 0; }
.t-name { font-size: 0.8rem; }
.t-meta { color: var(--b-muted); font-size: 0.78rem; margin-top: 0.15rem; }
.t-meta span + span::before { content: '·'; margin: 0 0.4rem; }
.t-btn {
  position: relative;
  padding: 0.25rem 0.65rem;
  border-radius: 6px;
  border: 1px solid var(--b-line);
  color: var(--b-danger);
  font-size: 0.78rem;
  font-weight: 500;
  white-space: nowrap;
}
.t-btn { display: inline-grid; }
.t-btn > span { grid-area: 1 / 1; text-align: center; }
.t-btn .label-off { opacity: 0; }

/* the last token gets revoked once the panel is on screen */
.lb-js .tokens.is-in .revoking { animation: revoke-row 0.01s linear 1.8s both; }
.lb-js .tokens.is-in .revoking .t-btn { animation: revoke-press 0.5s var(--b-ease) 1.4s both; }
.lb-js .tokens.is-in .revoking .label-on { animation: hide 0.01s linear 1.8s both; }
.lb-js .tokens.is-in .revoking .label-off { animation: show 0.01s linear 1.8s both; }
.tokens .revoking .label-off { color: var(--b-muted); }
@keyframes revoke-press {
  0% { background: transparent; }
  50% { background: var(--selaras-resolved-color-danger-subtle); transform: scale(0.96); }
  100% { background: transparent; transform: none; border-color: transparent; }
}
@keyframes revoke-row { to { opacity: 0.5; text-decoration: line-through; text-decoration-color: var(--b-muted); } }
@keyframes hide { to { opacity: 0; } }
@keyframes show { to { opacity: 1; } }

/* facts */
.facts {
  display: grid;
  grid-template-columns: 1fr;
  margin: clamp(4rem, 8vw, 6.5rem) 0 0;
  border-top: 1px solid var(--b-ink);
}
@media (min-width: 720px) { .facts { grid-template-columns: repeat(2, 1fr); column-gap: 3rem; } }
@media (min-width: 1100px) { .facts { grid-template-columns: repeat(3, 1fr); } }
.fact { padding: 1.5rem 0 1.75rem; border-bottom: 1px solid var(--b-line); }
.fact dt { font-size: 1.3rem; line-height: 1.25; letter-spacing: -0.005em; }
.fact dd { margin: 0.5rem 0 0; color: var(--b-muted); line-height: 1.55; max-width: 26rem; }

/* history */
.history {
  margin-top: clamp(4rem, 8vw, 6.5rem);
  display: grid;
  gap: 2rem;
}
@media (min-width: 1024px) { .history { grid-template-columns: minmax(0, 0.8fr) minmax(0, 2fr); gap: 4rem; align-items: start; } }
.h-head h3 { font-size: 1.75rem; font-weight: 420; margin: 0; letter-spacing: -0.01em; }
.h-head p { margin: 0.75rem 0 0; color: var(--b-muted); line-height: 1.6; }

.timeline { list-style: none; margin: 0; padding: 0; display: grid; position: relative; }
.timeline li {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 0.75rem;
  padding: 0 0 1.5rem 1.75rem;
}
.timeline li::before {
  content: ''; position: absolute; left: 0.3rem; top: 1rem; bottom: -0.25rem; width: 1px; background: var(--b-line);
}
.timeline li:last-child::before { display: none; }
.dot {
  position: absolute; left: 0; top: 0.35rem; width: 0.65rem; height: 0.65rem; border-radius: 50%;
  background: var(--b-paper); border: 1.5px solid var(--b-ink);
}
.timeline li:last-child .dot { background: var(--b-accent-fill); border-color: var(--b-accent-fill); }
.v { font-size: 0.8rem; font-weight: 500; padding-top: 0.15rem; }
.who { font-weight: 500; }
.call { grid-column: 2; font-size: 0.75rem; color: var(--b-muted); margin-top: 0.15rem; }
.note { grid-column: 2; margin-top: 0.25rem; }
.refused .v, .refused .note { color: var(--b-danger); }
.refused .dot { border-color: var(--b-danger); border-style: dashed; }

@media (min-width: 760px) {
  .timeline { grid-template-columns: repeat(4, 1fr); gap: 0 1.25rem; padding-top: 1.75rem; }
  .timeline li { grid-template-columns: 1fr; padding: 1rem 0 0; border-top: 1px solid var(--b-line); }
  .timeline li::before { display: none; }
  .dot { top: -0.36rem; left: 0; }
  .v { font-size: 0.85rem; }
  .who { margin-top: 0.5rem; }
  .call, .note { grid-column: 1; }
  .refused { border-top-style: dashed !important; border-top-color: var(--b-danger) !important; }
}

/* timeline entries arrive one by one */
.lb-js .timeline[data-reveal] { transform: none; }
.lb-js .timeline li { opacity: 0; transform: translateY(8px); transition: opacity 0.6s var(--b-ease), transform 0.7s var(--b-ease); transition-delay: calc(var(--i) * 0.28s + 0.1s); }
.lb-js .timeline.is-in li { opacity: 1; transform: none; }

@media (prefers-reduced-motion: reduce) {
  .lb-js .timeline li { opacity: 1; transform: none; transition: none; }
  .lb-js .tokens.is-in .revoking .t-btn { animation: none; }
  .lb-js .tokens.is-in .revoking, .lb-js .tokens.is-in .revoking .label-on, .lb-js .tokens.is-in .revoking .label-off { animation-delay: 0s; }
}
</style>
