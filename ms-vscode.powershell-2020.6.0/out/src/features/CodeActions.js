"use strict";
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeActionsFeature = void 0;
const vscode = require("vscode");
var Window = vscode.window;
class CodeActionsFeature {
    constructor(log) {
        this.log = log;
        this.applyEditsCommand = vscode.commands.registerCommand("PowerShell.ApplyCodeActionEdits", (edit) => {
            Window.activeTextEditor.edit((editBuilder) => {
                editBuilder.replace(new vscode.Range(edit.StartLineNumber - 1, edit.StartColumnNumber - 1, edit.EndLineNumber - 1, edit.EndColumnNumber - 1), edit.Text);
            });
        });
        this.showDocumentationCommand =
            vscode.commands.registerCommand("PowerShell.ShowCodeActionDocumentation", (ruleName) => {
                this.showRuleDocumentation(ruleName);
            });
    }
    dispose() {
        this.applyEditsCommand.dispose();
        this.showDocumentationCommand.dispose();
    }
    setLanguageClient(languageclient) {
        this.languageClient = languageclient;
    }
    showRuleDocumentation(ruleId) {
        const pssaDocBaseURL = "https://github.com/PowerShell/PSScriptAnalyzer/blob/master/RuleDocumentation";
        if (!ruleId) {
            this.log.writeWarning("Cannot show documentation for code action, no ruleName was supplied.");
            return;
        }
        if (ruleId.startsWith("PS")) {
            ruleId = ruleId.substr(2);
        }
        vscode.commands.executeCommand("vscode.open", vscode.Uri.parse(pssaDocBaseURL + `/${ruleId}.md`));
    }
}
exports.CodeActionsFeature = CodeActionsFeature;
//# sourceMappingURL=CodeActions.js.map