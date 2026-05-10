// src/main.ts

async function compileAndRun() {
    const editor = document.getElementById('editor') as HTMLTextAreaElement;
    const lexOutput = document.getElementById('lex-output')!;
    const astOutput = document.getElementById('ast-output')!;
    const watOutput = document.getElementById('wat-output')!;
    const wasmOutput = document.getElementById('wasm-output')!;
    const resultOutput = document.getElementById('result-output')!;

    const code = editor.value;

    try {
        lexOutput.textContent = "Lexing...";
        astOutput.textContent = "Parsing...";
        watOutput.textContent = "Generating WAT...";
        wasmOutput.textContent = "Compiling WASM...";
        resultOutput.textContent = "Ready.";

        // To be implemented: Lexer, Parser, Compiler
        
    } catch (e) {
        resultOutput.textContent = "Error: " + e;
    }
}

// Tab Switching Logic
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        
        btn.classList.add('active');
        const tabId = (btn as HTMLElement).dataset.tab;
        document.getElementById(`${tabId}-content`)?.classList.remove('hidden');
    });
});

// Sample Loading Logic
document.getElementById('sample-select')?.addEventListener('change', async (e) => {
    const path = (e.target as HTMLSelectElement).value;
    if (path) {
        const response = await fetch(path);
        const text = await response.text();
        (document.getElementById('editor') as HTMLTextAreaElement).value = text;
    }
});

// File Loading Logic
document.getElementById('load-file-btn')?.addEventListener('click', () => {
    document.getElementById('file-input')?.click();
});

document.getElementById('file-input')?.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (re) => {
            (document.getElementById('editor') as HTMLTextAreaElement).value = re.target?.result as string;
        };
        reader.readAsText(file);
    }
});

document.getElementById('compile-btn')?.addEventListener('click', compileAndRun);

console.log("Python-to-WASM Compiler Initialized");
