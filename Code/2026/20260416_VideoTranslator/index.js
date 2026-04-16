const { program } = require('commander');
const path = require('path');
const fs = require('fs');
const Logger = require('./Logger');
const { captureVideo } = require('./capture');
const AudioProcessor = require('./AudioProcessor');
const Translator = require('./Translator');

program
  .version('1.0.0')
  .requiredOption('-u, --url <url>', 'URL of the video (YouTube/Bilibili)')
  .requiredOption('-w, --work-folder <folder>', 'Folder to store temporary and output files')
  .option('-k, --api-key <key>', 'Gemini API Key')
  .option('-m, --max-length <seconds>', 'Maximum length of video in seconds', parseInt)
  .option('-b, --max-bytes <bytes>', 'Maximum allowed file size in bytes', parseInt)
  .option('-c, --chrome-path <path>', 'Path to the chrome.exe executable')
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
        await captureVideo(options.url, options.maxLength, options.maxBytes, options.chromePath, workFolder, logger);

        const processor = new AudioProcessor(workFolder, logger);
        const videoPath = path.join(workFolder, 'capture', 'original_video.mp4');
        
        // Step 2: Extract & Separate
        const rawAudio = await processor.extractAudio(videoPath);
        const { vocalsPath, bgPath } = await processor.separateVocals(rawAudio);

        logger.info(`Separation complete. Vocals: ${vocalsPath}`);

        // Step 3: Transcribe & Translate
        let segments = [];
        if (options.apiKey) {
            const translator = new Translator(options.apiKey, logger);
            segments = await translator.transcribeAndTranslate(vocalsPath);
            fs.writeFileSync(path.join(workFolder, 'segments.json'), JSON.stringify(segments, null, 2));
        } else {
            logger.warn("No API Key provided. Skipping translation step.");
        }

        logger.info("Pipeline completed successfully.");
    } catch (error) {
        logger.error(`Fatal error: ${error.message}`);
        console.error(error);
        process.exit(1);
    }
}

main();
