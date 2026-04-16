const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function captureVideo(url, maxDuration, workFolder, logger) {
    logger.setStep('01_capture');
    logger.info(`Starting capture for URL: ${url}`);

    const captureFolder = path.join(workFolder, 'capture');
    if (!fs.existsSync(captureFolder)) fs.mkdirSync(captureFolder, { recursive: true });

    const outputPath = path.join(captureFolder, 'raw_capture.webm');
    const writeStream = fs.createWriteStream(outputPath);

    // Note: User should provide their actual Chrome User Data path
    // For now, we use a temp profile or ask for user path
    const userDataDir = path.join(process.env.LOCALAPPDATA, 'Google/Chrome/User Data/Default_Translator_Profile');
    
    logger.info(`Launching browser with profile: ${userDataDir}`);
    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false, // Must be false to record audio/video correctly in some cases
        args: [
            '--autoplay-policy=no-user-gesture-required',
            '--mute-audio=false'
        ]
    });

    const page = await context.newPage();
    
    // Inject Ad-Skipper
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
    logger.info("Page loaded. Starting recording...");

    // Expose function to receive chunks from browser
    await page.exposeFunction('onDataAvailable', (data) => {
        const buffer = Buffer.from(data, 'base64');
        writeStream.write(buffer);
    });

    await page.evaluate(async (maxSec) => {
        const video = document.querySelector('video');
        if (!video) return;

        const stream = video.captureStream();
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9,opus' });

        recorder.ondataavailable = async (event) => {
            if (event.data.size > 0) {
                const reader = new FileReader();
                reader.onload = () => {
                    window.onDataAvailable(reader.result.split(',')[1]);
                };
                reader.readAsDataURL(event.data);
            }
        };

        recorder.start(1000); // 1s chunks
        video.play();

        if (maxSec) {
            setTimeout(() => recorder.stop(), maxSec * 1000);
        }
        
        return new Promise(resolve => {
            recorder.onstop = resolve;
            video.onended = resolve;
        });
    }, maxDuration);

    logger.info("Recording finished.");
    await context.close();
    writeStream.end();
}

module.exports = { captureVideo };
