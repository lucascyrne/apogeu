export class PresenceHold {
  private missing = 0;
  private seen = false;

  constructor(private hold = 8) {}

  update(present: boolean): boolean {
    if (present) {
      this.missing = 0;
      this.seen = true;
      return true;
    }
    this.missing += 1;
    if (this.seen && this.missing < this.hold) return true;
    this.seen = false;
    return false;
  }
}
