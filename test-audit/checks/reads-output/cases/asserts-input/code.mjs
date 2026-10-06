export function normalise(record) {
  return { ...record, title: record.title.trim() };
}
