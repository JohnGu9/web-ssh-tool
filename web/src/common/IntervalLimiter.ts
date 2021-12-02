import delay from "./Delay";

/// Limit async task involve interval. 
/// Any task involved faster than interval or last task will be dropped! 
class IntervalLimiter {
  constructor(props: { interval: number }) {
    this._interval = props.interval;
    this._current = Promise.resolve([]);
  }

  _interval: number;
  _current: Promise<void[]>;
  _next?: () => Promise<void>;

  async post(fn: () => Promise<void>, interval?: number) {
    this._next = fn;
    await this._current;
    if (this._next === fn) {
      this._current = Promise.all([fn(), delay(interval ?? this._interval)]);
      await this._current;
    }
  }
}

export default IntervalLimiter;
