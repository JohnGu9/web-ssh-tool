import pako from 'pako';

/* eslint-disable no-restricted-globals */
self.onmessage = msg => {
  const { tag, data } = msg.data;
  try {
    const deflate = pako.deflate(new Uint8Array(data), { level: 9 });
    self.postMessage({ tag, data: deflate }, [deflate.buffer]);
  } catch (error) {
    self.postMessage({ tag, error });
  }
}