"use strict";
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShowHelpFeature = exports.ShowHelpNotificationType = void 0;
const vscode = require("vscode");
const vscode_languageclient_1 = require("vscode-languageclient");
const languageClientConsumer_1 = require("../languageClientConsumer");
exports.ShowHelpNotificationType = new vscode_languageclient_1.NotificationType("powerShell/showHelp");
class ShowHelpFeature extends languageClientConsumer_1.LanguageClientConsumer {
    constructor(log) {
        super();
        this.log = log;
        this.command = vscode.commands.registerCommand("PowerShell.ShowHelp", (item) => {
            if (!item || !item.Name) {
                const editor = vscode.window.activeTextEditor;
                const selection = editor.selection;
                const doc = editor.document;
                const cwr = doc.getWordRangeAtPosition(selection.active);
                const text = doc.getText(cwr);
                this.languageClient.sendNotification(exports.ShowHelpNotificationType, { text });
            }
            else {
                this.languageClient.sendNotification(exports.ShowHelpNotificationType, { text: item.Name });
            }
        });
    }
    dispose() {
        this.command.dispose();
        this.deprecatedCommand.dispose();
    }
}
exports.ShowHelpFeature = ShowHelpFeature;
//# sourceMappingURL=ShowHelp.js.map