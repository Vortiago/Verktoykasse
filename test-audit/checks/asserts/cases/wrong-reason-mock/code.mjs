import { saveUser } from "./store.mjs";

export function save(user) {
  if (!user.email) throw new Error("a user needs an email");
  return saveUser({ ...user, email: user.email.toLowerCase() });
}
