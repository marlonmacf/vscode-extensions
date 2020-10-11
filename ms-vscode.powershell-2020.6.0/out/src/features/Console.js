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
exports.ConsoleFeature = exports.ShowInputPromptRequestType = exports.ShowChoicePromptRequestType = exports.ExecutionStatusChangedNotificationType = exports.OutputNotificationType = exports.EvaluateRequestType = void 0;
const vscode = require("vscode");
const vscode_languageclient_1 = require("vscode-languageclient");
const checkboxQuickPick_1 = require("../controls/checkboxQuickPick");
const Settings = require("../settings");
exports.EvaluateRequestType = new vscode_languageclient_1.RequestType("evaluate");
exports.OutputNotificationType = new vscode_languageclient_1.NotificationType("output");
exports.ExecutionStatusChangedNotificationType = new vscode_languageclient_1.NotificationType("powerShell/executionStatusChanged");
exports.ShowChoicePromptRequestType = new vscode_languageclient_1.RequestType("powerShell/showChoicePrompt");
exports.ShowInputPromptRequestType = new vscode_languageclient_1.RequestType("powerShell/showInputPrompt");
var ExecutionStatus;
(function (ExecutionStatus) {
    ExecutionStatus[ExecutionStatus["Pending"] = 0] = "Pending";
    ExecutionStatus[ExecutionStatus["Running"] = 1] = "Running";
    ExecutionStatus[ExecutionStatus["Failed"] = 2] = "Failed";
    ExecutionStatus[ExecutionStatus["Aborted"] = 3] = "Aborted";
    ExecutionStatus[ExecutionStatus["Completed"] = 4] = "Completed";
})(ExecutionStatus || (ExecutionStatus = {}));
function showChoicePrompt(promptDetails, client) {
    let resultThenable;
    if (!promptDetails.isMultiChoice) {
        let quickPickItems = promptDetails.choices.map((choice) => {
            return {
                label: choice.label,
                description: choice.helpMessage,
            };
        });
        if (promptDetails.defaultChoices && promptDetails.defaultChoices.length > 0) {
            // Shift the default items to the front of the
            // array so that the user can select it easily
            const defaultChoice = promptDetails.defaultChoices[0];
            if (defaultChoice > -1 &&
                defaultChoice < promptDetails.choices.length) {
                const defaultChoiceItem = quickPickItems[defaultChoice];
                quickPickItems.splice(defaultChoice, 1);
                // Add the default choice to the head of the array
                quickPickItems = [defaultChoiceItem].concat(quickPickItems);
            }
        }
        resultThenable =
            vscode.window
                .showQuickPick(quickPickItems, { placeHolder: promptDetails.message })
                .then(onItemSelected);
    }
    else {
        const checkboxQuickPickItems = promptDetails.choices.map((choice) => {
            return {
                label: choice.label,
                description: choice.helpMessage,
                isSelected: false,
            };
        });
        // Select the defaults
        promptDetails.defaultChoices.forEach((choiceIndex) => {
            checkboxQuickPickItems[choiceIndex].isSelected = true;
        });
        resultThenable =
            checkboxQuickPick_1.showCheckboxQuickPick(checkboxQuickPickItems, { confirmPlaceHolder: promptDetails.message })
                .then(onItemsSelected);
    }
    return resultThenable;
}
function showInputPrompt(promptDetails, client) {
    const resultThenable = vscode.window.showInputBox({
        placeHolder: promptDetails.name + ": ",
    }).then(onInputEntered);
    return resultThenable;
}
function onItemsSelected(chosenItems) {
    if (chosenItems !== undefined) {
        return {
            promptCancelled: false,
            responseText: chosenItems.filter((item) => item.isSelected).map((item) => item.label).join(", "),
        };
    }
    else {
        // User cancelled the prompt, send the cancellation
        return {
            promptCancelled: true,
            responseText: undefined,
        };
    }
}
function onItemSelected(chosenItem) {
    if (chosenItem !== undefined) {
        return {
            promptCancelled: false,
            responseText: chosenItem.label,
        };
    }
    else {
        // User cancelled the prompt, send the cancellation
        return {
            promptCancelled: true,
            responseText: undefined,
        };
    }
}
function onInputEntered(responseText) {
    if (responseText !== undefined) {
        return {
            promptCancelled: false,
            responseText,
        };
    }
    else {
        return {
            promptCancelled: true,
            responseText: undefined,
        };
    }
}
class ConsoleFeature {
    constructor(log) {
        this.log = log;
        this.commands = [
            vscode.commands.registerCommand("PowerShell.RunSelection", () => __awaiter(this, void 0, void 0, function* () {
                if (this.languageClient === undefined) {
                    this.log.writeAndShowError(`<${ConsoleFeature.name}>: ` +
                        "Unable to instantiate; language client undefined.");
                    return;
                }
                if (vscode.window.activeTerminal &&
                    vscode.window.activeTerminal.name !== "PowerShell Integrated Console") {
                    this.log.write("PSIC is not active terminal. Running in active terminal using 'runSelectedText'");
                    yield vscode.commands.executeCommand("workbench.action.terminal.runSelectedText");
                    // We need to honor the focusConsoleOnExecute setting here too. However, the boolean that `show`
                    // takes is called `preserveFocus` which when `true` the terminal will not take focus.
                    // This is the inverse of focusConsoleOnExecute so we have to inverse the boolean.
                    vscode.window.activeTerminal.show(!Settings.load().integratedConsole.focusConsoleOnExecute);
                    yield vscode.commands.executeCommand("workbench.action.terminal.scrollToBottom");
                    return;
                }
                const editor = vscode.window.activeTextEditor;
                let selectionRange;
                if (!editor.selection.isEmpty) {
                    selectionRange =
                        new vscode.Range(editor.selection.start, editor.selection.end);
                }
                else {
                    selectionRange = editor.document.lineAt(editor.selection.start.line).range;
                }
                this.languageClient.sendRequest(exports.EvaluateRequestType, {
                    expression: editor.document.getText(selectionRange),
                });
                // Show the integrated console if it isn't already visible and
                // scroll terminal to bottom so new output is visible
                yield vscode.commands.executeCommand("PowerShell.ShowSessionConsole", true);
                yield vscode.commands.executeCommand("workbench.action.terminal.scrollToBottom");
            })),
        ];
    }
    dispose() {
        // Make sure we cancel any status bar
        this.clearStatusBar();
        this.commands.forEach((command) => command.dispose());
    }
    setLanguageClient(languageClient) {
        this.languageClient = languageClient;
        this.languageClient.onRequest(exports.ShowChoicePromptRequestType, (promptDetails) => showChoicePrompt(promptDetails, this.languageClient));
        this.languageClient.onRequest(exports.ShowInputPromptRequestType, (promptDetails) => showInputPrompt(promptDetails, this.languageClient));
        // Set up status bar alerts for when PowerShell is executing a script
        this.languageClient.onNotification(exports.ExecutionStatusChangedNotificationType, (executionStatusDetails) => {
            switch (executionStatusDetails.executionStatus) {
                // If execution has changed to running, make a notification
                case ExecutionStatus.Running:
                    this.showExecutionStatus("PowerShell");
                    break;
                // If the execution has stopped, destroy the previous notification
                case ExecutionStatus.Completed:
                case ExecutionStatus.Aborted:
                case ExecutionStatus.Failed:
                    this.clearStatusBar();
                    break;
            }
        });
    }
    showExecutionStatus(message) {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
        }, (progress) => {
            return new Promise((resolve, reject) => {
                this.clearStatusBar();
                this.resolveStatusBarPromise = resolve;
                progress.report({ message });
            });
        });
    }
    clearStatusBar() {
        if (this.resolveStatusBarPromise) {
            this.resolveStatusBarPromise();
        }
    }
}
exports.ConsoleFeature = ConsoleFeature;
//# sourceMappingURL=Console.js.map