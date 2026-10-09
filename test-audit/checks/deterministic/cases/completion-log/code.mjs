export async function runJob(name, log) {
  await fetch(`/jobs/${name}`);
  log.push(name);
}
