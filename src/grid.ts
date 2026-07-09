// grid.ts — A tiny typed 2D scalar field used throughout the engine.
//
// Every spatial layer (elevation, temperature, moisture, ...) is a Grid:
// a flat Float64Array plus width/height. Keeping one shared type means
// renderers, analyzers, and future subsystems all speak the same language.

export class Grid {
  readonly width: number;
  readonly height: number;
  readonly data: Float64Array;

  constructor(width: number, height: number, fill = 0) {
    this.width = width;
    this.height = height;
    this.data = new Float64Array(width * height);
    if (fill !== 0) this.data.fill(fill);
  }

  index(x: number, y: number): number {
    return y * this.width + x;
  }

  get(x: number, y: number): number {
    return this.data[y * this.width + x];
  }

  set(x: number, y: number, value: number): void {
    this.data[y * this.width + x] = value;
  }

  /** Clamped sampling — reads outside the grid return the nearest edge value. */
  getClamped(x: number, y: number): number {
    const cx = x < 0 ? 0 : x >= this.width ? this.width - 1 : x;
    const cy = y < 0 ? 0 : y >= this.height ? this.height - 1 : y;
    return this.data[cy * this.width + cx];
  }

  /** Fill every cell from a function of its coordinates. */
  fillFn(fn: (x: number, y: number) => number): this {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.data[y * this.width + x] = fn(x, y);
      }
    }
    return this;
  }

  /** Map each value through fn, in place. */
  mapInPlace(fn: (value: number, x: number, y: number) => number): this {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const i = y * this.width + x;
        this.data[i] = fn(this.data[i], x, y);
      }
    }
    return this;
  }

  /** Min and max of the whole field. */
  extent(): { min: number; max: number } {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < this.data.length; i++) {
      const v = this.data[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return { min, max };
  }

  /** Rescale values to [0, 1] based on current extent. Flat fields → all 0. */
  normalize(): this {
    const { min, max } = this.extent();
    const span = max - min;
    if (span === 0) {
      this.data.fill(0);
      return this;
    }
    const inv = 1 / span;
    for (let i = 0; i < this.data.length; i++) {
      this.data[i] = (this.data[i] - min) * inv;
    }
    return this;
  }

  clone(): Grid {
    const g = new Grid(this.width, this.height);
    g.data.set(this.data);
    return g;
  }
}
