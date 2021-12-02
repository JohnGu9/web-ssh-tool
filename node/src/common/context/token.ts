import { v1 as uuid } from 'uuid';

class Token {
  _cache = new Set<string>();

  generate(options?: { timeout: number }) {
    const value = uuid();
    this._cache.add(value);
    setTimeout(() => {
      if (this._cache.has(value)) this._cache.delete(value);
    }, options?.timeout ?? 10 * 1000);
    return value;
  }

  verify(value: string) {
    if (this._cache.has(value)) {
      this._cache.delete(value);
      return true;
    }
    return false;
  }
}

export default Token;
