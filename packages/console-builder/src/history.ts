// Console builder — bounded command history with cursor navigation.
// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.

export class History {
  private items: string[];
  private cursor: number;

  constructor(
    initial: string[] = [],
    private readonly limit = 200,
  ) {
    this.items = initial.slice(-limit);
    this.cursor = this.items.length;
  }

  push(line: string): void {
    const t = line.trim();
    if (t && this.items[this.items.length - 1] !== t) {
      this.items.push(t);
      if (this.items.length > this.limit) this.items.shift();
    }
    this.cursor = this.items.length;
  }

  /** Older entry, or null at the start. */
  prev(): string | null {
    if (!this.items.length) return null;
    this.cursor = Math.max(0, this.cursor - 1);
    return this.items[this.cursor];
  }

  /** Newer entry; "" once past the newest (fresh prompt). */
  next(): string {
    this.cursor = Math.min(this.items.length, this.cursor + 1);
    return this.items[this.cursor] ?? "";
  }

  all(): string[] {
    return [...this.items];
  }
}

/** Longest common prefix of completion values, used to extend the input on Tab. */
export function commonPrefix(values: string[]): string {
  if (!values.length) return "";
  let p = values[0];
  for (const v of values.slice(1)) while (!v.toLowerCase().startsWith(p.toLowerCase())) p = p.slice(0, -1);
  return p;
}

/** Replaces the last token of `line` with `value` (quoting it if it has spaces). */
export function applyCompletion(line: string, value: string, final: boolean): string {
  const m = /^(.*?)(\S*)$/.exec(line)!;
  const v = /\s/.test(value) ? `"${value}"` : value;
  return `${m[1]}${v}${final ? " " : ""}`;
}
