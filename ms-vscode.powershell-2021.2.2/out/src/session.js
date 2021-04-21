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
exports.RunspaceType = exports.RunspaceChangedEventType = exports.PowerShellVersionRequestType = exports.SessionManager = exports.SessionStatus = void 0;
const fs = require("fs");
const net = require("net");
const path = require("path");
const semver = require("semver");
const vscode = require("vscode");
const process_1 = require("./process");
const Settings = require("./settings");
const utils = require("./utils");
const vscode_languageclient_1 = require("vscode-languageclient");
const node_1 = require("vscode-languageclient/node");
const UpdatePowerShell_1 = require("./features/UpdatePowerShell");
const platform_1 = require("./platform");
var SessionStatus;
(function (SessionStatus) {
    SessionStatus[SessionStatus["NeverStarted"] = 0] = "NeverStarted";
    SessionStatus[SessionStatus["NotStarted"] = 1] = "NotStarted";
    SessionStatus[SessionStatus["Initializing"] = 2] = "Initializing";
    SessionStatus[SessionStatus["Running"] = 3] = "Running";
    SessionStatus[SessionStatus["Stopping"] = 4] = "Stopping";
    SessionStatus[SessionStatus["Failed"] = 5] = "Failed";
})(SessionStatus = exports.SessionStatus || (exports.SessionStatus = {}));
class SessionManager {
    constructor(log, documentSelector, hostName, version, telemetryReporter) {
        this.log = log;
        this.documentSelector = documentSelector;
        this.telemetryReporter = telemetryReporter;
        this.ShowSessionMenuCommandName = "PowerShell.ShowSessionMenu";
        this.sessionStatus = SessionStatus.NeverStarted;
        this.languageClientConsumers = [];
        this.registeredCommands = [];
        this.languageServerClient = undefined;
        this.sessionSettings = undefined;
        this.started = false;
        // When in development mode, VS Code's session ID is a fake
        // value of "someValue.machineId".  Use that to detect dev
        // mode for now until Microsoft/vscode#10272 gets implemented.
        this.InDevelopmentMode = vscode.env.sessionId === "someValue.sessionId";
        this.platformDetails = platform_1.getPlatformDetails();
        this.HostName = hostName;
        this.HostVersion = version;
        const osBitness = this.platformDetails.isOS64Bit ? "64-bit" : "32-bit";
        const procBitness = this.platformDetails.isProcess64Bit ? "64-bit" : "32-bit";
        this.log.write(`Visual Studio Code v${vscode.version} ${procBitness}`, `${this.HostName} Extension v${this.HostVersion}`, `Operating System: ${platform_1.OperatingSystem[this.platformDetails.operatingSystem]} ${osBitness}`);
        // Fix the host version so that PowerShell can consume it.
        // This is needed when the extension uses a prerelease
        // version string like 0.9.1-insiders-1234.
        this.HostVersion = this.HostVersion.split("-")[0];
        this.registerCommands();
    }
    dispose() {
        // Stop the current session
        this.stop();
        // Dispose of all commands
        this.registeredCommands.forEach((command) => { command.dispose(); });
    }
    setLanguageClientConsumers(languageClientConsumers) {
        this.languageClientConsumers = languageClientConsumers;
    }
    start(exeNameOverride) {
        this.sessionSettings = Settings.load();
        if (exeNameOverride) {
            this.sessionSettings.powerShellDefaultVersion = exeNameOverride;
        }
        this.log.startNewLog(this.sessionSettings.developer.editorServicesLogLevel);
        // Create the PowerShell executable finder now
        this.powershellExeFinder = new platform_1.PowerShellExeFinder(this.platformDetails, this.sessionSettings.powerShellAdditionalExePaths);
        this.focusConsoleOnExecute = this.sessionSettings.integratedConsole.focusConsoleOnExecute;
        this.createStatusBarItem();
        this.promptPowerShellExeSettingsCleanup();
        this.migrateWhitespaceAroundPipeSetting();
        try {
            let powerShellExeDetails;
            if (this.sessionSettings.powerShellDefaultVersion) {
                for (const details of this.powershellExeFinder.enumeratePowerShellInstallations()) {
                    // Need to compare names case-insensitively, from https://stackoverflow.com/a/2140723
                    const wantedName = this.sessionSettings.powerShellDefaultVersion;
                    if (wantedName.localeCompare(details.displayName, undefined, { sensitivity: "accent" }) === 0) {
                        powerShellExeDetails = details;
                        break;
                    }
                }
            }
            this.PowerShellExeDetails = powerShellExeDetails ||
                this.powershellExeFinder.getFirstAvailablePowerShellInstallation();
        }
        catch (e) {
            this.log.writeError(`Error occurred while searching for a PowerShell executable:\n${e}`);
        }
        this.suppressRestartPrompt = false;
        if (!this.PowerShellExeDetails) {
            const message = "Unable to find PowerShell."
                + " Do you have PowerShell installed?"
                + " You can also configure custom PowerShell installations"
                + " with the 'powershell.powerShellAdditionalExePaths' setting.";
            this.log.writeAndShowErrorWithActions(message, [
                {
                    prompt: "Get PowerShell",
                    action: () => __awaiter(this, void 0, void 0, function* () {
                        const getPSUri = vscode.Uri.parse("https://aka.ms/get-powershell-vscode");
                        vscode.env.openExternal(getPSUri);
                    }),
                },
            ]);
            return;
        }
        this.bundledModulesPath = path.resolve(__dirname, this.sessionSettings.bundledModulesPath);
        if (this.InDevelopmentMode) {
            const devBundledModulesPath = path.resolve(__dirname, this.sessionSettings.developer.bundledModulesPath);
            // Make sure the module's bin path exists
            if (fs.existsSync(path.join(devBundledModulesPath, "PowerShellEditorServices/bin"))) {
                this.bundledModulesPath = devBundledModulesPath;
            }
            else {
                this.log.write("\nWARNING: In development mode but PowerShellEditorServices dev module path cannot be " +
                    `found (or has not been built yet): ${devBundledModulesPath}\n`);
            }
        }
        this.editorServicesArgs =
            `-HostName 'Visual Studio Code Host' ` +
                `-HostProfileId 'Microsoft.VSCode' ` +
                `-HostVersion '${this.HostVersion}' ` +
                `-AdditionalModules @('PowerShellEditorServices.VSCode') ` +
                `-BundledModulesPath '${process_1.PowerShellProcess.escapeSingleQuotes(this.bundledModulesPath)}' ` +
                `-EnableConsoleRepl `;
        if (this.sessionSettings.integratedConsole.suppressStartupBanner) {
            this.editorServicesArgs += "-StartupBanner '' ";
        }
        else {
            const startupBanner = `=====> ${this.HostName} Integrated Console v${this.HostVersion} <=====
`;
            this.editorServicesArgs += `-StartupBanner '${startupBanner}' `;
        }
        if (this.sessionSettings.developer.editorServicesWaitForDebugger) {
            this.editorServicesArgs += "-WaitForDebugger ";
        }
        if (this.sessionSettings.developer.editorServicesLogLevel) {
            this.editorServicesArgs += `-LogLevel '${this.sessionSettings.developer.editorServicesLogLevel}' `;
        }
        this.startPowerShell();
    }
    stop() {
        // Shut down existing session if there is one
        this.log.write("Shutting down language client...");
        if (this.sessionStatus === SessionStatus.Failed) {
            // Before moving further, clear out the client and process if
            // the process is already dead (i.e. it crashed)
            this.languageServerClient = undefined;
            this.languageServerProcess = undefined;
        }
        this.sessionStatus = SessionStatus.Stopping;
        // Close the language server client
        if (this.languageServerClient !== undefined) {
            this.languageServerClient.stop();
            this.languageServerClient = undefined;
        }
        // Kill the PowerShell proceses we spawned
        if (this.debugSessionProcess) {
            this.debugSessionProcess.dispose();
        }
        if (this.languageServerProcess) {
            this.languageServerProcess.dispose();
        }
        this.sessionStatus = SessionStatus.NotStarted;
    }
    restartSession(exeNameOverride) {
        this.stop();
        this.start(exeNameOverride);
    }
    getSessionDetails() {
        return this.sessionDetails;
    }
    getSessionStatus() {
        return this.sessionStatus;
    }
    getPowerShellVersionDetails() {
        return this.versionDetails;
    }
    createDebugSessionProcess(sessionPath, sessionSettings) {
        this.debugSessionProcess =
            new process_1.PowerShellProcess(this.PowerShellExeDetails.exePath, this.bundledModulesPath, "[TEMP] PowerShell Integrated Console", this.log, this.editorServicesArgs + "-DebugServiceOnly ", sessionPath, sessionSettings);
        return this.debugSessionProcess;
    }
    waitUntilStarted() {
        return __awaiter(this, void 0, void 0, function* () {
            while (!this.started) {
                yield utils.sleep(300);
            }
        });
    }
    // ----- LanguageClient middleware methods -----
    resolveCodeLens(codeLens, token, next) {
        const resolvedCodeLens = next(codeLens, token);
        const resolveFunc = (codeLensToFix) => {
            var _a;
            if (((_a = codeLensToFix.command) === null || _a === void 0 ? void 0 : _a.command) === "editor.action.showReferences") {
                const oldArgs = codeLensToFix.command.arguments;
                // Our JSON objects don't get handled correctly by
                // VS Code's built in editor.action.showReferences
                // command so we need to convert them into the
                // appropriate types to send them as command
                // arguments.
                codeLensToFix.command.arguments = [
                    vscode.Uri.parse(oldArgs[0]),
                    new vscode.Position(oldArgs[1].line, oldArgs[1].character),
                    oldArgs[2].map((position) => {
                        return new vscode.Location(vscode.Uri.parse(position.uri), new vscode.Range(position.range.start.line, position.range.start.character, position.range.end.line, position.range.end.character));
                    }),
                ];
            }
            return codeLensToFix;
        };
        if (resolvedCodeLens.then) {
            return resolvedCodeLens.then(resolveFunc);
        }
        else if (resolvedCodeLens) {
            return resolveFunc(resolvedCodeLens);
        }
        return resolvedCodeLens;
    }
    // Move old setting codeFormatting.whitespaceAroundPipe to new setting codeFormatting.addWhitespaceAroundPipe
    migrateWhitespaceAroundPipeSetting() {
        return __awaiter(this, void 0, void 0, function* () {
            const configuration = vscode.workspace.getConfiguration(utils.PowerShellLanguageId);
            const deprecatedSetting = 'codeFormatting.whitespaceAroundPipe';
            const newSetting = 'codeFormatting.addWhitespaceAroundPipe';
            const configurationTargetOfNewSetting = yield Settings.getEffectiveConfigurationTarget(newSetting);
            const configurationTargetOfOldSetting = yield Settings.getEffectiveConfigurationTarget(deprecatedSetting);
            if (configurationTargetOfOldSetting !== null && configurationTargetOfNewSetting === null) {
                const value = configuration.get(deprecatedSetting, configurationTargetOfOldSetting);
                yield Settings.change(newSetting, value, configurationTargetOfOldSetting);
                yield Settings.change(deprecatedSetting, undefined, configurationTargetOfOldSetting);
            }
        });
    }
    promptPowerShellExeSettingsCleanup() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.sessionSettings.powerShellExePath) {
                let warningMessage = "The 'powerShell.powerShellExePath' setting is no longer used. ";
                warningMessage += this.sessionSettings.powerShellDefaultVersion
                    ? "We can automatically remove it for you."
                    : "We can remove it from your settings and prompt you for which PowerShell you want to use.";
                const choice = yield vscode.window.showWarningMessage(warningMessage, "Let's do it!");
                if (choice === undefined) {
                    // They hit the 'x' to close the dialog.
                    return;
                }
                this.suppressRestartPrompt = true;
                try {
                    yield Settings.change("powerShellExePath", undefined, true);
                }
                finally {
                    this.suppressRestartPrompt = false;
                }
                // Show the session menu at the end if they don't have a PowerShellDefaultVersion.
                if (!this.sessionSettings.powerShellDefaultVersion) {
                    yield vscode.commands.executeCommand(this.ShowSessionMenuCommandName);
                }
            }
        });
    }
    onConfigurationUpdated() {
        const settings = Settings.load();
        this.focusConsoleOnExecute = settings.integratedConsole.focusConsoleOnExecute;
        // Detect any setting changes that would affect the session
        if (!this.suppressRestartPrompt &&
            (settings.useX86Host !==
                this.sessionSettings.useX86Host ||
                settings.powerShellDefaultVersion.toLowerCase() !==
                    this.sessionSettings.powerShellDefaultVersion.toLowerCase() ||
                settings.developer.editorServicesLogLevel.toLowerCase() !==
                    this.sessionSettings.developer.editorServicesLogLevel.toLowerCase() ||
                settings.developer.bundledModulesPath.toLowerCase() !==
                    this.sessionSettings.developer.bundledModulesPath.toLowerCase() ||
                settings.integratedConsole.useLegacyReadLine !==
                    this.sessionSettings.integratedConsole.useLegacyReadLine)) {
            vscode.window.showInformationMessage("The PowerShell runtime configuration has changed, would you like to start a new session?", "Yes", "No")
                .then((response) => {
                if (response === "Yes") {
                    this.restartSession();
                }
            });
        }
    }
    setStatusBarVersionString(runspaceDetails) {
        const psVersion = runspaceDetails.powerShellVersion;
        let versionString = this.versionDetails.architecture === "x86"
            ? `${psVersion.displayVersion} (${psVersion.architecture})`
            : psVersion.displayVersion;
        if (runspaceDetails.runspaceType !== RunspaceType.Local) {
            versionString += ` [${runspaceDetails.connectionString}]`;
        }
        this.setSessionStatus(versionString, SessionStatus.Running);
    }
    registerCommands() {
        this.registeredCommands = [
            vscode.commands.registerCommand("PowerShell.RestartSession", () => { this.restartSession(); }),
            vscode.commands.registerCommand(this.ShowSessionMenuCommandName, () => { this.showSessionMenu(); }),
            vscode.workspace.onDidChangeConfiguration(() => this.onConfigurationUpdated()),
            vscode.commands.registerCommand("PowerShell.ShowSessionConsole", (isExecute) => { this.showSessionConsole(isExecute); }),
        ];
    }
    startPowerShell() {
        this.setSessionStatus("Starting PowerShell...", SessionStatus.Initializing);
        const sessionFilePath = utils.getSessionFilePath(Math.floor(100000 + Math.random() * 900000));
        this.languageServerProcess =
            new process_1.PowerShellProcess(this.PowerShellExeDetails.exePath, this.bundledModulesPath, "PowerShell Integrated Console", this.log, this.editorServicesArgs, sessionFilePath, this.sessionSettings);
        this.languageServerProcess.onExited(() => {
            if (this.sessionStatus === SessionStatus.Running) {
                this.setSessionStatus("Session exited", SessionStatus.Failed);
                this.promptForRestart();
            }
        });
        this.languageServerProcess
            .start("EditorServices")
            .then((sessionDetails) => {
            this.sessionDetails = sessionDetails;
            if (sessionDetails.status === "started") {
                this.log.write("Language server started.");
                // Start the language service client
                this.startLanguageClient(sessionDetails);
            }
            else if (sessionDetails.status === "failed") {
                if (sessionDetails.reason === "unsupported") {
                    this.setSessionFailure("PowerShell language features are only supported on PowerShell version 5.1 and 6.1" +
                        ` and above. The current version is ${sessionDetails.powerShellVersion}.`);
                }
                else if (sessionDetails.reason === "languageMode") {
                    this.setSessionFailure("PowerShell language features are disabled due to an unsupported LanguageMode: " +
                        `${sessionDetails.detail}`);
                }
                else {
                    this.setSessionFailure(`PowerShell could not be started for an unknown reason '${sessionDetails.reason}'`);
                }
            }
            else {
                // TODO: Handle other response cases
            }
        }, (error) => {
            this.log.write("Language server startup failed.");
            this.setSessionFailure("The language service could not be started: ", error);
        })
            .catch((error) => {
            this.log.write("Language server startup failed.");
            this.setSessionFailure("The language server could not be started: ", error);
        });
    }
    promptForRestart() {
        vscode.window.showErrorMessage("The PowerShell session has terminated due to an error, would you like to restart it?", "Yes", "No")
            .then((answer) => { if (answer === "Yes") {
            this.restartSession();
        } });
    }
    startLanguageClient(sessionDetails) {
        // Log the session details object
        this.log.write(JSON.stringify(sessionDetails));
        try {
            this.log.write(`Connecting to language service on pipe ${sessionDetails.languageServicePipeName}...`);
            const connectFunc = () => {
                return new Promise((resolve, reject) => {
                    const socket = net.connect(sessionDetails.languageServicePipeName);
                    socket.on("connect", () => {
                        this.log.write("Language service connected.");
                        resolve({ writer: socket, reader: socket });
                    });
                });
            };
            const clientOptions = {
                documentSelector: this.documentSelector,
                synchronize: {
                    // backend uses "files" and "search" to ignore references.
                    configurationSection: [utils.PowerShellLanguageId, "files", "search"],
                },
                errorHandler: {
                    // Override the default error handler to prevent it from
                    // closing the LanguageClient incorrectly when the socket
                    // hangs up (ECONNRESET errors).
                    error: (error, message, count) => {
                        // TODO: Is there any error worth terminating on?
                        return vscode_languageclient_1.ErrorAction.Continue;
                    },
                    closed: () => {
                        // We have our own restart experience
                        return vscode_languageclient_1.CloseAction.DoNotRestart;
                    },
                },
                revealOutputChannelOn: vscode_languageclient_1.RevealOutputChannelOn.Never,
                middleware: this,
            };
            this.languageServerClient =
                new node_1.LanguageClient("PowerShell Editor Services", connectFunc, clientOptions);
            // This enables handling Semantic Highlighting messages in PowerShell Editor Services
            this.languageServerClient.registerProposedFeatures();
            if (!this.InDevelopmentMode) {
                this.languageServerClient.onTelemetry((event) => {
                    const eventName = event.eventName ? event.eventName : "PSESEvent";
                    const data = event.data ? event.data : event;
                    this.telemetryReporter.sendTelemetryEvent(eventName, data);
                });
            }
            this.languageServerClient.onReady().then(() => {
                this.languageServerClient
                    .sendRequest(exports.PowerShellVersionRequestType)
                    .then((versionDetails) => __awaiter(this, void 0, void 0, function* () {
                    this.versionDetails = versionDetails;
                    this.started = true;
                    if (!this.InDevelopmentMode) {
                        this.telemetryReporter.sendTelemetryEvent("powershellVersionCheck", { powershellVersion: versionDetails.version });
                    }
                    this.setSessionStatus(this.versionDetails.architecture === "x86"
                        ? `${this.versionDetails.displayVersion} (${this.versionDetails.architecture})`
                        : this.versionDetails.displayVersion, SessionStatus.Running);
                    // If the user opted to not check for updates, then don't.
                    if (!this.sessionSettings.promptToUpdatePowerShell) {
                        return;
                    }
                    try {
                        const localVersion = semver.parse(this.versionDetails.version);
                        if (semver.lt(localVersion, "6.0.0")) {
                            // Skip prompting when using Windows PowerShell for now.
                            return;
                        }
                        // Fetch the latest PowerShell releases from GitHub.
                        const isPreRelease = !!semver.prerelease(localVersion);
                        const release = yield UpdatePowerShell_1.GitHubReleaseInformation.FetchLatestRelease(isPreRelease);
                        yield UpdatePowerShell_1.InvokePowerShellUpdateCheck(this, this.languageServerClient, localVersion, this.versionDetails.architecture, release);
                    }
                    catch (e) {
                        // best effort. This probably failed to fetch the data from GitHub.
                        this.log.writeWarning(e.message);
                    }
                }));
                // Send the new LanguageClient to extension features
                // so that they can register their message handlers
                // before the connection is established.
                this.updateLanguageClientConsumers(this.languageServerClient);
                this.languageServerClient.onNotification(exports.RunspaceChangedEventType, (runspaceDetails) => { this.setStatusBarVersionString(runspaceDetails); });
            }, (reason) => {
                this.setSessionFailure("Could not start language service: ", reason);
            });
            this.languageServerClient.start();
        }
        catch (e) {
            this.setSessionFailure("The language service could not be started: ", e);
        }
    }
    updateLanguageClientConsumers(languageClient) {
        this.languageClientConsumers.forEach((feature) => {
            feature.setLanguageClient(languageClient);
        });
    }
    createStatusBarItem() {
        if (this.statusBarItem === undefined) {
            // Create the status bar item and place it right next
            // to the language indicator
            this.statusBarItem =
                vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1);
            this.statusBarItem.command = this.ShowSessionMenuCommandName;
            this.statusBarItem.tooltip = "Show PowerShell Session Menu";
            this.statusBarItem.show();
            vscode.window.onDidChangeActiveTextEditor((textEditor) => {
                if (textEditor === undefined
                    || textEditor.document.languageId !== "powershell") {
                    this.statusBarItem.hide();
                }
                else {
                    this.statusBarItem.show();
                }
            });
        }
    }
    setSessionStatus(statusText, status) {
        // Set color and icon for 'Running' by default
        let statusIconText = "$(terminal) ";
        let statusColor = "#affc74";
        if (status === SessionStatus.Initializing) {
            statusIconText = "$(sync) ";
            statusColor = "#f3fc74";
        }
        else if (status === SessionStatus.Failed) {
            statusIconText = "$(alert) ";
            statusColor = "#fcc174";
        }
        this.sessionStatus = status;
        this.statusBarItem.color = statusColor;
        this.statusBarItem.text = statusIconText + statusText;
    }
    setSessionFailure(message, ...additionalMessages) {
        this.log.writeAndShowError(message, ...additionalMessages);
        this.setSessionStatus("Initialization Error", SessionStatus.Failed);
    }
    changePowerShellDefaultVersion(exePath) {
        return __awaiter(this, void 0, void 0, function* () {
            this.suppressRestartPrompt = true;
            yield Settings.change("powerShellDefaultVersion", exePath.displayName, true);
            // We pass in the display name so that we force the extension to use that version
            // rather than pull from the settings. The issue we prevent here is when a
            // workspace setting is defined which gets priority over user settings which
            // is what the change above sets.
            this.restartSession(exePath.displayName);
        });
    }
    showSessionConsole(isExecute) {
        if (this.languageServerProcess) {
            this.languageServerProcess.showConsole(isExecute && !this.focusConsoleOnExecute);
        }
    }
    showSessionMenu() {
        const availablePowerShellExes = this.powershellExeFinder.getAllAvailablePowerShellInstallations();
        let sessionText;
        switch (this.sessionStatus) {
            case SessionStatus.Running:
            case SessionStatus.Initializing:
            case SessionStatus.NotStarted:
            case SessionStatus.NeverStarted:
            case SessionStatus.Stopping:
                const currentPowerShellExe = availablePowerShellExes
                    .find((item) => item.displayName.toLowerCase() === this.PowerShellExeDetails.displayName.toLowerCase());
                const powerShellSessionName = currentPowerShellExe ?
                    currentPowerShellExe.displayName :
                    `PowerShell ${this.versionDetails.displayVersion} ` +
                        `(${this.versionDetails.architecture}) ${this.versionDetails.edition} Edition ` +
                        `[${this.versionDetails.version}]`;
                sessionText = `Current session: ${powerShellSessionName}`;
                break;
            case SessionStatus.Failed:
                sessionText = "Session initialization failed, click here to show PowerShell extension logs";
                break;
            default:
                throw new TypeError("Not a valid value for the enum 'SessionStatus'");
        }
        const powerShellItems = availablePowerShellExes
            .filter((item) => item.displayName !== this.PowerShellExeDetails.displayName)
            .map((item) => {
            return new SessionMenuItem(`Switch to: ${item.displayName}`, () => { this.changePowerShellDefaultVersion(item); });
        });
        const menuItems = [
            new SessionMenuItem(sessionText, () => { vscode.commands.executeCommand("PowerShell.ShowLogs"); }),
            // Add all of the different PowerShell options
            ...powerShellItems,
            new SessionMenuItem("Restart Current Session", () => {
                // We pass in the display name so we guarentee that the session
                // will be the same PowerShell.
                this.restartSession(this.PowerShellExeDetails.displayName);
            }),
            new SessionMenuItem("Open Session Logs Folder", () => { vscode.commands.executeCommand("PowerShell.OpenLogFolder"); }),
            new SessionMenuItem("Modify 'powerShell.powerShellAdditionalExePaths' in Settings", () => { vscode.commands.executeCommand("workbench.action.openSettingsJson"); }),
        ];
        vscode
            .window
            .showQuickPick(menuItems)
            .then((selectedItem) => { selectedItem.callback(); });
    }
}
exports.SessionManager = SessionManager;
class SessionMenuItem {
    constructor(label, 
    // tslint:disable-next-line:no-empty
    callback = () => { }) {
        this.label = label;
        this.callback = callback;
    }
}
exports.PowerShellVersionRequestType = new vscode_languageclient_1.RequestType0("powerShell/getVersion");
exports.RunspaceChangedEventType = new vscode_languageclient_1.NotificationType("powerShell/runspaceChanged");
var RunspaceType;
(function (RunspaceType) {
    RunspaceType[RunspaceType["Local"] = 0] = "Local";
    RunspaceType[RunspaceType["Process"] = 1] = "Process";
    RunspaceType[RunspaceType["Remote"] = 2] = "Remote";
})(RunspaceType = exports.RunspaceType || (exports.RunspaceType = {}));
//# sourceMappingURL=session.js.map