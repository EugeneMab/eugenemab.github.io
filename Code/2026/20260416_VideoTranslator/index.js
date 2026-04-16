const { program } = require('commander');
const path = require('path');
const fs = require('fs');
const Logger = require('./Logger');
const { captureVideo } = require('./capture');

program
  .version('1.0.0')
  .requiredOption('-u, --url <url>', 'URL of the video (YouTube/Bilibili)')
  .requiredOption('-w, --work-folder <folder>', 'Folder to store temporary and output files')
  .option('-m, --max-length <seconds>', 'Maximum length of video to process', parseInt)
  .parse(process.argv);

const options = program.opts();

async function main() {
    const workFolder = path.resolve(options.workFolder);
    if (!fs.existsSync(workFolder)) {
        fs.mkdirSync(workFolder, { recursive: true });
    }

    const logger = new Logger(workFolder);
    logger.info("Initializing Video Translation Pipeline...");

    try {
        // Step 1: Capture
        await captureVideo(options.url, options.maxLength, workFolder, logger);

        // Placeholder for future steps
        logger.setStep('02_processing');
        logger.info("Starting processing (placeholder for separation, diarization, translation)...");
        
        // TODO: Implement 
        // 1. Vocal Separation (onnxruntime)
        // 2. Diarization (sherpa-onnx)
        // 3. Transcription (whisper-node)
        // 4. Translation (Gemini API)
        // 5. TTS Cloning (sherpa-onnx)
        // 6. Final Mixing (ffmpeg)

        logger.info("Pipeline completed successfully.");
    } catch (error) {
        logger.error(`Fatal error: ${error.message}`);
        console.error(error);
        process.exit(1);
    }
}

main();
