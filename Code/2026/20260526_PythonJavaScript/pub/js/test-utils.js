// src/test-utils.ts
export function getJSRuntime(logs = []) {
    const runtime = {
        print: (val) => {
            if (Array.isArray(val)) {
                logs.push(`[${val.map((v) => String(v)).join(", ")}]`);
            }
            else {
                logs.push(String(val));
            }
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
            return runtime._is_truthy(val);
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
        _binop: (op, a, b) => {
            const isAInt = typeof a === "bigint" || Number.isInteger(a);
            const isBInt = typeof b === "bigint" || Number.isInteger(b);
            if (isAInt && isBInt) {
                const ba = BigInt(a);
                const bb = BigInt(b);
                let res;
                switch (op) {
                    case "+":
                        res = ba + bb;
                        break;
                    case "-":
                        res = ba - bb;
                        break;
                    case "*":
                        res = ba * bb;
                        break;
                    case "/":
                        res = Number(ba) / Number(bb);
                        break;
                    case "===":
                        return ba === bb;
                    case "!==":
                        return ba !== bb;
                    case "<":
                        return ba < bb;
                    case ">":
                        return ba > bb;
                    case "<=":
                        return ba <= bb;
                    case ">=":
                        return ba >= bb;
                    default:
                        throw new Error(`Operator ${op} not implemented for integers`);
                }
                if (res <= BigInt(Number.MAX_SAFE_INTEGER) &&
                    res >= BigInt(Number.MIN_SAFE_INTEGER)) {
                    return Number(res);
                }
                return res;
            }
            switch (op) {
                case "+":
                    return a + b;
                case "-":
                    return a - b;
                case "*":
                    return a * b;
                case "/":
                    return a / b;
                case "===":
                    return a === b;
                case "!==":
                    return a !== b;
                case "<":
                    return a < b;
                case ">":
                    return a > b;
                case "<=":
                    return a <= b;
                case ">=":
                    return a >= b;
                default:
                    throw new Error(`Operator ${op} not implemented`);
            }
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
