const worker = new Worker(
    new URL('./Compress.worker.ts', import.meta.url), { type: 'module' });
let tag = 0;
type SuspendType = {
    resolve: (value: Uint8Array) => void,
    reject: (reason?: any) => void

};
const suspend: Map<number, SuspendType> = new Map();
worker.addEventListener('message', (msg) => {
    const { tag, data, error } = msg.data;
    const callback = suspend.get(tag);
    if (callback !== undefined) {
        suspend.delete(tag);
        if (error) callback.reject(error);
        else callback.resolve(data);
    }
});

/// gzip
export function compress(buffer: ArrayBuffer) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
        const messageTag = tag++;
        suspend.set(messageTag, { resolve, reject });
        worker.postMessage({ tag: messageTag, requestDeflate: buffer }, [buffer]);
    });
}

/// gzip
export function decompress(buffer: ArrayBuffer) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
        const messageTag = tag++;
        suspend.set(messageTag, { resolve, reject });
        worker.postMessage({ tag: messageTag, requestInflate: buffer }, [buffer]);
    });
}

export function stringifyAndCompress(obj: unknown) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
        const messageTag = tag++;
        suspend.set(messageTag, { resolve, reject });
        worker.postMessage({ tag: messageTag, stringifyAndDeflate: obj });
    });
}

export function decompressAndJson(arr: ArrayBuffer) {
    return new Promise<any>((resolve, reject) => {
        const messageTag = tag++;
        suspend.set(messageTag, { resolve, reject });
        worker.postMessage({ tag: messageTag, inflateAndJson: arr }, [arr]);
    });
}
