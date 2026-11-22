<script setup lang="ts">
const NuxtLink = resolveComponent('NuxtLink')
</script>

<template>
  <section id="try" class="lb-section closing" aria-labelledby="try-title">
    <div class="lb-wrap">
      <div class="frame lb-marks lb-marks--accent" data-reveal>
        <div class="copy">
          <p class="sec-label lb-mono"><span>05</span> Try it</p>
          <h2 id="try-title" class="lb-h2">Bring the pieces <em>together</em>.</h2>
          <p class="lb-lede">
            Open the demo workspace and look around, or read the getting-started guide and
            have your own instance running in a few minutes.
          </p>
          <div class="actions">
            <SButton as="a" href="https://serangkai.onrender.com" target="_blank" rel="noopener" trailing-icon="hugeicons:arrow-up-right-01" color="primary" variant="solid" size="lg">
              Try the demo
            </SButton>
            <SButton :as="NuxtLink" to="/guide/getting-started" color="neutral" variant="outline" size="lg">
              Read the docs
            </SButton>
            <a class="gh" href="https://github.com/sewadahapp/serangkai" rel="noreferrer">
              <SIcon name="hugeicons:github" aria-hidden="true" />
              <span>GitHub</span>
            </a>
          </div>
        </div>

        <div class="card">
          <p class="card-head lb-mono"><span>Demo login</span><span class="host">serangkai.onrender.com</span></p>
          <dl>
            <div><dt>Username</dt><dd class="lb-mono">serangkai</dd></div>
            <div><dt>Password</dt><dd class="lb-mono">serangkai</dd></div>
          </dl>
          <p class="card-note">
            A shared, disposable sandbox that anyone can sign into, so don't store anything
            sensitive. The first load can take a moment.
          </p>
        </div>
      </div>
      <p class="license lb-mono">Open source under the MIT license.</p>
    </div>
  </section>
</template>

<style scoped>
.closing { padding-bottom: clamp(4rem, 8vw, 6rem); }
.frame {
  display: grid;
  gap: 3rem;
  align-items: center;
  padding: clamp(2rem, 6vw, 5rem);
  background: var(--b-table);
}
@media (min-width: 1024px) { .frame { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 5rem; } }
.sec-label {
  display: flex; align-items: center; gap: 0.75rem;
  font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--b-muted);
  margin-bottom: 1.25rem;
}
.sec-label span { color: var(--b-accent); }
.sec-label::after { content: ''; flex: 0 0 3rem; height: 1px; background: var(--b-line); }
.copy .lb-lede { margin-top: 1.5rem; }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem 1rem; margin-top: 2rem; }
.gh {
  display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.25rem;
  font-weight: 500; color: var(--b-ink);
  text-decoration: underline; text-decoration-color: var(--b-line); text-underline-offset: 0.3em;
}
.gh:hover { text-decoration-color: currentColor; }

.card {
  background: var(--b-card);
  border: 1px solid var(--b-line);
  border-radius: 14px;
  padding: 1.5rem;
  box-shadow: var(--b-shadow-set);
}
.card-head { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; font-size: 0.75rem; color: var(--b-muted); margin: 0 0 1rem; text-transform: uppercase; letter-spacing: 0.06em; }
.card-head .host { text-transform: none; letter-spacing: 0; }
.card dl { margin: 0; border-top: 1px solid var(--b-line); }
.card dl div { display: flex; justify-content: space-between; align-items: baseline; padding: 0.85rem 0; border-bottom: 1px solid var(--b-line); }
.card dt { color: var(--b-muted); }
.card dd { margin: 0; font-size: 1.05rem; }
.card-note { margin: 1rem 0 0; color: var(--b-muted); font-size: 0.88rem; line-height: 1.55; }
.license { margin: 2rem 0 0; text-align: center; font-size: 0.75rem; color: var(--b-muted); }
</style>
