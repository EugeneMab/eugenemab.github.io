// src/test-utils.ts
export function getImportObject(instanceRef, logs = []) {
    return {
        env: {
            print: (val) => {
                logs.push(val);
                return 0;
            },
            print_str: (ptr) => {
                const view = new Int32Array(instanceRef.instance.exports.memory.buffer);
                const len = view[ptr / 4];
                let str = "";
                for (let i = 0; i < len; i++) {
                    str += String.fromCharCode(view[ptr / 4 + 1 + i]);
                }
                logs.push(str);
                return 0;
            },
            itoa: (val) => {
                const s = String(val);
                const ptr = instanceRef.instance.exports.heap_ptr.value;
                const view = new Int32Array(instanceRef.instance.exports.memory.buffer);
                view[ptr / 4] = s.length;
                for (let i = 0; i < s.length; i++) {
                    view[ptr / 4 + 1 + i] = s.charCodeAt(i);
                }
                instanceRef.instance.exports.heap_ptr.value += (s.length + 1) * 4;
                return ptr;
            },
            concat: (ptr1, ptr2) => {
                const view = new Int32Array(instanceRef.instance.exports.memory.buffer);
                const len1 = view[ptr1 / 4];
                const len2 = view[ptr2 / 4];
                const ptr = instanceRef.instance.exports.heap_ptr.value;
                view[ptr / 4] = len1 + len2;
                for (let i = 0; i < len1; i++) {
                    view[ptr / 4 + 1 + i] = view[ptr1 / 4 + 1 + i];
                }
                for (let i = 0; i < len2; i++) {
                    view[ptr / 4 + 1 + len1 + i] = view[ptr2 / 4 + 1 + i];
                }
                instanceRef.instance.exports.heap_ptr.value += (len1 + len2 + 1) * 4;
                return ptr;
            },
            _get_item: (ptr, index) => {
                const view = new Int32Array(instanceRef.instance.exports.memory.buffer);
                const len = view[ptr / 4];
                if (index < 0)
                    index += len;
                if (index < 0 || index >= len)
                    throw new Error("Index out of bounds");
                return view[ptr / 4 + 1 + index];
            },
            _slice: (ptr, start, stop, step) => {
                const view = new Int32Array(instanceRef.instance.exports.memory.buffer);
                const len = view[ptr / 4];
                if (step === 0x7fffffff)
                    step = 1;
                if (start === 0x7fffffff)
                    start = step > 0 ? 0 : len - 1;
                if (stop === 0x7fffffff)
                    stop = step > 0 ? len : -1;
                if (start < 0)
                    start += len;
                if (stop < 0)
                    stop += len;
                const res = [];
                if (step > 0) {
                    for (let i = start; i < stop; i += step)
                        if (i >= 0 && i < len)
                            res.push(view[ptr / 4 + 1 + i]);
                }
                else {
                    for (let i = start; i > stop; i += step)
                        if (i >= 0 && i < len)
                            res.push(view[ptr / 4 + 1 + i]);
                }
                const newPtr = instanceRef.instance.exports.heap_ptr.value;
                view[newPtr / 4] = res.length;
                for (let i = 0; i < res.length; i++) {
                    view[newPtr / 4 + 1 + i] = res[i];
                }
                instanceRef.instance.exports.heap_ptr.value += (res.length + 1) * 4;
                return newPtr;
            },
            sleep: () => 0,
        },
    };
}
