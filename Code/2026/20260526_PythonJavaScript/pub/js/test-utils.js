// src/test-utils.ts
export function getJSRuntime(logs = []) {
    const __format = (v, isElement = false) => {
        if (v instanceof Tuple)
            return v.toString();
        if (v instanceof Set)
            return `set([${Array.from(v)
                .map((x) => __format(x, true))
                .join(", ")}])`;
        if (v instanceof Uint8Array)
            return `b'${Array.from(v)
                .map((b) => "\\x" + b.toString(16).padStart(2, "0"))
                .join("")}'`;
        if (Array.isArray(v))
            return `[${v.map((x) => __format(x, true)).join(", ")}]`;
        if (typeof v === "string")
            return isElement ? `'${v}'` : v;
        if (v !== null && typeof v === "object" && !(v instanceof Date)) {
            return `{${Object.entries(v)
                .map(([k, val]) => `${__format(k, true)}: ${__format(val, true)}`)
                .join(", ")}}`;
        }
        return String(v);
    };
    class Tuple extends Array {
        constructor(...args) {
            super();
            const elements = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
            this.push(...elements);
            Object.freeze(this);
        }
        [Symbol.toPrimitive](_hint) {
            return this.toString();
        }
        toString() {
            const elements = Array.from(this)
                .map((x) => __format(x, true))
                .join(", ");
            if (this.length === 1)
                return `(${elements},)`;
            return `(${elements})`;
        }
    }
    const runtime = {
        print: (val) => {
            logs.push(__format(val));
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
        tuple: (val) => {
            if (val === undefined)
                return new Tuple();
            if (Array.isArray(val))
                return new Tuple(val);
            if (typeof val[Symbol.iterator] === "function")
                return new Tuple([...val]);
            return new Tuple([val]);
        },
        set: (val) => {
            if (val === undefined)
                return new Set();
            if (typeof val[Symbol.iterator] === "function")
                return new Set(val);
            return new Set([val]);
        },
        frozenset: (val) => {
            return runtime.set(val);
        },
        bytes: (val, _encoding) => {
            if (val === undefined)
                return new Uint8Array();
            if (typeof val === "number")
                return new Uint8Array(val);
            if (typeof val === "string") {
                return new TextEncoder().encode(val);
            }
            if (Array.isArray(val) || val instanceof Uint8Array)
                return new Uint8Array(val);
            return new Uint8Array();
        },
        bytearray: (val) => {
            return runtime.bytes(val);
        },
        dict: (val) => {
            if (val === undefined)
                return Object.create(null);
            if (Array.isArray(val)) {
                const res = Object.create(null);
                for (const item of val) {
                    if (Array.isArray(item) && item.length === 2) {
                        res[item[0]] = item[1];
                    }
                }
                return res;
            }
            return Object.assign(Object.create(null), val);
        },
        sum: (iterable, start = 0) => {
            let res = start;
            for (const item of iterable) {
                res = runtime.__add(res, item);
            }
            return res;
        },
        any: (iterable) => {
            for (const item of iterable) {
                if (runtime.__true(item))
                    return true;
            }
            return false;
        },
        all: (iterable) => {
            for (const item of iterable) {
                if (!runtime.__true(item))
                    return false;
            }
            return true;
        },
        max: (...args) => {
            let iterable = args;
            if (args.length === 1) {
                iterable = args[0];
            }
            let res = undefined;
            for (const item of iterable) {
                if (res === undefined || runtime.__gt(item, res))
                    res = item;
            }
            if (res === undefined)
                throw new Error("max() arg is an empty sequence");
            return res;
        },
        min: (...args) => {
            let iterable = args;
            if (args.length === 1) {
                iterable = args[0];
            }
            let res = undefined;
            for (const item of iterable) {
                if (res === undefined || runtime.__lt(item, res))
                    res = item;
            }
            if (res === undefined)
                throw new Error("min() arg is an empty sequence");
            return res;
        },
        enumerate: (iterable, start = 0) => {
            const res = [];
            let i = start;
            for (const item of iterable) {
                res.push(new Tuple([i++, item]));
            }
            return res;
        },
        zip: (...iterables) => {
            const iters = iterables.map((it) => Array.from(it));
            const minLen = Math.min(...iters.map((it) => it.length));
            const res = [];
            for (let i = 0; i < minLen; i++) {
                res.push(new Tuple(iters.map((it) => it[i])));
            }
            return res;
        },
        reversed: (seq) => {
            const arr = Array.from(seq);
            arr.reverse();
            return arr;
        },
        sorted: (iterable, _key, reverse = false) => {
            const arr = Array.from(iterable);
            arr.sort((a, b) => {
                const va = a;
                const vb = b;
                if (runtime.__lt(va, vb))
                    return reverse ? 1 : -1;
                if (runtime.__gt(va, vb))
                    return reverse ? -1 : 1;
                return 0;
            });
            return arr;
        },
        type: (obj) => {
            if (obj === null)
                return "NoneType";
            if (obj instanceof Tuple)
                return "tuple";
            if (obj instanceof Set)
                return "set";
            if (obj instanceof Uint8Array)
                return "bytes";
            if (Array.isArray(obj))
                return "list";
            return typeof obj;
        },
        isinstance: (obj, typeInfo) => {
            const t = runtime.type(obj);
            if (Array.isArray(typeInfo)) {
                return typeInfo.some((ti) => t === ti);
            }
            return t === typeInfo;
        },
        callable: (obj) => typeof obj === "function",
        map: async (func, ...iterables) => {
            if (iterables.length === 0) {
                throw new Error("TypeError: map() must have at least two arguments");
            }
            const iters = iterables.map((it) => Array.from(it));
            const minLen = Math.min(...iters.map((it) => it.length));
            const res = [];
            for (let i = 0; i < minLen; i++) {
                const args = iters.map((it) => it[i]);
                res.push(await func(...args));
            }
            return res;
        },
        filter: async (func, iterable) => {
            const res = [];
            for (const item of iterable) {
                if (runtime.__true(await func(item))) {
                    res.push(item);
                }
            }
            return res;
        },
        reduce: async (func, iterable, initial) => {
            const arr = Array.from(iterable);
            let acc = initial;
            let start = 0;
            if (acc === undefined) {
                if (arr.length === 0)
                    throw new Error("reduce() of empty sequence with no initial value");
                acc = arr[0];
                start = 1;
            }
            for (let i = start; i < arr.length; i++) {
                acc = await func(acc, arr[i]);
            }
            return acc;
        },
        // String methods
        split: (s, sep, maxsplit = -1) => {
            if (typeof s !== "string")
                return s.split(sep, maxsplit);
            if (sep === undefined || sep === null) {
                return s.trim() === "" ? [] : s.trim().split(/\s+/);
            }
            if (maxsplit < 0)
                return s.split(sep);
            const parts = s.split(sep);
            if (parts.length <= maxsplit + 1)
                return parts;
            const res = parts.slice(0, maxsplit);
            res.push(parts.slice(maxsplit).join(sep));
            return res;
        },
        join: (sep, iterable) => {
            const arr = Array.from(iterable).map((x) => String(x));
            return arr.join(String(sep));
        },
        strip: (s, chars) => {
            if (typeof s !== "string")
                return s.strip(chars);
            if (chars === undefined || chars === null)
                return s.trim();
            let start = 0;
            while (start < s.length && chars.includes(s[start]))
                start++;
            let end = s.length - 1;
            while (end >= start && chars.includes(s[end]))
                end--;
            return s.slice(start, end + 1);
        },
        replace: (s, old, sub, count = -1) => {
            if (typeof s !== "string")
                return s.replace(old, sub, count);
            const parts = s.split(old);
            if (count < 0 || parts.length <= count + 1)
                return parts.join(sub);
            return (parts.slice(0, count + 1).join(sub) +
                (parts.length > count + 1 ? old + parts.slice(count + 1).join(old) : ""));
        },
        find: (s, sub, start = 0, end) => {
            if (typeof s !== "string")
                return s.find(sub, start, end);
            const slice = end === undefined ? s.slice(start) : s.slice(start, end);
            const res = slice.indexOf(sub);
            return res === -1 ? -1 : res + start;
        },
        upper: (s) => (typeof s === "string" ? s.toUpperCase() : s.upper()),
        lower: (s) => (typeof s === "string" ? s.toLowerCase() : s.lower()),
        // List methods
        append: (l, x) => {
            if (Array.isArray(l)) {
                l.push(x);
                return undefined;
            }
            return l.append(x);
        },
        extend: (l, iterable) => {
            if (Array.isArray(l)) {
                l.push(...iterable);
                return undefined;
            }
            return l.extend(iterable);
        },
        insert: (l, i, x) => {
            if (Array.isArray(l)) {
                l.splice(i, 0, x);
                return undefined;
            }
            return l.insert(i, x);
        },
        remove: (l, x) => {
            if (Array.isArray(l)) {
                const idx = l.indexOf(x);
                if (idx === -1)
                    throw new Error("list.remove(x): x not in list");
                l.splice(idx, 1);
                return undefined;
            }
            return l.remove(x);
        },
        pop: (l, i = -1) => {
            if (Array.isArray(l)) {
                const idx = i < 0 ? l.length + i : i;
                if (idx < 0 || idx >= l.length)
                    throw new Error("pop index out of range");
                return l.splice(idx, 1)[0];
            }
            return l.pop(i);
        },
        sort: (l, _key, reverse = false) => {
            if (Array.isArray(l)) {
                l.sort((a, b) => {
                    if (runtime.__lt(a, b))
                        return reverse ? 1 : -1;
                    if (runtime.__gt(a, b))
                        return reverse ? -1 : 1;
                    return 0;
                });
                return undefined;
            }
            return l.sort(_key, reverse);
        },
        reverse: (l) => {
            if (Array.isArray(l)) {
                l.reverse();
                return undefined;
            }
            return l.reverse();
        },
        // Protocol methods
        __enter__: async (obj, fallback) => {
            if (obj != null && typeof obj.__enter__ === "function") {
                return await obj.__enter__();
            }
            if (typeof fallback === "function") {
                return await fallback(obj);
            }
            return obj;
        },
        __exit__: async (obj, a, b, c, fallback) => {
            if (obj != null && typeof obj.__exit__ === "function") {
                return await obj.__exit__(a, b, c);
            }
            if (typeof fallback === "function") {
                return await fallback(obj, a, b, c);
            }
            return undefined;
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
        __set_item: (obj, idx, val) => {
            if (typeof idx === "number" &&
                idx < 0 &&
                (Array.isArray(obj) || obj instanceof Uint8Array)) {
                obj[obj.length + idx] = val;
            }
            else {
                obj[idx] = val;
            }
            return val;
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
        __floordiv: (a, b) => {
            if ((typeof a === "bigint" || Number.isInteger(a)) &&
                (typeof b === "bigint" || Number.isInteger(b))) {
                const ab = BigInt(a);
                const bb = BigInt(b);
                let res = ab / bb;
                if (ab < 0n !== bb < 0n && ab % bb !== 0n)
                    res -= 1n;
                return res <= BigInt(Number.MAX_SAFE_INTEGER) &&
                    res >= BigInt(Number.MIN_SAFE_INTEGER)
                    ? Number(res)
                    : res;
            }
            return Math.floor(Number(a) / Number(b));
        },
        __mod: (a, b) => {
            if ((typeof a === "bigint" || Number.isInteger(a)) &&
                (typeof b === "bigint" || Number.isInteger(b))) {
                const ab = BigInt(a);
                const bb = BigInt(b);
                const res = ab % bb;
                const res_py = ((res % bb) + bb) % bb;
                return res_py <= BigInt(Number.MAX_SAFE_INTEGER) &&
                    res_py >= BigInt(Number.MIN_SAFE_INTEGER)
                    ? Number(res_py)
                    : res_py;
            }
            const res = Number(a) % Number(b);
            return ((res % Number(b)) + Number(b)) % Number(b);
        },
        __pow: (a, b) => {
            if ((typeof a === "bigint" || Number.isInteger(a)) &&
                (typeof b === "bigint" || Number.isInteger(b))) {
                const ab = BigInt(a);
                const bb = BigInt(b);
                if (bb < 0n)
                    return Math.pow(Number(a), Number(b));
                const res = ab ** bb;
                return res <= BigInt(Number.MAX_SAFE_INTEGER) &&
                    res >= BigInt(Number.MIN_SAFE_INTEGER)
                    ? Number(res)
                    : res;
            }
            return Math.pow(Number(a), Number(b));
        },
        __and_bw: (a, b) => {
            if ((typeof a === "bigint" || Number.isInteger(a)) &&
                (typeof b === "bigint" || Number.isInteger(b))) {
                const res = BigInt(a) & BigInt(b);
                return res <= BigInt(Number.MAX_SAFE_INTEGER) &&
                    res >= BigInt(Number.MIN_SAFE_INTEGER)
                    ? Number(res)
                    : res;
            }
            return a & b;
        },
        __or_bw: (a, b) => {
            if ((typeof a === "bigint" || Number.isInteger(a)) &&
                (typeof b === "bigint" || Number.isInteger(b))) {
                const res = BigInt(a) | BigInt(b);
                return res <= BigInt(Number.MAX_SAFE_INTEGER) &&
                    res >= BigInt(Number.MIN_SAFE_INTEGER)
                    ? Number(res)
                    : res;
            }
            return a | b;
        },
        __xor_bw: (a, b) => {
            if ((typeof a === "bigint" || Number.isInteger(a)) &&
                (typeof b === "bigint" || Number.isInteger(b))) {
                const res = BigInt(a) ^ BigInt(b);
                return res <= BigInt(Number.MAX_SAFE_INTEGER) &&
                    res >= BigInt(Number.MIN_SAFE_INTEGER)
                    ? Number(res)
                    : res;
            }
            return a ^ b;
        },
        __lshift: (a, b) => {
            if ((typeof a === "bigint" || Number.isInteger(a)) &&
                (typeof b === "bigint" || Number.isInteger(b))) {
                const res = BigInt(a) << BigInt(b);
                return res <= BigInt(Number.MAX_SAFE_INTEGER) &&
                    res >= BigInt(Number.MIN_SAFE_INTEGER)
                    ? Number(res)
                    : res;
            }
            return a << b;
        },
        __rshift: (a, b) => {
            if ((typeof a === "bigint" || Number.isInteger(a)) &&
                (typeof b === "bigint" || Number.isInteger(b))) {
                const res = BigInt(a) >> BigInt(b);
                return res <= BigInt(Number.MAX_SAFE_INTEGER) &&
                    res >= BigInt(Number.MIN_SAFE_INTEGER)
                    ? Number(res)
                    : res;
            }
            return a >> b;
        },
        __invert: (a) => {
            if (typeof a === "bigint" || Number.isInteger(a)) {
                const res = ~BigInt(a);
                return res <= BigInt(Number.MAX_SAFE_INTEGER) &&
                    res >= BigInt(Number.MIN_SAFE_INTEGER)
                    ? Number(res)
                    : res;
            }
            return ~a;
        },
        __in: (item, container) => {
            if (Array.isArray(container) || typeof container === "string") {
                return container.includes(item);
            }
            if (container instanceof Set || container instanceof Map) {
                return container.has(item);
            }
            if (container instanceof Uint8Array) {
                return container.includes(item);
            }
            if (typeof container === "object" && container !== null) {
                return Object.prototype.hasOwnProperty.call(container, item);
            }
            return false;
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
            const res = Object.create(null);
            for (const [k, v] of entries)
                res[k] = v;
            return res;
        },
        __unpack: (val, expectedCount, starIndex = -1) => {
            const arr = Array.from(val);
            if (starIndex === -1) {
                if (arr.length !== expectedCount) {
                    throw new Error(`ValueError: too many values to unpack (expected ${expectedCount})`);
                }
            }
            else {
                if (arr.length < expectedCount - 1) {
                    throw new Error(`ValueError: not enough values to unpack (expected at least ${expectedCount - 1}, got ${arr.length})`);
                }
            }
            return arr;
        },
        __call: async (func, posArgs, kwArgs) => {
            if (typeof func !== "function")
                throw new Error(`${func} is not a function`);
            const isClass = func.__is_class__;
            const argNames = isClass
                ? func.__init_arg_names
                : func.__arg_names;
            if (argNames) {
                const argNamesArr = argNames;
                // Check for duplicate arguments
                for (let i = 0; i < posArgs.length; i++) {
                    if (kwArgs && argNamesArr[i] in kwArgs) {
                        throw new Error(`TypeError: ${func.name || "function"}() got multiple values for argument '${argNamesArr[i]}'`);
                    }
                }
                const args = [...posArgs];
                // Map keyword arguments to positional indices
                for (let i = args.length; i < argNamesArr.length; i++) {
                    const name = argNamesArr[i];
                    if (kwArgs && name in kwArgs) {
                        args[i] = kwArgs[name];
                    }
                    else {
                        args[i] = undefined;
                    }
                }
                // Check for unknown keyword arguments
                if (kwArgs) {
                    for (const key in kwArgs) {
                        if (key === "__is_kwargs")
                            continue;
                        if (!argNamesArr.includes(key)) {
                            throw new Error(`TypeError: ${func.name || "function"}() got an unexpected keyword argument '${key}'`);
                        }
                    }
                }
                if (isClass)
                    return new func(...args);
                return await func(...args);
            }
            if (isClass)
                return new func(...posArgs);
            return await func(...posArgs);
        },
        __call_method: async (obj, member, posArgs, kwArgs) => {
            const func = obj[member];
            if (typeof func !== "function")
                throw new Error(`AttributeError: object has no method '${member}'`);
            const argNames = func.__arg_names;
            if (argNames) {
                for (let i = 0; i < posArgs.length; i++) {
                    if (kwArgs && argNames[i] in kwArgs) {
                        throw new Error(`TypeError: ${member}() got multiple values for argument '${argNames[i]}'`);
                    }
                }
                const args = [...posArgs];
                for (let i = args.length; i < argNames.length; i++) {
                    const name = argNames[i];
                    if (kwArgs && name in kwArgs) {
                        args[i] = kwArgs[name];
                    }
                    else {
                        args[i] = undefined;
                    }
                }
                if (kwArgs) {
                    for (const key in kwArgs) {
                        if (key === "__is_kwargs")
                            continue;
                        if (!argNames.includes(key)) {
                            throw new Error(`TypeError: ${member}() got an unexpected keyword argument '${key}'`);
                        }
                    }
                }
                return await func.apply(obj, args);
            }
            return await func.apply(obj, posArgs);
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
