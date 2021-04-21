"use strict";
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpandAliasFeature = exports.ExpandAliasRequestType = void 0;
const vscode = require("vscode");
var Window = vscode.window;
const vscode_languageclient_1 = require("vscode-languageclient");
const languageClientConsumer_1 = require("../languageClientConsumer");
exports.ExpandAliasRequestType = new vscode_languageclient_1.RequestType("powerShell/expandAlias");
class ExpandAliasFeature extends languageClientConsumer_1.LanguageClientConsumer {
    constructor(log) {
        super();
        this.log = log;
        this.command = vscode.commands.registerCommand("PowerShell.ExpandAlias", () => {
            const editor = Window.activeTextEditor;
            const document = editor.document;
            const selection = editor.selection;
            const sls = selection.start;
            const sle = selection.end;
            let text;
            let range;
            if ((sls.character === sle.character) && (sls.line === sle.line)) {
                text = document.getText();
                range = new vscode.Range(0, 0, document.lineCount, text.length);
            }
            else {
                text = document.getText(selection);
                range = new vscode.Range(sls.line, sls.character, sle.line, sle.character);
            }
            this.languageClient.sendRequest(exports.ExpandAliasRequestType, { text }).then((result) => {
                editor.edit((editBuilder) => {
                    editBuilder.replace(range, result.text);
                });
            });
        });
    }
    dispose() {
        this.command.dispose();
    }
}
exports.ExpandAliasFeature = ExpandAliasFeature;
//# sourceMappingURL=ExpandAlias.js.map