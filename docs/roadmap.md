# Technical roadmap

This file says where the stack goes after the hackathon, and what must be true before each move.
Checked on 2026-10-31 UTC. Check each fact again before you act on it.

## Now

| Part | Stack | Runs on |
|---|---|---|
| Page | Astro, TypeScript, no client framework | GitHub Pages |
| Server | Python, FastAPI | Modal |
| Muse | HTTP API | Baseten |

## Move 1: GitHub Pages to Cloudflare

Do this when traffic or limits call for it. It needs no code change.

1. Connect the repo to a Cloudflare Pages project. Build command: `npm run build`. Output folder: `dist`.
2. Check the project's preview address: a full check runs, and the page has no console errors.
3. Point the DNS record of `doctor.yokoten.app` at Cloudflare.
4. Stop the GitHub Pages workflow.

The address stays the same, so the server's allowed origin stays the same.
The preview address is not an allowed origin, so step 2 needs a temporary entry in `ALLOWED_ORIGINS`. Remove it after the check.

## Move 2: the server from Python to TypeScript

Not now. Modal's JavaScript SDK is active, but it does not yet fit this server.

| Question | What we found |
|---|---|
| Can it define a Modal Function or web endpoint? | No. Modal's docs: "defining Modal Functions will likely remain exclusive to Python". |
| Can it cut a sandbox's network? | Yes. `blockNetwork` at creation, and `updateNetworkPolicy` on a running sandbox. The second one is experimental, in both SDKs. |
| Is it stable? | No. npm `latest` is 0.11.1 and the docs call the SDKs beta. |
| Is it active? | Yes. `js/src/sandbox.ts` had three commits in October 2026. |
| Does it run on Cloudflare Workers? | Not confirmed. The README names Node.js, Deno and Bun. It uses gRPC through `nice-grpc`. The repo's `js` folder has no result for "cloudflare" or "workerd" in code search. |

So a TypeScript server needs a new host. It cannot stay on Modal as a Function.

### Do the move only when all of these are true

1. The SDK has a stable release, or we accept the beta in writing, with a pinned version.
2. A test on the chosen host shows this order: clone with network, cut the network, then a command in the sandbox fails to reach the internet.
3. The chosen host streams a response for at least 60 seconds with no buffering.
4. The rate limit and the 24-hour cache have a place on that host.
5. Every test in `test/server` and `test/record` has a TypeScript version that passes.

### Order of work

1. Spike: one sandbox, the network test above, on Cloudflare Workers first. If Workers fails, try a small Node host.
2. Port the pure parts first: `repo_url`, `result`, `fixes/select_files`, `fixes/build`, `record/document`.
3. Port the record writers. Node's `crypto` replaces the `cryptography` package.
4. Port the stream and the sandbox calls last.
5. Run both servers on real repos, and compare the event streams and result hashes.
6. Point the page at the new server, in one change to the API constant and the Content-Security-Policy tag.
7. Keep the Python server for one week, then remove it.

## Move 3: a network cut with no experimental call

Do this before Move 2, in the Python server. The sandbox now clones with a domain allowlist, then cuts the network with `_experimental_set_outbound_network_policy`. A failed cut stops the check, so this is safe, but the call can change.

1. Clone in one sandbox, into a Modal Volume.
2. Run yokoten in a second sandbox, created with `block_network=True`, with that Volume mounted.
3. Check that a clone and a check together still take under 15 seconds.

## Also after the hackathon

- The rate limit reads a count and then writes it, so parallel requests can pass the limit by a few. Make the count atomic, or accept this in writing.

## What does not change in any move

- A scanned repo's code never runs.
- The network is cut before yokoten runs.
- A result that was recorded stays checkable, as the record document's form does not change.
