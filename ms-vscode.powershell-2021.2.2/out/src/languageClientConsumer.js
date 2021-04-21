"use strict";
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.LanguageClientConsumer = void 0;
const vscode_1 = require("vscode");
class LanguageClientConsumer {
    setLanguageClient(languageClient) {
        this.languageClient = languageClient;
    }
    get languageClient() {
        if (!this._languageClient) {
            vscode_1.window.showInformationMessage("PowerShell extension has not finished starting up yet. Please try again in a few moments.");
        }
        return this._languageClient;
    }
    set languageClient(value) {
        this._languageClient = value;
    }
}
exports.LanguageClientConsumer = LanguageClientConsumer;
//# sourceMappingURL=languageClientConsumer.js.map