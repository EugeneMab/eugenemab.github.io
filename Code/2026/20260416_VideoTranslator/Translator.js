const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");

class Translator {
    constructor(apiKey, logger) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.logger = logger;
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    }

    async transcribeAndTranslate(audioPath) {
        this.logger.setStep('03_translation');
        this.logger.info("Sending audio to Gemini for transcription and translation...");

        const audioData = fs.readFileSync(audioPath);
        
        const prompt = `
            Transcribe the following Korean audio and translate it to Chinese.
            Return the result as a JSON array of objects with the following schema:
            [
              { "start": "0:00:00", "end": "0:00:05", "text_kr": "...", "text_zh": "..." }
            ]
            Keep segments short (3-10 seconds).
        `;

        const result = await this.model.generateContent([
            prompt,
            {
                inlineData: {
                    data: audioData.toString("base64"),
                    mimeType: "audio/wav"
                }
            }
        ]);

        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\[.*\]/s);
        
        if (!jsonMatch) {
            this.logger.error("Failed to parse JSON from Gemini response.");
            throw new Error("Invalid API response format");
        }

        const data = JSON.parse(jsonMatch[0]);
        this.logger.info(`Successfully processed ${data.length} segments.`);
        return data;
    }
}

module.exports = Translator;
