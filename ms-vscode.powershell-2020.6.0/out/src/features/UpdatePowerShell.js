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
exports.InvokePowerShellUpdateCheck = exports.GitHubReleaseInformation = void 0;
const child_process_1 = require("child_process");
const fs = require("fs");
const node_fetch_1 = require("node-fetch");
const os = require("os");
const path = require("path");
const semver = require("semver");
const stream = require("stream");
const util = require("util");
const vscode_1 = require("vscode");
const Settings = require("../settings");
const utils_1 = require("../utils");
const Console_1 = require("./Console");
const streamPipeline = util.promisify(stream.pipeline);
const PowerShellGitHubReleasesUrl = "https://api.github.com/repos/PowerShell/PowerShell/releases/latest";
const PowerShellGitHubPrereleasesUrl = "https://api.github.com/repos/PowerShell/PowerShell/releases";
class GitHubReleaseInformation {
    constructor(version, assets = []) {
        this.isPreview = false;
        this.version = semver.parse(version);
        if (semver.prerelease(this.version)) {
            this.isPreview = true;
        }
        this.assets = assets;
    }
    static FetchLatestRelease(preview) {
        return __awaiter(this, void 0, void 0, function* () {
            const requestConfig = {};
            // For CI. This prevents GitHub from rate limiting us.
            if (process.env.PS_TEST_GITHUB_API_USERNAME && process.env.PS_TEST_GITHUB_API_PAT) {
                const authHeaderValue = Buffer
                    .from(`${process.env.PS_TEST_GITHUB_API_USERNAME}:${process.env.PS_TEST_GITHUB_API_PAT}`)
                    .toString("base64");
                requestConfig.headers = {
                    Authorization: `Basic ${authHeaderValue}`,
                };
            }
            // Fetch the latest PowerShell releases from GitHub.
            const response = yield node_fetch_1.default(preview ? PowerShellGitHubPrereleasesUrl : PowerShellGitHubReleasesUrl, requestConfig);
            if (!response.ok) {
                const json = yield response.json();
                throw new Error(json.message || json || "response was not ok.");
            }
            // For preview, we grab all the releases and then grab the first prerelease.
            const releaseJson = preview
                ? (yield response.json()).find((release) => release.prerelease)
                : yield response.json();
            return new GitHubReleaseInformation(releaseJson.tag_name, releaseJson.assets);
        });
    }
}
exports.GitHubReleaseInformation = GitHubReleaseInformation;
function InvokePowerShellUpdateCheck(sessionManager, languageServerClient, localVersion, arch, release) {
    return __awaiter(this, void 0, void 0, function* () {
        const options = [
            {
                id: 0,
                title: "Yes",
            },
            {
                id: 1,
                title: "Not now",
            },
            {
                id: 2,
                title: "Do not show this notification again",
            },
        ];
        // If our local version is up-to-date, we can return early.
        if (semver.compare(localVersion, release.version) >= 0) {
            return;
        }
        const commonText = `You have an old version of PowerShell (${localVersion.raw}). The current latest release is ${release.version.raw}.`;
        if (process.platform === "linux") {
            yield vscode_1.window.showInformationMessage(`${commonText} We recommend updating to the latest version.`);
            return;
        }
        const result = yield vscode_1.window.showInformationMessage(`${commonText} Would you like to update the version? ${utils_1.isMacOS ? "(Homebrew is required on macOS)"
            : "(This will close ALL pwsh terminals running in this Visual Studio Code session)"}`, ...options);
        // If the user cancels the notification.
        if (!result) {
            return;
        }
        // Yes choice.
        switch (result.id) {
            // Yes choice.
            case 0:
                if (utils_1.isWindows) {
                    const msiMatcher = arch === "x86" ?
                        "win-x86.msi" : "win-x64.msi";
                    const asset = release.assets.filter((a) => a.name.indexOf(msiMatcher) >= 0)[0];
                    const msiDownloadPath = path.join(os.tmpdir(), asset.name);
                    const res = yield node_fetch_1.default(asset.browser_download_url);
                    if (!res.ok) {
                        throw new Error("unable to fetch MSI");
                    }
                    yield vscode_1.window.withProgress({
                        title: "Downloading PowerShell Installer...",
                        location: vscode_1.ProgressLocation.Notification,
                        cancellable: false,
                    }, () => __awaiter(this, void 0, void 0, function* () {
                        // Streams the body of the request to a file.
                        yield streamPipeline(res.body, fs.createWriteStream(msiDownloadPath));
                    }));
                    // Stop the Integrated Console session because Windows likes to hold on to files.
                    sessionManager.stop();
                    // Close all terminals with the name "pwsh" in the current VS Code session.
                    // This will encourage folks to not close the instance of VS Code that spawned
                    // the MSI process.
                    for (const terminal of vscode_1.window.terminals) {
                        if (terminal.name === "pwsh") {
                            terminal.dispose();
                        }
                    }
                    // Invoke the MSI via cmd.
                    const msi = child_process_1.spawn("msiexec", ["/i", msiDownloadPath]);
                    msi.on("close", (code) => {
                        // Now that the MSI is finished, start the Integrated Console session.
                        sessionManager.start();
                        fs.unlinkSync(msiDownloadPath);
                    });
                }
                else if (utils_1.isMacOS) {
                    const script = release.isPreview
                        ? "brew cask upgrade powershell-preview"
                        : "brew cask upgrade powershell";
                    yield languageServerClient.sendRequest(Console_1.EvaluateRequestType, {
                        expression: script,
                    });
                }
                break;
            // Never choice.
            case 2:
                yield Settings.change("promptToUpdatePowerShell", false, true);
                break;
            default:
                break;
        }
    });
}
exports.InvokePowerShellUpdateCheck = InvokePowerShellUpdateCheck;
//# sourceMappingURL=UpdatePowerShell.js.map