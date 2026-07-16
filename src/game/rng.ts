// Seeded xorshift RNG — deterministic so the same seed always produces the same level.
export class RNG {
  private s: number;

  constructor(seed: number) {
    this.s = (seed ^ 0xdeadbeef) >>> 0;
  }

  next(): number {
    let s = this.s;
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    this.s = s >>> 0;
    return (s >>> 0) / 0x100000000;
  }

  int(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }
}
