import agentView from "../data/agent-view.md?raw";

export function GET(): Response {
  return new Response(agentView, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
