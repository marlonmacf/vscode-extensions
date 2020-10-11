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
exports.PesterTestsFeature = void 0;
const path = require("path");
const vscode = require("vscode");
const Settings = require("../settings");
const utils = require("../utils");
var LaunchType;
(function (LaunchType) {
    LaunchType[LaunchType["Debug"] = 0] = "Debug";
    LaunchType[LaunchType["Run"] = 1] = "Run";
})(LaunchType || (LaunchType = {}));
class PesterTestsFeature {
    constructor(sessionManager) {
        this.sessionManager = sessionManager;
        this.invokePesterStubScriptPath = path.resolve(__dirname, "../../../InvokePesterStub.ps1");
        // File context-menu command - Run Pester Tests
        this.command = vscode.commands.registerCommand("PowerShell.RunPesterTestsFromFile", (fileUri) => {
            this.launchAllTestsInActiveEditor(LaunchType.Run, fileUri);
        });
        // File context-menu command - Debug Pester Tests
        this.command = vscode.commands.registerCommand("PowerShell.DebugPesterTestsFromFile", (fileUri) => {
            this.launchAllTestsInActiveEditor(LaunchType.Debug, fileUri);
        });
        // This command is provided for usage by PowerShellEditorServices (PSES) only
        this.command = vscode.commands.registerCommand("PowerShell.RunPesterTests", (uriString, runInDebugger, describeBlockName, describeBlockLineNumber, outputPath) => {
            this.launchTests(uriString, runInDebugger, describeBlockName, describeBlockLineNumber, outputPath);
        });
    }
    dispose() {
        this.command.dispose();
    }
    setLanguageClient(languageClient) {
        this.languageClient = languageClient;
    }
    launchAllTestsInActiveEditor(launchType, fileUri) {
        const uriString = (fileUri || vscode.window.activeTextEditor.document.uri).toString();
        const launchConfig = this.createLaunchConfig(uriString, launchType);
        this.launch(launchConfig);
    }
    launchTests(uriString, runInDebugger, describeBlockName, describeBlockLineNumber, outputPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const launchType = runInDebugger ? LaunchType.Debug : LaunchType.Run;
            const launchConfig = this.createLaunchConfig(uriString, launchType, describeBlockName, describeBlockLineNumber, outputPath);
            this.launch(launchConfig);
        });
    }
    createLaunchConfig(uriString, launchType, testName, lineNum, outputPath) {
        const uri = vscode.Uri.parse(uriString);
        const currentDocument = vscode.window.activeTextEditor.document;
        const settings = Settings.load();
        // Since we pass the script path to PSES in single quotes to avoid issues with PowerShell
        // special chars like & $ @ () [], we do have to double up the interior single quotes.
        const scriptPath = uri.fsPath.replace(/'/g, "''");
        const launchConfig = {
            request: "launch",
            type: "PowerShell",
            name: "PowerShell Launch Pester Tests",
            script: this.invokePesterStubScriptPath,
            args: [
                "-ScriptPath",
                `'${scriptPath}'`,
            ],
            internalConsoleOptions: "neverOpen",
            noDebug: (launchType === LaunchType.Run),
            createTemporaryIntegratedConsole: settings.debugging.createTemporaryIntegratedConsole,
            cwd: currentDocument.isUntitled
                ? vscode.workspace.rootPath
                : path.dirname(currentDocument.fileName),
        };
        if (lineNum) {
            launchConfig.args.push("-LineNumber", `${lineNum}`);
        }
        else if (testName) {
            // Escape single quotes inside double quotes by doubling them up
            if (testName.includes("'")) {
                testName = testName.replace(/'/g, "''");
            }
            launchConfig.args.push("-TestName", `'${testName}'`);
        }
        else {
            launchConfig.args.push("-All");
        }
        if (!settings.pester.useLegacyCodeLens) {
            launchConfig.args.push("-MinimumVersion5");
        }
        if (launchType === LaunchType.Debug) {
            launchConfig.args.push("-Output", `'${settings.pester.debugOutputVerbosity}'`);
        }
        else {
            launchConfig.args.push("-Output", `'${settings.pester.outputVerbosity}'`);
        }
        if (outputPath) {
            launchConfig.args.push("-OutputPath", `'${outputPath}'`);
        }
        return launchConfig;
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
exports.PesterTestsFeature = PesterTestsFeature;
//# sourceMappingURL=PesterTests.js.map