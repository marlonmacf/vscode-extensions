"use strict";
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunCodeFeature = void 0;
const path = require("path");
const vscode = require("vscode");
const Settings = require("../settings");
const utils = require("../utils");
var LaunchType;
(function (LaunchType) {
    LaunchType[LaunchType["Debug"] = 0] = "Debug";
    LaunchType[LaunchType["Run"] = 1] = "Run";
})(LaunchType || (LaunchType = {}));
class RunCodeFeature {
    constructor(sessionManager) {
        this.sessionManager = sessionManager;
        this.command = vscode.commands.registerCommand("PowerShell.RunCode", (runInDebugger, scriptToRun, args) => {
            this.launchTask(runInDebugger, scriptToRun, args);
        });
    }
    dispose() {
        this.command.dispose();
    }
    launchTask(runInDebugger, scriptToRun, args) {
        return __awaiter(this, void 0, void 0, function* () {
            const launchType = runInDebugger ? LaunchType.Debug : LaunchType.Run;
            const launchConfig = createLaunchConfig(launchType, scriptToRun, args);
            this.launch(launchConfig);
        });
    }
    launch(launchConfig) {
        // Create or show the interactive console
        // TODO #367: Check if "newSession" mode is configured
        vscode.commands.executeCommand("PowerShell.ShowSessionConsole", true);
        // Write out temporary debug session file
        utils.writeSessionFile(utils.getDebugSessionFilePath(), this.sessionManager.getSessionDetails());
        // TODO: Update to handle multiple root workspaces.
        vscode.debug.startDebugging(vscode.workspace.workspaceFolders[0], launchConfig);
    }
}
exports.RunCodeFeature = RunCodeFeature;
function createLaunchConfig(launchType, commandToRun, args) {
    const settings = Settings.load();
    let cwd = vscode.workspace.rootPath;
    if (vscode.window.activeTextEditor
        && vscode.window.activeTextEditor.document
        && !vscode.window.activeTextEditor.document.isUntitled) {
        cwd = path.dirname(vscode.window.activeTextEditor.document.fileName);
    }
    const launchConfig = {
        request: "launch",
        type: "PowerShell",
        name: "PowerShell Run Code",
        internalConsoleOptions: "neverOpen",
        noDebug: (launchType === LaunchType.Run),
        createTemporaryIntegratedConsole: settings.debugging.createTemporaryIntegratedConsole,
        script: commandToRun,
        args,
        cwd,
    };
    return launchConfig;
}
//# sourceMappingURL=RunCode.js.map