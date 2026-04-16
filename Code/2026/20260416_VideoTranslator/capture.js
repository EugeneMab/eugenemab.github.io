const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

async function captureVideo(url, maxDuration, maxBytes, chromePath, workFolder, logger) {
    logger.setStep('01_capture');
    logger.info(`Starting Capture (Session Method) for URL: ${url}`);

    const captureFolder = path.join(workFolder, 'capture');
    if (!fs.existsSync(captureFolder)) fs.mkdirSync(captureFolder, { recursive: true });

    const audioOutputPath = path.join(captureFolder, 'raw_capture.webm');
    const writeStream = fs.createWriteStream(audioOutputPath);

    let bytesWritten = 0;
    let videoCurrentTime = 0;
    let lastDataTime = Date.now();

    const userDataDir = path.join(process.env.LOCALAPPDATA, 'Google/Chrome/User Data/Default_Translator_Profile');
    const context = await chromium.launchPersistentContext(userDataDir, {
        executablePath: chromePath || undefined,
        headless: false,
        args: ['--autoplay-policy=no-user-gesture-required']
    });

    const page = await context.newPage();
    
    await page.exposeFunction('onDataAvailable', (data) => {
        lastDataTime = Date.now();
        const buffer = Buffer.from(data, 'base64');
        bytesWritten += buffer.length;
        writeStream.write(buffer);
    });

    await page.exposeFunction('logProgress', (currentTime) => {
        videoCurrentTime = currentTime;
        logger.info(`Capture Progress: [${formatTime(currentTime)} / ${formatTime(maxDuration)}] (${(bytesWritten / 1024 / 1024).toFixed(2)} MB)`);
    });

    const watchdog = setInterval(() => {
        if (bytesWritten > 0 && (Date.now() - lastDataTime) > 30000) {
            logger.error("STALL DETECTED: No data for 30s. Exiting.");
            process.exit(1);
        }
    }, 5000);

    try {
        await page.goto(url, { waitUntil: 'networkidle' });
        
        await page.evaluate(async ({ mSec }) => {
            const video = document.querySelector('video');
            if (!video) return;

            // Wait for metadata
            if (video.readyState < 1) await new Promise(r => video.onloadedmetadata = r);
            await video.play();

            setInterval(() => window.logProgress(video.currentTime), 2000);

            const stream = video.captureStream();
            const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9,opus' });
            
            recorder.ondataavailable = async (e) => {
                if (e.data.size > 0) {
                    const buf = await e.data.arrayBuffer();
                    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
                    window.onDataAvailable(b64);
                }
            };

            recorder.start(1000);

            return new Promise(resolve => {
                recorder.onstop = resolve;
                const i = setInterval(() => {
                    if (video.currentTime >= mSec) {
                        recorder.stop();
                        clearInterval(i);
                    }
                }, 500);
            });
        }, { mSec: maxDuration });

    } finally {
        clearInterval(watchdog);
        await context.close();
        writeStream.end();
        logger.info(`Capture Finished. Total Bytes: ${bytesWritten}`);
    }
}

module.exports = { captureVideo };
