#!/usr/bin/env bash
# Boot the exact target image, exercise SQLite/auth/storage, and restart it.
# QEMU may run the ARM64 runtime on x64, but never the Nuxt compiler.
set -euo pipefail
image="${1:?Usage: smoke-docker.sh IMAGE linux/amd64[,linux/arm64]}"
platforms="${2:?Platforms required}"
workdir="$(mktemp -d)"
container="serangkai-smoke-${RANDOM}-$$"
volume="$container-data"
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  docker volume rm "$volume" >/dev/null 2>&1 || true
}
trap 'cleanup; rm -rf "$workdir"' EXIT
IFS=',' read -ra targets <<< "$platforms"
for platform in "${targets[@]}"; do
  case "$platform" in linux/amd64) expected=x64 ;; linux/arm64) expected=arm64 ;; *) echo "Unsupported platform: $platform" >&2; exit 1 ;; esac
  started=$SECONDS
  cleanup
  # Pull is bounded too. A loaded rehearsal image needs no registry access.
  if ! docker image inspect --platform "$platform" "$image" >/dev/null 2>&1; then
    timeout 120 docker pull --platform "$platform" "$image"
  fi
  actual="$(timeout 30 docker run --rm --platform "$platform" --entrypoint bun "$image" -e 'console.log(process.arch)')"
  [[ "$actual" == "$expected" ]] || { echo "Expected $expected, got $actual" >&2; exit 1; }
  docker volume create "$volume" >/dev/null
  jwt="$(openssl rand -hex 32)"
  share="$(openssl rand -hex 32)"
  for boot in 1 2; do
    docker run -d --name "$container" --platform "$platform" -p 127.0.0.1::3000 -v "$volume:/data" \
      -e ADMIN_USERNAME=smoke -e ADMIN_PASSWORD=smoke-test-password \
      -e JWT_SECRET="$jwt" -e SHARE_SECRET="$share" -e NUXT_SESSION_COOKIE_SECURE=false "$image" >/dev/null
    port="$(docker port "$container" 3000/tcp | head -1 | sed 's/.*://')"
    base="http://127.0.0.1:$port"
    healthy=false
    for attempt in $(seq 1 60); do
      if curl -fsS --max-time 2 "$base/api/health" > "$workdir/health.json" 2>/dev/null; then healthy=true; break; fi
      if [[ "$(docker inspect --format '{{.State.Running}}' "$container")" != true ]]; then break; fi
      sleep 1
    done
    if [[ "$healthy" != true ]]; then docker logs "$container"; echo "Image failed startup on $platform" >&2; exit 1; fi
    curl -fsS --max-time 15 -c "$workdir/cookies" -H 'content-type: application/json' \
      -d '{"username":"smoke","password":"smoke-test-password"}' "$base/api/auth/login" >/dev/null
    if [[ "$boot" == 1 ]]; then
      curl -fsS --max-time 15 -b "$workdir/cookies" -H 'content-type: application/json' \
        -d '{"title":"Docker SQLite smoke","type":"markdown","content":"# Persistent smoke","visibility":"private"}' "$base/api/rangka" > "$workdir/created.json"
      printf '\x89PNG\r\n\x1a\n' > "$workdir/pixel.png"
      curl -fsS --max-time 15 -b "$workdir/cookies" -F "file=@$workdir/pixel.png;type=image/png" -F 'title=Docker storage smoke' "$base/api/rangka/upload" >/dev/null
    else
      curl -fsS --max-time 15 -b "$workdir/cookies" "$base/api/rangka" > "$workdir/list.json"
      for title in 'Docker SQLite smoke' 'Docker storage smoke'; do
        grep -q "$title" "$workdir/list.json" || { echo "State lost on $platform: $title" >&2; exit 1; }
      done
    fi
    docker rm -f "$container" >/dev/null
  done
  elapsed=$((SECONDS - started))
  echo "$platform: boot, SQLite writes, upload, and restart passed in ${elapsed}s"
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then echo "- $platform container smoke: ${elapsed}s (auth, SQLite, upload, restart)" >> "$GITHUB_STEP_SUMMARY"; fi
done
