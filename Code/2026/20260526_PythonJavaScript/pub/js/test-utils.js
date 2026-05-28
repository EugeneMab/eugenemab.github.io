// src/test-utils.ts
export function getJSRuntime(logs = []) {
    const runtime = {
        print: (val) => {
            logs.push(String(val));
            return 0;
        },
        sleep: async (ms) => {
            return new Promise((resolve) => setTimeout(resolve, ms));
        },
        range: (start, stop, step = 1) => {
            if (stop === undefined) {
                stop = start;
                start = 0;
            }
            const res = [];
            for (let i = start; i < stop; i += step)
                res.push(i);
            return res;
        },
        len: (obj) => {
            if (Array.isArray(obj) || typeof obj === "string")
                return obj.length;
            if (typeof obj === "object")
                return Object.keys(obj).length;
            return 0;
        },
        abs: (val) => Math.abs(val),
        math: Math,
        int: (val) => {
            if (typeof val === "string") {
                try {
                    const truncated = val.split(".")[0];
                    const b = BigInt(truncated);
                    if (b <= BigInt(Number.MAX_SAFE_INTEGER) &&
                        b >= BigInt(Number.MIN_SAFE_INTEGER)) {
                        return Number(b);
                    }
                    return b;
                }
                catch {
                    return 0;
                }
            }
            if (typeof val === "number")
                return Math.trunc(val);
            if (typeof val === "bigint")
                return val;
            if (typeof val === "boolean")
                return val ? 1 : 0;
            return 0;
        },
        float: (val) => {
            if (typeof val === "string")
                return parseFloat(val);
            if (typeof val === "number")
                return val;
            if (typeof val === "bigint")
                return Number(val);
            if (typeof val === "boolean")
                return val ? 1.0 : 0.0;
            return 0.0;
        },
        bool: (val) => {
            return runtime._is_truthy(val);
        },
        chr: (val) => String.fromCharCode(Number(val)),
        ord: (val) => {
            if (typeof val === "string" && val.length > 0)
                return val.charCodeAt(0);
            throw new Error("ord() expected a string of length 1");
        },
        _is_truthy: (val) => {
            if (val === null || val === undefined)
                return false;
            if (typeof val === "boolean")
                return val;
            if (typeof val === "number")
                return val !== 0;
            if (typeof val === "bigint")
                return val !== 0n;
            if (typeof val === "string")
                return val.length > 0;
            if (Array.isArray(val))
                return val.length > 0;
            if (typeof val === "object") {
                if (Object.keys(val).length === 0)
                    return false;
                return true;
            }
            return true;
        },
        _slice: (obj, start, stop, step) => {
            const len = obj.length;
            if (step === undefined || step === null)
                step = 1;
            if (start === undefined || start === null)
                start = step > 0 ? 0 : len - 1;
            if (stop === undefined || stop === null)
                stop = step > 0 ? len : -1;
            if (start < 0)
                start += len;
            if (stop < 0)
                stop += len;
            const res = [];
            if (step > 0) {
                for (let i = start; i < stop; i += step)
                    if (i >= 0 && i < len)
                        res.push(obj[i]);
            }
            else {
                for (let i = start; i > stop; i += step)
                    if (i >= 0 && i < len)
                        res.push(obj[i]);
            }
            return typeof obj === "string" ? res.join("") : res;
        },
    };
    return runtime;
}
export async function runJS(jsCode, runtime) {
    const wrappedJs = jsCode.replace("export async function main_wrapper", "async function main_wrapper");
    const execute = new Function("runtime", `
    ${wrappedJs}
    return main_wrapper(runtime);
  `);
    return await execute(runtime);
}
