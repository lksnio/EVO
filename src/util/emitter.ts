type Handler = (...args: any[]) => void;

/**
 * Ein schlichter Ereignis-Verteiler ohne Phaser: Szenen, Spielstand und (später) Netzwerk reden darüber miteinander.
 * Dieselbe Schnittstelle wie bisher (on/once/off/emit) – nur ohne Abhängigkeit vom Browser, damit der Spielstand auch in
 * Tests und auf dem Server geladen werden kann.
 */
export class Emitter {
  private map = new Map<string, Set<Handler>>();

  on(ev: string, fn: Handler) {
    let s = this.map.get(ev);
    if (!s) this.map.set(ev, (s = new Set()));
    s.add(fn);
    return this;
  }

  once(ev: string, fn: Handler) {
    const wrap: Handler = (...args) => {
      this.off(ev, wrap);
      fn(...args);
    };
    return this.on(ev, wrap);
  }

  off(ev: string, fn?: Handler) {
    if (!fn) this.map.delete(ev);
    else this.map.get(ev)?.delete(fn);
    return this;
  }

  emit(ev: string, ...args: unknown[]) {
    const s = this.map.get(ev);
    if (!s || !s.size) return false;
    for (const fn of [...s]) fn(...args);
    return true;
  }
}
