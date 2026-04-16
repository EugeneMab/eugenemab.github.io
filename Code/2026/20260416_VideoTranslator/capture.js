const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

async function captureVideo(url, maxDuration, maxBytes, chromePath, workFolder, logger) {
    logger.setStep('01_capture');
    logger.info(`Starting FULL DOWNLOAD (FFmpeg-free) for URL: ${url}`);

    const captureFolder = path.join(workFolder, 'capture');
    if (!fs.existsSync(captureFolder)) fs.mkdirSync(captureFolder, { recursive: true });

    const videoPath = path.join(captureFolder, 'original_video.mp4');
    const ytDlpPath = path.join(__dirname, 'yt-dlp.exe');

    try {
        logger.info("Executing yt-dlp...");
        
        // We REMOVE --download-sections because it requires ffmpeg.
        // We download the whole file (YouTube handles byte limits natively).
        const byteLimit = maxBytes ? `--max-filesize ${maxBytes}` : "";
        
        // Use a format that is likely pre-merged to avoid ffmpeg requirement
        const cmd = `"${ytDlpPath}" ${byteLimit} -f "best[ext=mp4]" --no-part -o "${videoPath}" "${url}"`;
        
        logger.info(`Running command: ${cmd}`);
        execSync(cmd, { stdio: 'inherit' });

        if (fs.existsSync(videoPath)) {
            const stats = fs.statSync(videoPath);
            logger.info(`SUCCESS: Downloaded ${(stats.size / 1024 / 1024).toFixed(2)} MB to ${videoPath}`);
        } else {
            throw new Error("File not found after download.");
        }

    } catch (e) {
        logger.error(`Download failed: ${e.message}`);
        throw e;
    }
}

module.exports = { captureVideo };
