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
exports.GetCommandsFeature = exports.GetCommandRequestType = void 0;
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
const vscode = require("vscode");
const vscode_languageclient_1 = require("vscode-languageclient");
const languageClientConsumer_1 = require("../languageClientConsumer");
/**
 * RequestType sent over to PSES.
 * Expects: ICommand to be returned
 */
exports.GetCommandRequestType = new vscode_languageclient_1.RequestType0("powerShell/getCommand");
/**
 * A PowerShell Command listing feature. Implements a treeview control.
 */
class GetCommandsFeature extends languageClientConsumer_1.LanguageClientConsumer {
    constructor(log) {
        super();
        this.log = log;
        this.command = vscode.commands.registerCommand("PowerShell.RefreshCommandsExplorer", () => this.CommandExplorerRefresh());
        this.commandsExplorerProvider = new CommandsExplorerProvider();
        this.commandsExplorerTreeView = vscode.window.createTreeView("PowerShellCommands", { treeDataProvider: this.commandsExplorerProvider });
        // Refresh the command explorer when the view is visible
        this.commandsExplorerTreeView.onDidChangeVisibility((e) => {
            if (e.visible) {
                this.CommandExplorerRefresh();
            }
        });
        vscode.commands.registerCommand("PowerShell.InsertCommand", (item) => this.InsertCommand(item));
    }
    dispose() {
        this.command.dispose();
    }
    setLanguageClient(languageclient) {
        this.languageClient = languageclient;
        if (this.commandsExplorerTreeView.visible) {
            vscode.commands.executeCommand("PowerShell.RefreshCommandsExplorer");
        }
    }
    CommandExplorerRefresh() {
        if (this.languageClient === undefined) {
            this.log.writeVerbose(`<${GetCommandsFeature.name}>: Unable to send getCommand request`);
            return;
        }
        this.languageClient.sendRequest(exports.GetCommandRequestType).then((result) => {
            const SidebarConfig = vscode.workspace.getConfiguration("powershell.sideBar");
            const excludeFilter = (SidebarConfig.CommandExplorerExcludeFilter).map((filter) => filter.toLowerCase());
            result = result.filter((command) => (excludeFilter.indexOf(command.moduleName.toLowerCase()) === -1));
            this.commandsExplorerProvider.powerShellCommands = result.map(toCommand);
            this.commandsExplorerProvider.refresh();
        });
    }
    InsertCommand(item) {
        const editor = vscode.window.activeTextEditor;
        const sls = editor.selection.start;
        const sle = editor.selection.end;
        const range = new vscode.Range(sls.line, sls.character, sle.line, sle.character);
        editor.edit((editBuilder) => {
            editBuilder.replace(range, item.Name);
        });
    }
}
exports.GetCommandsFeature = GetCommandsFeature;
class CommandsExplorerProvider {
    constructor() {
        this.didChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this.didChangeTreeData.event;
    }
    refresh() {
        this.didChangeTreeData.fire(undefined);
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        return Promise.resolve(this.powerShellCommands || []);
    }
}
function toCommand(command) {
    return new Command(command.name, command.moduleName, command.defaultParameterSet, command.parameterSets, command.parameters);
}
class Command extends vscode.TreeItem {
    constructor(Name, ModuleName, defaultParameterSet, ParameterSets, Parameters, collapsibleState = vscode.TreeItemCollapsibleState.None) {
        super(Name, collapsibleState);
        this.Name = Name;
        this.ModuleName = ModuleName;
        this.defaultParameterSet = defaultParameterSet;
        this.ParameterSets = ParameterSets;
        this.Parameters = Parameters;
        this.collapsibleState = collapsibleState;
    }
    getTreeItem() {
        return {
            label: this.label,
            collapsibleState: this.collapsibleState,
        };
    }
    getChildren(element) {
        return __awaiter(this, void 0, void 0, function* () {
            return [];
            // Returning an empty array because we need to return something.
        });
    }
}
//# sourceMappingURL=GetCommands.js.map