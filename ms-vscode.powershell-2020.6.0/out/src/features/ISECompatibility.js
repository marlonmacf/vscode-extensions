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
exports.ISECompatibilityFeature = void 0;
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
const vscode = require("vscode");
const Settings = require("../settings");
/**
 * A feature to implement commands to make code like the ISE and reset the settings.
 */
let ISECompatibilityFeature = /** @class */ (() => {
    class ISECompatibilityFeature {
        constructor() {
            this.iseCommandRegistration = vscode.commands.registerCommand("PowerShell.EnableISEMode", this.EnableISEMode);
            this.defaultCommandRegistration = vscode.commands.registerCommand("PowerShell.DisableISEMode", this.DisableISEMode);
        }
        dispose() {
            this.iseCommandRegistration.dispose();
            this.defaultCommandRegistration.dispose();
        }
        setLanguageClient(languageclient) {
            this.languageClient = languageclient;
        }
        EnableISEMode() {
            return __awaiter(this, void 0, void 0, function* () {
                for (const iseSetting of ISECompatibilityFeature.settings) {
                    yield vscode.workspace.getConfiguration(iseSetting.path).update(iseSetting.name, iseSetting.value, true);
                }
                // Show the PowerShell Command Explorer
                yield vscode.commands.executeCommand("workbench.view.extension.PowerShellCommandExplorer");
                if (!Settings.load().sideBar.CommandExplorerVisibility) {
                    // Hide the explorer if the setting says so.
                    yield vscode.commands.executeCommand("workbench.action.toggleSidebarVisibility");
                }
            });
        }
        DisableISEMode() {
            return __awaiter(this, void 0, void 0, function* () {
                for (const iseSetting of ISECompatibilityFeature.settings) {
                    const currently = vscode.workspace.getConfiguration(iseSetting.path).get(iseSetting.name);
                    if (currently === iseSetting.value) {
                        yield vscode.workspace.getConfiguration(iseSetting.path).update(iseSetting.name, undefined, true);
                    }
                }
            });
        }
    }
    // Marking settings as public so we can use it within the tests without needing to duplicate the list of settings.
    ISECompatibilityFeature.settings = [
        { path: "workbench.activityBar", name: "visible", value: false },
        { path: "debug", name: "openDebug", value: "neverOpen" },
        { path: "editor", name: "tabCompletion", value: "on" },
        { path: "powershell.integratedConsole", name: "focusConsoleOnExecute", value: false },
        { path: "files", name: "defaultLanguage", value: "powershell" },
        { path: "workbench", name: "colorTheme", value: "PowerShell ISE" },
        { path: "editor", name: "wordSeparators", value: "`~!@#%^&*()-=+[{]}\\|;:'\",.<>/?" },
        { path: "powershell.buttons", name: "showPanelMovementButtons", value: true }
    ];
    return ISECompatibilityFeature;
})();
exports.ISECompatibilityFeature = ISECompatibilityFeature;
//# sourceMappingURL=ISECompatibility.js.map