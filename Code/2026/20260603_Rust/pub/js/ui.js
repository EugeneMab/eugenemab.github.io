// REM Rust-to-WASM Port (RUST)
let worker = null;
export function initUI() {
    const editor = document.getElementById('editor');
    const compileBtn = document.getElementById('compile-btn');
    const abortBtn = document.getElementById('abort-btn');
    const timeoutInput = document.getElementById('timeout-input');
    const statusLine = document.getElementById('status-line');
    const outputs = {
        info: document.getElementById('info-output'),
        lex: document.getElementById('lex-output'),
        ast: document.getElementById('ast-output'),
        wat: document.getElementById('wat-output'),
        wasm: document.getElementById('wasm-output'),
        exec: document.getElementById('result-output'),
    };
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            document.getElementById(`${target}-content`).classList.remove('hidden');
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });
    const sampleSelect = document.getElementById('sample-select');
    const samples = {
        basic: `fn main() {\n    let x = 10;\n    let y = 20;\n    let z = (x + y) * 2;\n    print!(z);\n    z\n}`,
        bitwise: `fn main() {\n    let bit = (1 << 5) | 1;\n    print!(bit);\n    bit\n}`,
        panic: `fn main() {\n    print!(1);\n    panic!(42);\n    print!(2);\n}`,
    };
    sampleSelect?.addEventListener('change', () => {
        editor.value = samples[sampleSelect.value] || '';
    });
    const runCode = () => {
        if (worker)
            worker.terminate();
        statusLine.textContent = 'Compiling...';
        Object.values(outputs).forEach(o => o.textContent = '');
        worker = new Worker('./js/worker.js', { type: 'module' });
        const timeout = parseInt(timeoutInput.value) * 1000;
        const timer = setTimeout(() => {
            if (worker) {
                worker.terminate();
                worker = null;
                statusLine.textContent = 'Execution Timed Out';
            }
        }, timeout);
        worker.onmessage = (e) => {
            const { type, payload } = e.data;
            switch (type) {
                case 'lex':
                    outputs.lex.textContent = JSON.stringify(payload, null, 2);
                    break;
                case 'ast':
                    outputs.ast.textContent = JSON.stringify(payload, null, 2);
                    break;
                case 'wat':
                    outputs.wat.textContent = payload;
                    break;
                case 'wasm':
                    outputs.wasm.textContent = Array.from(payload).map(b => b.toString(16).padStart(2, '0')).join(' ');
                    break;
                case 'log':
                    outputs.exec.textContent += payload + '\n';
                    break;
                case 'result':
                    outputs.exec.textContent += `Return: ${payload}\n`;
                    statusLine.textContent = 'Execution Finished';
                    clearTimeout(timer);
                    break;
                case 'error':
                    outputs.exec.textContent += `Error: ${payload}\n`;
                    statusLine.textContent = 'Error';
                    clearTimeout(timer);
                    break;
            }
        };
        worker.postMessage({ type: 'compile', code: editor.value });
    };
    compileBtn?.addEventListener('click', runCode);
    abortBtn?.addEventListener('click', () => {
        if (worker) {
            worker.terminate();
            worker = null;
            statusLine.textContent = 'Aborted';
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F8')
            runCode();
    });
}
initUI();
