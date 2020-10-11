/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
"use strict";
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
exports.change = exports.getEffectiveConfigurationTarget = exports.load = exports.HelpCompletion = void 0;
const vscode = require("vscode");
const utils = require("./utils");
var CodeFormattingPreset;
(function (CodeFormattingPreset) {
    CodeFormattingPreset[CodeFormattingPreset["Custom"] = 0] = "Custom";
    CodeFormattingPreset[CodeFormattingPreset["Allman"] = 1] = "Allman";
    CodeFormattingPreset[CodeFormattingPreset["OTBS"] = 2] = "OTBS";
    CodeFormattingPreset[CodeFormattingPreset["Stroustrup"] = 3] = "Stroustrup";
})(CodeFormattingPreset || (CodeFormattingPreset = {}));
var PipelineIndentationStyle;
(function (PipelineIndentationStyle) {
    PipelineIndentationStyle[PipelineIndentationStyle["IncreaseIndentationForFirstPipeline"] = 0] = "IncreaseIndentationForFirstPipeline";
    PipelineIndentationStyle[PipelineIndentationStyle["IncreaseIndentationAfterEveryPipeline"] = 1] = "IncreaseIndentationAfterEveryPipeline";
    PipelineIndentationStyle[PipelineIndentationStyle["NoIndentation"] = 2] = "NoIndentation";
    PipelineIndentationStyle[PipelineIndentationStyle["None"] = 3] = "None";
})(PipelineIndentationStyle || (PipelineIndentationStyle = {}));
var HelpCompletion;
(function (HelpCompletion) {
    HelpCompletion["Disabled"] = "Disabled";
    HelpCompletion["BlockComment"] = "BlockComment";
    HelpCompletion["LineComment"] = "LineComment";
})(HelpCompletion = exports.HelpCompletion || (exports.HelpCompletion = {}));
function load() {
    const configuration = vscode.workspace.getConfiguration(utils.PowerShellLanguageId);
    const defaultBugReportingSettings = {
        project: "https://github.com/PowerShell/vscode-powershell",
    };
    const defaultScriptAnalysisSettings = {
        enable: true,
        settingsPath: "PSScriptAnalyzerSettings.psd1",
    };
    const defaultDebuggingSettings = {
        createTemporaryIntegratedConsole: false,
    };
    const defaultDeveloperSettings = {
        featureFlags: [],
        bundledModulesPath: "../../../PowerShellEditorServices/module",
        editorServicesLogLevel: "Normal",
        editorServicesWaitForDebugger: false,
        waitForSessionFileTimeoutSeconds: 240,
    };
    const defaultCodeFoldingSettings = {
        enable: true,
        showLastLine: false,
    };
    const defaultCodeFormattingSettings = {
        autoCorrectAliases: false,
        preset: CodeFormattingPreset.Custom,
        openBraceOnSameLine: true,
        newLineAfterOpenBrace: true,
        newLineAfterCloseBrace: true,
        pipelineIndentationStyle: PipelineIndentationStyle.NoIndentation,
        whitespaceBeforeOpenBrace: true,
        whitespaceBeforeOpenParen: true,
        whitespaceAroundOperator: true,
        whitespaceAfterSeparator: true,
        whitespaceBetweenParameters: false,
        whitespaceInsideBrace: true,
        addWhitespaceAroundPipe: true,
        trimWhitespaceAroundPipe: false,
        ignoreOneLineBlock: true,
        alignPropertyValuePairs: true,
        useCorrectCasing: false,
    };
    const defaultStartAsLoginShellSettings = {
        osx: true,
        linux: false,
    };
    const defaultIntegratedConsoleSettings = {
        showOnStartup: true,
        focusConsoleOnExecute: true,
        useLegacyReadLine: false,
        forceClearScrollbackBuffer: false,
    };
    const defaultSideBarSettings = {
        CommandExplorerVisibility: true,
    };
    const defaultButtonSettings = {
        showRunButtons: true,
        showPanelMovementButtons: false
    };
    const defaultPesterSettings = {
        useLegacyCodeLens: true,
        outputVerbosity: "FromPreference",
        debugOutputVerbosity: "Diagnostic",
    };
    return {
        startAutomatically: configuration.get("startAutomatically", true),
        powerShellAdditionalExePaths: configuration.get("powerShellAdditionalExePaths", undefined),
        powerShellDefaultVersion: configuration.get("powerShellDefaultVersion", undefined),
        powerShellExePath: configuration.get("powerShellExePath", undefined),
        promptToUpdatePowerShell: configuration.get("promptToUpdatePowerShell", true),
        promptToUpdatePackageManagement: configuration.get("promptToUpdatePackageManagement", true),
        bundledModulesPath: "../../modules",
        useX86Host: configuration.get("useX86Host", false),
        enableProfileLoading: configuration.get("enableProfileLoading", false),
        helpCompletion: configuration.get("helpCompletion", HelpCompletion.BlockComment),
        scriptAnalysis: configuration.get("scriptAnalysis", defaultScriptAnalysisSettings),
        debugging: configuration.get("debugging", defaultDebuggingSettings),
        developer: getWorkspaceSettingsWithDefaults(configuration, "developer", defaultDeveloperSettings),
        codeFolding: configuration.get("codeFolding", defaultCodeFoldingSettings),
        codeFormatting: configuration.get("codeFormatting", defaultCodeFormattingSettings),
        integratedConsole: configuration.get("integratedConsole", defaultIntegratedConsoleSettings),
        bugReporting: configuration.get("bugReporting", defaultBugReportingSettings),
        sideBar: configuration.get("sideBar", defaultSideBarSettings),
        pester: configuration.get("pester", defaultPesterSettings),
        buttons: configuration.get("buttons", defaultButtonSettings),
        startAsLoginShell: 
        // tslint:disable-next-line
        // We follow the same convention as VS Code - https://github.com/microsoft/vscode/blob/ff00badd955d6cfcb8eab5f25f3edc86b762f49f/src/vs/workbench/contrib/terminal/browser/terminal.contribution.ts#L105-L107
        //   "Unlike on Linux, ~/.profile is not sourced when logging into a macOS session. This
        //   is the reason terminals on macOS typically run login shells by default which set up
        //   the environment. See http://unix.stackexchange.com/a/119675/115410"
        configuration.get("startAsLoginShell", defaultStartAsLoginShellSettings),
    };
}
exports.load = load;
// Get the ConfigurationTarget (read: scope) of where the *effective* setting value comes from
function getEffectiveConfigurationTarget(settingName) {
    return __awaiter(this, void 0, void 0, function* () {
        const configuration = vscode.workspace.getConfiguration(utils.PowerShellLanguageId);
        const detail = configuration.inspect(settingName);
        let configurationTarget = null;
        if (typeof detail.workspaceFolderValue !== "undefined") {
            configurationTarget = vscode.ConfigurationTarget.WorkspaceFolder;
        }
        else if (typeof detail.workspaceValue !== "undefined") {
            configurationTarget = vscode.ConfigurationTarget.Workspace;
        }
        else if (typeof detail.globalValue !== "undefined") {
            configurationTarget = vscode.ConfigurationTarget.Global;
        }
        return configurationTarget;
    });
}
exports.getEffectiveConfigurationTarget = getEffectiveConfigurationTarget;
function change(settingName, newValue, configurationTarget) {
    return __awaiter(this, void 0, void 0, function* () {
        const configuration = vscode.workspace.getConfiguration(utils.PowerShellLanguageId);
        yield configuration.update(settingName, newValue, configurationTarget);
    });
}
exports.change = change;
function getWorkspaceSettingsWithDefaults(workspaceConfiguration, settingName, defaultSettings) {
    const importedSettings = workspaceConfiguration.get(settingName, defaultSettings);
    for (const setting in importedSettings) {
        if (importedSettings[setting]) {
            defaultSettings[setting] = importedSettings[setting];
        }
    }
    return defaultSettings;
}
//# sourceMappingURL=settings.js.map