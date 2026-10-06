export class Calendar {
  #bookings = new Map();

  book(slot, who) {
    if (this.#bookings.has(slot)) throw new Error(`${slot} is taken`);
    this.#bookings.set(slot, { slot, who });
  }

  bookingAt(slot) {
    return this.#bookings.get(slot) ?? null;
  }
}
