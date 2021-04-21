/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLinux = exports.isWindows = exports.isMacOS = exports.sleep = exports.getTimestampString = exports.checkIfFileExists = exports.deleteSessionFile = exports.readSessionFile = exports.writeSessionFile = exports.getDebugSessionFilePath = exports.getSessionFilePath = exports.getPipePath = exports.ensurePathExists = exports.PowerShellLanguageId = void 0;
const fs = require("fs");
const os = require("os");
const path = require("path");
exports.PowerShellLanguageId = "powershell";
function ensurePathExists(targetPath) {
    // Ensure that the path exists
    try {
        fs.mkdirSync(targetPath);
    }
    catch (e) {
        // If the exception isn't to indicate that the folder exists already, rethrow it.
        if (e.code !== "EEXIST") {
            throw e;
        }
    }
}
exports.ensurePathExists = ensurePathExists;
function getPipePath(pipeName) {
    if (os.platform() === "win32") {
        return "\\\\.\\pipe\\" + pipeName;
    }
    else {
        // Windows uses NamedPipes where non-Windows platforms use Unix Domain Sockets.
        // This requires connecting to the pipe file in different locations on Windows vs non-Windows.
        return path.join(os.tmpdir(), `CoreFxPipe_${pipeName}`);
    }
}
exports.getPipePath = getPipePath;
const sessionsFolder = path.resolve(__dirname, "..", "..", "sessions/");
const sessionFilePathPrefix = path.resolve(sessionsFolder, "PSES-VSCode-" + process.env.VSCODE_PID);
// Create the sessions path if it doesn't exist already
ensurePathExists(sessionsFolder);
function getSessionFilePath(uniqueId) {
    return `${sessionFilePathPrefix}-${uniqueId}`;
}
exports.getSessionFilePath = getSessionFilePath;
function getDebugSessionFilePath() {
    return `${sessionFilePathPrefix}-Debug`;
}
exports.getDebugSessionFilePath = getDebugSessionFilePath;
function writeSessionFile(sessionFilePath, sessionDetails) {
    ensurePathExists(sessionsFolder);
    const writeStream = fs.createWriteStream(sessionFilePath);
    writeStream.write(JSON.stringify(sessionDetails));
    writeStream.close();
}
exports.writeSessionFile = writeSessionFile;
function readSessionFile(sessionFilePath) {
    const fileContents = fs.readFileSync(sessionFilePath, "utf-8");
    return JSON.parse(fileContents);
}
exports.readSessionFile = readSessionFile;
function deleteSessionFile(sessionFilePath) {
    try {
        fs.unlinkSync(sessionFilePath);
    }
    catch (e) {
        // TODO: Be more specific about what we're catching
    }
}
exports.deleteSessionFile = deleteSessionFile;
function checkIfFileExists(filePath) {
    try {
        fs.accessSync(filePath, fs.constants.R_OK);
        return true;
    }
    catch (e) {
        return false;
    }
}
exports.checkIfFileExists = checkIfFileExists;
function getTimestampString() {
    const time = new Date();
    return `[${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}]`;
}
exports.getTimestampString = getTimestampString;
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
exports.sleep = sleep;
exports.isMacOS = process.platform === "darwin";
exports.isWindows = process.platform === "win32";
exports.isLinux = !exports.isMacOS && !exports.isWindows;
//# sourceMappingURL=utils.js.map