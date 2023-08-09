import pako from 'pako';

/* eslint-disable no-restricted-globals */
self.onmessage = msg => {
  const { tag, requestDeflate, requestInflate } = msg.data;
  if (requestDeflate !== undefined) {
    try {
      const deflate = pako.gzip(new Uint8Array(requestDeflate));
      self.postMessage({ tag, data: deflate }, [deflate.buffer]);
    } catch (error) {
      self.postMessage({ tag, error });
    }
  } else if (requestInflate !== undefined) {
    try {
      const inflate = pako.ungzip(new Uint8Array(requestInflate));
      self.postMessage({ tag, data: inflate }, [inflate.buffer]);
    } catch (error) {
      self.postMessage({ tag, error });
    }
  }
}
