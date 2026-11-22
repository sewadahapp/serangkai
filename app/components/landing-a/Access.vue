<script setup lang="ts">
const revoked = ref(false)
</script>

<template>
  <div class="access-card">
    <div class="access-top">
      <span><LandingAIcon name="key" /> Connected agents</span>
      <span class="example-label">Example</span>
    </div>
    <div class="access-body">
      <div class="agent">
        <span class="agent-icon"><LandingAIcon name="terminal" /></span>
        <div><h3>Reporting agent</h3><p>OAuth 2.1 · MCP</p></div>
        <span class="agent-status" :class="{ revoked }" role="status">
          <i /> {{ revoked ? 'Revoked' : 'Connected' }}
        </span>
      </div>
      <dl class="scopes">
        <div><dt><code>read</code></dt><dd>List and open rangka</dd></div>
        <div><dt><code>write</code></dt><dd>Create and update rangka</dd></div>
      </dl>
      <div class="access-bottom">
        <span>{{ revoked ? 'Access removed' : '2 scopes granted' }}</span>
        <button type="button" @click="revoked = !revoked">
          {{ revoked ? 'Reset example' : 'Revoke access' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.access-card { background: var(--a-panel); border: 1px solid var(--a-rule); border-radius: 12px; overflow: hidden; }
.access-top { min-height: 44px; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 16px; background: var(--a-windowbar); border-bottom: 1px solid var(--a-rule); font-size: 12px; font-weight: 650; }
.access-top span:first-child { display: flex; align-items: center; gap: 7px; }
.access-top svg { color: var(--a-accent); width: 15px; height: 15px; }
.example-label { color: var(--a-muted); font: 11px var(--a-mono); }
.access-body { padding: clamp(15px, 3vw, 25px); }
.agent { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 10px; }
.agent-icon { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 6px; background: var(--a-accent-soft); color: var(--a-accent); }
.agent h3 { font-size: 15px; font-weight: 680; }
.agent p { margin: 1px 0 0; color: var(--a-muted); font: 11px/1.4 var(--a-mono); }
.agent-status { display: inline-flex; align-items: center; gap: 6px; color: var(--a-accent); font: 600 11px var(--a-mono); }
.agent-status i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.agent-status.revoked { color: var(--a-copper); }
.scopes { margin: 20px 0 0; border-block: 1px solid var(--a-rule); }
.scopes > div { display: grid; grid-template-columns: 77px 1fr; gap: 10px; align-items: center; min-height: 42px; padding: 5px 0; font-size: 13px; }
.scopes > div + div { border-top: 1px solid var(--a-rule); }
.scopes code { display: inline-block; padding: 3px 6px; border-radius: 4px; background: var(--a-accent-soft); color: var(--a-accent); font: 12px var(--a-mono); }
.scopes dd { color: var(--a-muted); }
.access-bottom { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding-top: 13px; color: var(--a-muted); font: 11px var(--a-mono); }
.access-bottom button { min-height: 44px; padding: 5px 11px; border: 1px solid var(--a-rule); border-radius: 5px; color: var(--a-copper); font-size: 12px; font-weight: 650; cursor: pointer; }
.access-bottom button:hover { border-color: var(--a-copper); background: var(--a-copper-soft); }
</style>
