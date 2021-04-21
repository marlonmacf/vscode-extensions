/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const path = require("path");
const vscode = require("vscode");
const vscode_extension_telemetry_1 = require("vscode-extension-telemetry");
const CodeActions_1 = require("./features/CodeActions");
const Console_1 = require("./features/Console");
const CustomViews_1 = require("./features/CustomViews");
const DebugSession_1 = require("./features/DebugSession");
const Examples_1 = require("./features/Examples");
const ExpandAlias_1 = require("./features/ExpandAlias");
const ExtensionCommands_1 = require("./features/ExtensionCommands");
const ExternalApi_1 = require("./features/ExternalApi");
const FindModule_1 = require("./features/FindModule");
const GenerateBugReport_1 = require("./features/GenerateBugReport");
const GetCommands_1 = require("./features/GetCommands");
const HelpCompletion_1 = require("./features/HelpCompletion");
const ISECompatibility_1 = require("./features/ISECompatibility");
const NewFileOrProject_1 = require("./features/NewFileOrProject");
const OpenInISE_1 = require("./features/OpenInISE");
const PesterTests_1 = require("./features/PesterTests");
const DebugSession_2 = require("./features/DebugSession");
const RemoteFiles_1 = require("./features/RemoteFiles");
const RunCode_1 = require("./features/RunCode");
const ShowHelp_1 = require("./features/ShowHelp");
const DebugSession_3 = require("./features/DebugSession");
const logging_1 = require("./logging");
const session_1 = require("./session");
const Settings = require("./settings");
const utils_1 = require("./utils");
// The most reliable way to get the name and version of the current extension.
// tslint:disable-next-line: no-var-requires
const PackageJSON = require("../../package.json");
// the application insights key (also known as instrumentation key) used for telemetry.
const AI_KEY = "AIF-d9b70cd4-b9f9-4d70-929b-a071c400b217";
let logger;
let sessionManager;
let languageClientConsumers = [];
let commandRegistrations = [];
let telemetryReporter;
const documentSelector = [
    { language: "powershell", scheme: "file" },
    { language: "powershell", scheme: "untitled" },
];
function activate(context) {
    // create telemetry reporter on extension activation
    telemetryReporter = new vscode_extension_telemetry_1.default(PackageJSON.name, PackageJSON.version, AI_KEY);
    // If both extensions are enabled, this will cause unexpected behavior since both register the same commands
    if (PackageJSON.name.toLowerCase() === "powershell-preview"
        && vscode.extensions.getExtension("ms-vscode.powershell")) {
        vscode.window.showWarningMessage("'PowerShell' and 'PowerShell Preview' are both enabled. Please disable one for best performance.");
    }
    checkForUpdatedVersion(context, PackageJSON.version);
    vscode.languages.setLanguageConfiguration(utils_1.PowerShellLanguageId, {
        wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\=\+\[\{\]\}\\\|\;\'\"\,\.\<\>\/\?\s]+)/g,
        indentationRules: {
            // ^(.*\*/)?\s*\}.*$
            decreaseIndentPattern: /^(.*\*\/)?\s*\}.*$/,
            // ^.*\{[^}"']*$
            increaseIndentPattern: /^.*\{[^}"']*$/,
        },
        comments: {
            lineComment: "#",
            blockComment: ["<#", "#>"],
        },
        brackets: [
            ["{", "}"],
            ["[", "]"],
            ["(", ")"],
        ],
        onEnterRules: [
            {
                // e.g. /** | */
                beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
                afterText: /^\s*\*\/$/,
                action: { indentAction: vscode.IndentAction.IndentOutdent, appendText: " * " },
            },
            {
                // e.g. /** ...|
                beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
                action: { indentAction: vscode.IndentAction.None, appendText: " * " },
            },
            {
                // e.g.  * ...|
                beforeText: /^(\t|(\ \ ))*\ \*(\ ([^\*]|\*(?!\/))*)?$/,
                action: { indentAction: vscode.IndentAction.None, appendText: "* " },
            },
            {
                // e.g.  */|
                beforeText: /^(\t|(\ \ ))*\ \*\/\s*$/,
                action: { indentAction: vscode.IndentAction.None, removeText: 1 },
            },
            {
                // e.g.  *-----*/|
                beforeText: /^(\t|(\ \ ))*\ \*[^/]*\*\/\s*$/,
                action: { indentAction: vscode.IndentAction.None, removeText: 1 },
            },
        ],
    });
    // Create the logger
    logger = new logging_1.Logger();
    // Set the log level
    const extensionSettings = Settings.load();
    logger.MinimumLogLevel = logging_1.LogLevel[extensionSettings.developer.editorServicesLogLevel];
    sessionManager =
        new session_1.SessionManager(logger, documentSelector, PackageJSON.displayName, PackageJSON.version, telemetryReporter);
    // Register commands that do not require Language client
    commandRegistrations = [
        new Examples_1.ExamplesFeature(),
        new GenerateBugReport_1.GenerateBugReportFeature(sessionManager),
        new ISECompatibility_1.ISECompatibilityFeature(),
        new OpenInISE_1.OpenInISEFeature(),
        new PesterTests_1.PesterTestsFeature(sessionManager),
        new RunCode_1.RunCodeFeature(sessionManager),
        new CodeActions_1.CodeActionsFeature(logger),
        new DebugSession_3.SpecifyScriptArgsFeature(context),
    ];
    const externalApi = new ExternalApi_1.ExternalApiFeature(sessionManager, logger);
    // Features and command registrations that require language client
    languageClientConsumers = [
        new Console_1.ConsoleFeature(logger),
        new ExpandAlias_1.ExpandAliasFeature(logger),
        new GetCommands_1.GetCommandsFeature(logger),
        new ShowHelp_1.ShowHelpFeature(logger),
        new FindModule_1.FindModuleFeature(),
        new ExtensionCommands_1.ExtensionCommandsFeature(logger),
        new NewFileOrProject_1.NewFileOrProjectFeature(),
        new RemoteFiles_1.RemoteFilesFeature(),
        new DebugSession_1.DebugSessionFeature(context, sessionManager, logger),
        new DebugSession_2.PickPSHostProcessFeature(),
        new HelpCompletion_1.HelpCompletionFeature(logger),
        new CustomViews_1.CustomViewsFeature(),
        new DebugSession_2.PickRunspaceFeature(),
        externalApi
    ];
    sessionManager.setLanguageClientConsumers(languageClientConsumers);
    if (extensionSettings.startAutomatically) {
        sessionManager.start();
    }
    return {
        registerExternalExtension: (id, apiVersion = 'v1') => externalApi.registerExternalExtension(id, apiVersion),
        unregisterExternalExtension: uuid => externalApi.unregisterExternalExtension(uuid),
        getPowerShellVersionDetails: uuid => externalApi.getPowerShellVersionDetails(uuid),
    };
}
exports.activate = activate;
function checkForUpdatedVersion(context, version) {
    const showReleaseNotes = "Show Release Notes";
    const powerShellExtensionVersionKey = "powerShellExtensionVersion";
    const storedVersion = context.globalState.get(powerShellExtensionVersionKey);
    if (!storedVersion) {
        // TODO: Prompt to show User Guide for first-time install
    }
    else if (version !== storedVersion) {
        vscode
            .window
            .showInformationMessage(`The PowerShell extension has been updated to version ${version}!`, showReleaseNotes)
            .then((choice) => {
            if (choice === showReleaseNotes) {
                vscode.commands.executeCommand("markdown.showPreview", vscode.Uri.file(path.resolve(__dirname, "../../CHANGELOG.md")));
            }
        });
    }
    context.globalState.update(powerShellExtensionVersionKey, version);
}
function deactivate() {
    // Clean up all extension features
    languageClientConsumers.forEach((languageClientConsumer) => {
        languageClientConsumer.dispose();
    });
    commandRegistrations.forEach((commandRegistration) => {
        commandRegistration.dispose();
    });
    // Dispose of the current session
    sessionManager.dispose();
    // Dispose of the logger
    logger.dispose();
    // Dispose of telemetry reporter
    telemetryReporter.dispose();
}
exports.deactivate = deactivate;
//# sourceMappingURL=main.js.map