// Partials registry — named, inline, dynamic partials, partial blocks

export class PartialRegistry {
  private partials = new Map<string, string>();

  register(name: string, template: string): void {
    this.partials.set(name, template);
  }

  unregister(name: string): void {
    this.partials.delete(name);
  }

  get(name: string): string | undefined {
    return this.partials.get(name);
  }

  has(name: string): boolean {
    return this.partials.has(name);
  }

  getAll(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [k, v] of this.partials) {
      result[k] = v;
    }
    return result;
  }

  clear(): void {
    this.partials.clear();
  }
}
