const fs = require('fs');
const path = require('path');

class Logger {
    constructor(workFolder) {
        this.workFolder = workFolder;
        this.logFolder = path.join(workFolder, 'logs');
        if (!fs.existsSync(this.logFolder)) {
            fs.mkdirSync(this.logFolder, { recursive: true });
        }
        this.currentStep = 'init';
    }

    setStep(stepName) {
        this.currentStep = stepName;
    }

    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] ${level}: ${message}\n`;
        const logFile = path.join(this.logFolder, `${this.currentStep}.log`);
        
        console.log(`${level}: [${this.currentStep}] ${message}`);
        fs.appendFileSync(logFile, logLine);
    }

    info(message) { this.log(message, 'INFO'); }
    warn(message) { this.log(message, 'WARN'); }
    error(message) { this.log(message, 'ERROR'); }
    debug(message) { this.log(message, 'DEBUG'); }
}

module.exports = Logger;
