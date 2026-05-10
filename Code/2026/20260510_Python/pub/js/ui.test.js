import { test, expect } from '@playwright/test';
const samples = [
    { name: 'Basic Return', value: 'sample/basic.py' },
    { name: 'Variables & Math', value: 'sample/variables.py' },
    { name: 'Complex Math', value: 'sample/complex.py' }
];
test('verify all samples in UI', async ({ page }) => {
    await page.goto('http://localhost:8080');
    // Monitor for console errors
    const errors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            errors.push(msg.text());
            console.log(`Browser Error: ${msg.text()}`);
        }
    });
    for (const sample of samples) {
        console.log(`Testing Sample: ${sample.name}`);
        // Select sample
        await page.selectOption('#sample-select', sample.value);
        // Verify editor content
        await expect(page.locator('#editor')).not.toBeEmpty();
        // Trigger compile
        await page.click('#compile-btn');
        // Check outputs
        const lexOutput = page.locator('#lex-output');
        const astOutput = page.locator('#ast-output');
        const watOutput = page.locator('#wat-output');
        const wasmOutput = page.locator('#wasm-output');
        const resultOutput = page.locator('#result-output');
        // Wait for result box to contain "Result:"
        await expect(resultOutput).toContainText('Result:');
        // Verify all tabs are populated
        await expect(lexOutput).not.toBeEmpty();
        await expect(astOutput).not.toBeEmpty();
        await expect(watOutput).not.toBeEmpty();
        await expect(wasmOutput).not.toBeEmpty();
        console.log(`✅ Sample ${sample.name} passed.`);
    }
    expect(errors).toHaveLength(0);
});
//# sourceMappingURL=ui.test.js.map