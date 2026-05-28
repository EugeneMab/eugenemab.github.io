// src/test-utils.ts
export function getJSRuntime(logs = []) {
    return {
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
}
export async function runJS(jsCode, runtime) {
    const wrappedJs = jsCode.replace("export async function main_wrapper", "async function main_wrapper");
    const execute = new Function("runtime", `
    ${wrappedJs}
    return main_wrapper(runtime);
  `);
    return await execute(runtime);
}
