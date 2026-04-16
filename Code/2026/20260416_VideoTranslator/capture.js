const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function captureVideo(url, maxDuration, maxBytes, chromePath, workFolder, logger) {
    logger.setStep('01_capture');
    logger.info(`Starting capture for URL: ${url}`);

    const captureFolder = path.join(workFolder, 'capture');
    if (!fs.existsSync(captureFolder)) fs.mkdirSync(captureFolder, { recursive: true });

    const outputPath = path.join(captureFolder, 'raw_capture.webm');
    const writeStream = fs.createWriteStream(outputPath);

    let bytesWritten = 0;
    let stopRequested = false;

    const userDataDir = path.join(process.env.LOCALAPPDATA, 'Google/Chrome/User Data/Default_Translator_Profile');
    
    logger.info(`Launching browser. Profile: ${userDataDir}`);
    const context = await chromium.launchPersistentContext(userDataDir, {
        executablePath: chromePath || undefined,
        headless: false, 
        args: [
            '--autoplay-policy=no-user-gesture-required',
            '--mute-audio=false'
        ]
    });

    const page = await context.newPage();
    
    // Ad-Skipper
    await page.addInitScript(() => {
        setInterval(() => {
            const ad = document.querySelector('.ad-showing video, .ytp-ad-player-overlay, .bilibili-player-video-ad-unit');
            if (ad) {
                const video = document.querySelector('video');
                if (video) {
                    video.playbackRate = 16.0;
                    video.muted = true;
                }
                const skipBtn = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern');
                if (skipBtn) skipBtn.click();
            }
        }, 500);
    });

    await page.goto(url, { waitUntil: 'networkidle' });
    logger.info("Page loaded.");

    // Screenshot at start
    await page.screenshot({ path: path.join(logger.logFolder, 'capture_start.png') });

    let activeWrites = 0;

    await page.exposeFunction('onDataAvailable', (data) => {
        logger.debug(`onDataAvailable called with ${data.length} chars`);
        if (stopRequested) return;
        activeWrites++;
        const buffer = Buffer.from(data, 'base64');
        bytesWritten += buffer.length;
        writeStream.write(buffer, (err) => {
            if (err) logger.error(`Write error: ${err.message}`);
            activeWrites--;
        });

        if (maxBytes && bytesWritten >= maxBytes) {
            logger.warn(`Max bytes (${maxBytes}) reached. Stopping capture.`);
            stopRequested = true;
        }
    });

    await page.exposeFunction('logFromBrowser', (msg) => {
        logger.debug(`Browser Log: ${msg}`);
    });

    page.on('console', msg => logger.debug(`Browser Console: ${msg.text()}`));
    page.on('pageerror', err => logger.error(`Browser Page Error: ${err.message}`));

    // Hard watchdog timer
    const watchdogTimeout = (maxDuration || 60) + 30;
    const watchdog = setTimeout(async () => {
        logger.warn(`Watchdog timeout (${watchdogTimeout}s) triggered. Force closing browser.`);
        stopRequested = true;
        await context.close();
    }, watchdogTimeout * 1000);

    try {
        await page.evaluate(async ({ mSec }) => {
            window.logFromBrowser("Locating video element...");
            const video = document.querySelector('video');
            if (!video) {
                window.logFromBrowser("Video element not found");
                return;
            }

            window.logFromBrowser("Video src: " + video.src);
            if (video.readyState < 1) {
                window.logFromBrowser("Waiting for metadata...");
                await new Promise(r => video.addEventListener('loadedmetadata', r, { once: true }));
            }

            try {
                window.logFromBrowser("Attempting play...");
                await video.play();
                
                const stream = video.captureStream();
                const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9,opus' });
                let chunksReceived = 0;

                recorder.ondataavailable = async (event) => {
                    if (event.data.size > 0) {
                        chunksReceived++;
                        window.logFromBrowser(`Chunk #${chunksReceived} received, size: ${event.data.size}`);
                        
                        const arrayBuffer = await event.data.arrayBuffer();
                        const uint8Array = new Uint8Array(arrayBuffer);
                        // Convert to base64 in chunks or as a whole if not too large
                        let binary = '';
                        for (let i = 0; i < uint8Array.length; i++) {
                            binary += String.fromCharCode(uint8Array[i]);
                        }
                        const base64 = btoa(binary);
                        window.onDataAvailable(base64);
                    }
                };

                recorder.start(1000); 
                window.logFromBrowser("MediaRecorder started");

                return new Promise(resolve => {
                    recorder.onstop = () => {
                        window.logFromBrowser("MediaRecorder stopped normally");
                        setTimeout(resolve, 3000); // Give time for last chunks to reach Node
                    };
                    video.onended = () => {
                        window.logFromBrowser("Video ended automatically");
                        if (recorder.state !== 'inactive') recorder.stop();
                    };
                    if (mSec) setTimeout(() => {
                        window.logFromBrowser("Duration limit reached");
                        if (recorder.state !== 'inactive') recorder.stop();
                    }, mSec * 1000);
                });
            } catch (e) {
                window.logFromBrowser("Critical error in browser capture: " + e.message);
                throw e;
            }
        }, { mSec: maxDuration });

        // Wait for all active writes to complete
        logger.info("Waiting for remaining chunks to be written...");
        let waitTime = 0;
        while (activeWrites > 0 && waitTime < 5000) {
            await new Promise(r => setTimeout(r, 100));
            waitTime += 100;
        }

        await page.screenshot({ path: path.join(logger.logFolder, 'capture_end.png') });
    } catch (err) {
        logger.error(`Evaluation failed: ${err.message}`);
    } finally {
        clearTimeout(watchdog);
        logger.info(`Capture finished. Total bytes: ${bytesWritten}`);
        if (context) await context.close();
        writeStream.end();
    }
}

module.exports = { captureVideo };
