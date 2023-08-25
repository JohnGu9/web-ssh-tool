import { deflate, inflate, stringifyAndDeflate, inflateAndJson } from "./CompressCommon.ts";

let tag = 0;
type SuspendType = {
    resolve: (value: any) => void,
    reject: (reason?: any) => void

};
const suspend: Map<number, SuspendType> = new Map();
function onMessage(msg: MessageEvent<any>) {
    const { tag, data, error } = msg.data;
    const callback = suspend.get(tag);
    if (callback !== undefined) {
        suspend.delete(tag);
        if (error) callback.reject(error);
        else callback.resolve(data);
    }
}
let closed = false;
function onClose() {
    closed = true;
    suspend.forEach((value) => {
        value.reject(new Error("web worker error"));
    });
    suspend.clear();
}

const worker = new Worker(
    new URL('./Compress.worker.ts', import.meta.url), { type: 'module' });
worker.addEventListener('message', onMessage);
worker.addEventListener('close', onClose, { once: true });
worker.addEventListener('error', onClose, { once: true });

function request<T>() {
    if (closed) return;
    const messageTag = tag++;
    const promise = new Promise<T>((resolve, reject) => {
        suspend.set(messageTag, { resolve, reject });
    });
    return { tag: messageTag, promise };
}

/// gzip
export async function compress(buffer: ArrayBuffer) {
    const req = request<ArrayBuffer>();
    if (req !== undefined) {
        const { tag, promise } = req;
        try {
            worker.postMessage({ tag, requestDeflate: buffer }, [buffer]);
            const res = await promise;
            return res;
        } catch (error) {
        }
    }
    return deflate(buffer);
}

/// gzip
export async function decompress(buffer: ArrayBuffer) {
    const req = request<ArrayBuffer>();
    if (req !== undefined) {
        const { tag, promise } = req;
        try {
            worker.postMessage({ tag, requestInflate: buffer }, [buffer]);
            const res = await promise;
            return res;
        } catch (error) {
        }
    }
    return inflate(buffer);
}

export async function stringifyAndCompress(obj: unknown) {
    const req = request<ArrayBuffer>();
    if (req !== undefined) {
        const { tag, promise } = req;
        try {
            worker.postMessage({ tag, stringifyAndDeflate: obj });
            const res = await promise;
            return res;
        } catch (error) {
        }
    }
    return stringifyAndDeflate(obj);
}

export async function decompressAndJson(arr: ArrayBuffer) {
    const req = request<any>();
    if (req !== undefined) {
        const { tag, promise } = req;
        try {
            worker.postMessage({ tag, inflateAndJson: arr }, [arr]);
            const res = await promise;
            return res;
        } catch (error) {
        }
    }
    return inflateAndJson(arr);
}
