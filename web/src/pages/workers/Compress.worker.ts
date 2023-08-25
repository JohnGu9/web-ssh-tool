import pako from 'pako';

/*eslint no-restricted-globals: "off"*/
self.onmessage = msg => {
  const { tag, ...rest } = msg.data;
  for (const [key, value] of Object.entries(rest)) {
    let handleFn;
    switch (key) {
      case 'requestDeflate':
        handleFn = deflate;
        break;
      case 'requestInflate':
        handleFn = inflate;
        break;
      case 'stringifyAndDeflate':
        handleFn = stringifyAndDeflate;
        break;
      case 'inflateAndJson':
        handleFn = inflateAndJson;
        break;
    }
    if (handleFn === undefined) break;
    try {
      const res = handleFn(value as any);
      if (res instanceof ArrayBuffer) {
        self.postMessage({ tag, data: res }, [res]);
      } else {
        self.postMessage({ tag, data: res });
      }
    } catch (error) {
      self.postMessage({ tag, error });
    }
  }
  self.postMessage({ tag, error: new Error("Unknown request") });

}

function deflate(arr: ArrayBuffer) {
  return pako.gzip(new Uint8Array(arr)).buffer;
}

function inflate(arr: ArrayBuffer) {
  return pako.ungzip(new Uint8Array(arr)).buffer;
}

function stringifyAndDeflate(obj: any) {
  const str = JSON.stringify(obj);
  const buf = utf8TextEncode(str);
  const arr = deflate(buf.buffer);
  return arr;
}

function inflateAndJson(arr: ArrayBuffer) {
  const buf = inflate(arr);
  const str = utf8TextDecode(buf);
  const obj = JSON.parse(str);
  return obj;
}

const Utf8TextEncoder = new TextEncoder();// always utf-8
const Utf8TextDecoder = new TextDecoder("utf-8");

export function utf8TextEncode(input: string) {
  return Utf8TextEncoder.encode(input);
}

export function utf8TextDecode(buffer: ArrayBuffer) {
  return Utf8TextDecoder.decode(buffer);
}
