// src/test-utils.ts
export function getJSRuntime(logs = []) {
    class Tuple extends Array {
        constructor(...args) {
            super();
            const elements = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
            this.push(...elements);
            Object.freeze(this);
        }
        toString() {
            if (this.length === 1)
                return `(${this[0]},)`;
            return `(${this.join(", ")})`;
        }
    }
    const runtime = {
        print: (val) => {
            const format = (v) => {
                if (v instanceof Tuple)
                    return v.toString();
                if (v instanceof Set)
                    return `set([${Array.from(v)
                        .map((x) => format(x))
                        .join(", ")}])`;
                if (v instanceof Uint8Array)
                    return `b'${Array.from(v)
                        .map((b) => "\\x" + b.toString(16).padStart(2, "0"))
                        .join("")}'`;
                if (Array.isArray(v))
                    return `[${v.map((x) => format(x)).join(", ")}]`;
                if (v !== null && typeof v === "object" && !(v instanceof Date)) {
                    return `{${Object.entries(v)
                        .map(([k, val]) => `${JSON.stringify(k)}: ${format(val)}`)
                        .join(", ")}}`;
                }
                return String(v);
            };
            logs.push(format(val));
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
            if (obj instanceof Set || obj instanceof Map)
                return obj.size;
            if (obj instanceof Uint8Array)
                return obj.length;
            if (typeof obj === "object")
                return Object.keys(obj).length;
            return 0;
        },
        abs: (val) => Math.abs(val),
        math: Math,
        int: (val) => {
            if (typeof val === "string") {
                const trimmed = val.trim();
                try {
                    if (trimmed === "")
                        throw new Error("empty string");
                    const truncated = trimmed.split(".")[0];
                    const b = BigInt(truncated);
                    if (b <= BigInt(Number.MAX_SAFE_INTEGER) &&
                        b >= BigInt(Number.MIN_SAFE_INTEGER)) {
                        return Number(b);
                    }
                    return b;
                }
                catch {
                    throw new Error(`invalid literal for int() with base 10: '${val}'`);
                }
            }
            if (typeof val === "number")
                return Math.trunc(val);
            if (typeof val === "bigint")
                return val;
            if (typeof val === "boolean")
                return val ? 1 : 0;
            throw new Error(`int() argument must be a string, a bytes-like object or a real number, not '${typeof val}'`);
        },
        float: (val) => {
            if (typeof val === "string") {
                const trimmed = val.trim();
                const floatLiteralPattern = /^[+-]?(?:Infinity|NaN|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)$/i;
                if (!floatLiteralPattern.test(trimmed)) {
                    throw new Error(`could not convert string to float: '${val}'`);
                }
                return Number(trimmed);
            }
            if (typeof val === "number")
                return val;
            if (typeof val === "bigint")
                return Number(val);
            if (typeof val === "boolean")
                return val ? 1.0 : 0.0;
            throw new Error(`float() argument must be a string or a real number, not '${typeof val}'`);
        },
        bool: (val) => {
            return runtime.__true(val);
        },
        chr: (val) => {
            const codePoint = Number(val);
            if (!Number.isInteger(codePoint) ||
                codePoint < 0 ||
                codePoint > 0x10ffff) {
                throw new Error("chr() arg not in range(0x110000)");
            }
            return String.fromCodePoint(codePoint);
        },
        ord: (val) => {
            if (typeof val === "string" && Array.from(val).length === 1) {
                return val.codePointAt(0);
            }
            if (val instanceof Uint8Array && val.length === 1) {
                return val[0];
            }
            throw new Error("ord() expected a string of length 1 or bytes of length 1");
        },
        tuple: (val) => new Tuple(val),
        set: (val) => new Set(val),
        bytes: (val) => {
            if (typeof val === "string")
                return new TextEncoder().encode(val);
            if (Array.isArray(val))
                return new Uint8Array(val);
            return new Uint8Array();
        },
        __true: (val) => {
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
            if (val instanceof Set || val instanceof Map)
                return val.size > 0;
            if (val instanceof Uint8Array)
                return val.length > 0;
            if (typeof val === "object") {
                if (Object.keys(val).length === 0)
                    return false;
                return true;
            }
            return true;
        },
        __and: async (aFn, bFn) => {
            const a = await aFn();
            return runtime.__true(a) ? await bFn() : a;
        },
        __or: async (aFn, bFn) => {
            const a = await aFn();
            return runtime.__true(a) ? a : await bFn();
        },
        __item: (obj, idx) => {
            if (typeof idx === "number" &&
                idx < 0 &&
                (Array.isArray(obj) ||
                    typeof obj === "string" ||
                    obj instanceof Uint8Array)) {
                return obj[obj.length + idx];
            }
            return obj[idx];
        },
        __add: (a, b) => {
            if ((typeof a === "bigint" || Number.isInteger(a)) &&
                (typeof b === "bigint" || Number.isInteger(b))) {
                const res = BigInt(a) + BigInt(b);
                return res <= BigInt(Number.MAX_SAFE_INTEGER) &&
                    res >= BigInt(Number.MIN_SAFE_INTEGER)
                    ? Number(res)
                    : res;
            }
            return a + b;
        },
        __sub: (a, b) => {
            if ((typeof a === "bigint" || Number.isInteger(a)) &&
                (typeof b === "bigint" || Number.isInteger(b))) {
                const res = BigInt(a) - BigInt(b);
                return res <= BigInt(Number.MAX_SAFE_INTEGER) &&
                    res >= BigInt(Number.MIN_SAFE_INTEGER)
                    ? Number(res)
                    : res;
            }
            return a - b;
        },
        __mul: (a, b) => {
            if ((typeof a === "bigint" || Number.isInteger(a)) &&
                (typeof b === "bigint" || Number.isInteger(b))) {
                const res = BigInt(a) * BigInt(b);
                return res <= BigInt(Number.MAX_SAFE_INTEGER) &&
                    res >= BigInt(Number.MIN_SAFE_INTEGER)
                    ? Number(res)
                    : res;
            }
            return a * b;
        },
        __div: (a, b) => {
            return Number(a) / Number(b);
        },
        __eq: (a, b) => {
            if ((typeof a === "bigint" || Number.isInteger(a)) &&
                (typeof b === "bigint" || Number.isInteger(b))) {
                return BigInt(a) === BigInt(b);
            }
            return a === b;
        },
        __ne: (a, b) => {
            if ((typeof a === "bigint" || Number.isInteger(a)) &&
                (typeof b === "bigint" || Number.isInteger(b))) {
                return BigInt(a) !== BigInt(b);
            }
            return a !== b;
        },
        __lt: (a, b) => {
            if ((typeof a === "bigint" || Number.isInteger(a)) &&
                (typeof b === "bigint" || Number.isInteger(b))) {
                return BigInt(a) < BigInt(b);
            }
            return a < b;
        },
        __gt: (a, b) => {
            if ((typeof a === "bigint" || Number.isInteger(a)) &&
                (typeof b === "bigint" || Number.isInteger(b))) {
                return BigInt(a) > BigInt(b);
            }
            return a > b;
        },
        __le: (a, b) => {
            if ((typeof a === "bigint" || Number.isInteger(a)) &&
                (typeof b === "bigint" || Number.isInteger(b))) {
                return BigInt(a) <= BigInt(b);
            }
            return a <= b;
        },
        __ge: (a, b) => {
            if ((typeof a === "bigint" || Number.isInteger(a)) &&
                (typeof b === "bigint" || Number.isInteger(b))) {
                return BigInt(a) >= BigInt(b);
            }
            return a >= b;
        },
        __slice: (obj, start, stop, step) => {
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
            if (typeof obj === "string")
                return res.join("");
            if (obj instanceof Uint8Array)
                return new Uint8Array(res);
            if (obj instanceof Tuple)
                return new Tuple(res);
            return res;
        },
        __iter: (obj) => obj,
        __tuple: (elements) => new Tuple(elements),
        __set: (elements) => new Set(elements),
        __dict: (entries) => {
            const res = {};
            for (const [k, v] of entries)
                res[k] = v;
            return res;
        },
        __bytes: (val) => {
            const res = new Uint8Array(val.length);
            for (let i = 0; i < val.length; i++)
                res[i] = val.charCodeAt(i);
            return res;
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
