export function buildJob({ name, steps }) {
  return { name, steps, status: "queued", createdAt: Date.now() };
}
