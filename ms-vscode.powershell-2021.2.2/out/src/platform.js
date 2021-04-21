"use strict";
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWindowsSystemPowerShellPath = exports.PowerShellExeFinder = exports.getPlatformDetails = exports.OperatingSystem = void 0;
const fs = require("fs");
const os = require("os");
const path = require("path");
const process = require("process");
const WindowsPowerShell64BitLabel = "Windows PowerShell (x64)";
const WindowsPowerShell32BitLabel = "Windows PowerShell (x86)";
const LinuxExePath = "/usr/bin/pwsh";
const LinuxPreviewExePath = "/usr/bin/pwsh-preview";
const SnapExePath = "/snap/bin/pwsh";
const SnapPreviewExePath = "/snap/bin/pwsh-preview";
const MacOSExePath = "/usr/local/bin/pwsh";
const MacOSPreviewExePath = "/usr/local/bin/pwsh-preview";
var OperatingSystem;
(function (OperatingSystem) {
    OperatingSystem[OperatingSystem["Unknown"] = 0] = "Unknown";
    OperatingSystem[OperatingSystem["Windows"] = 1] = "Windows";
    OperatingSystem[OperatingSystem["MacOS"] = 2] = "MacOS";
    OperatingSystem[OperatingSystem["Linux"] = 3] = "Linux";
})(OperatingSystem = exports.OperatingSystem || (exports.OperatingSystem = {}));
function getPlatformDetails() {
    let operatingSystem = OperatingSystem.Unknown;
    if (process.platform === "win32") {
        operatingSystem = OperatingSystem.Windows;
    }
    else if (process.platform === "darwin") {
        operatingSystem = OperatingSystem.MacOS;
    }
    else if (process.platform === "linux") {
        operatingSystem = OperatingSystem.Linux;
    }
    const isProcess64Bit = process.arch === "x64";
    return {
        operatingSystem,
        isOS64Bit: isProcess64Bit || process.env.hasOwnProperty("PROCESSOR_ARCHITEW6432"),
        isProcess64Bit,
    };
}
exports.getPlatformDetails = getPlatformDetails;
/**
 * Class to lazily find installed PowerShell executables on a machine.
 * When given a list of additional PowerShell executables,
 * this will also surface those at the end of the list.
 */
class PowerShellExeFinder {
    /**
     * Create a new PowerShellFinder object to discover PowerShell installations.
     * @param platformDetails Information about the machine we are running on.
     * @param additionalPowerShellExes Additional PowerShell installations as configured in the settings.
     */
    constructor(platformDetails, additionalPowerShellExes) {
        this.platformDetails = platformDetails || getPlatformDetails();
        this.additionalPSExeSettings = additionalPowerShellExes || [];
    }
    /**
     * Returns the first available PowerShell executable found in the search order.
     */
    getFirstAvailablePowerShellInstallation() {
        for (const pwsh of this.enumeratePowerShellInstallations()) {
            return pwsh;
        }
    }
    /**
     * Get an array of all PowerShell executables found when searching for PowerShell installations.
     */
    getAllAvailablePowerShellInstallations() {
        return Array.from(this.enumeratePowerShellInstallations());
    }
    /**
     * Fixes PowerShell paths when Windows PowerShell is set to the non-native bitness.
     * @param configuredPowerShellPath the PowerShell path configured by the user.
     */
    fixWindowsPowerShellPath(configuredPowerShellPath) {
        const altWinPS = this.findWinPS({ useAlternateBitness: true });
        if (!altWinPS) {
            return configuredPowerShellPath;
        }
        const lowerAltWinPSPath = altWinPS.exePath.toLocaleLowerCase();
        const lowerConfiguredPath = configuredPowerShellPath.toLocaleLowerCase();
        if (lowerConfiguredPath === lowerAltWinPSPath) {
            return this.findWinPS().exePath;
        }
        return configuredPowerShellPath;
    }
    /**
     * Iterates through PowerShell installations on the machine according
     * to configuration passed in through the constructor.
     * PowerShell items returned by this object are verified
     * to exist on the filesystem.
     */
    *enumeratePowerShellInstallations() {
        // Get the default PowerShell installations first
        for (const defaultPwsh of this.enumerateDefaultPowerShellInstallations()) {
            if (defaultPwsh && defaultPwsh.exists()) {
                yield defaultPwsh;
            }
        }
        // Also show any additionally configured PowerShells
        // These may be duplicates of the default installations, but given a different name.
        for (const additionalPwsh of this.enumerateAdditionalPowerShellInstallations()) {
            if (additionalPwsh && additionalPwsh.exists()) {
                yield additionalPwsh;
            }
        }
    }
    /**
     * Iterates through all the possible well-known PowerShell installations on a machine.
     * Returned values may not exist, but come with an .exists property
     * which will check whether the executable exists.
     */
    *enumerateDefaultPowerShellInstallations() {
        // Find PSCore stable first
        yield this.findPSCoreStable();
        switch (this.platformDetails.operatingSystem) {
            case OperatingSystem.Linux:
                // On Linux, find the snap
                yield this.findPSCoreStableSnap();
                break;
            case OperatingSystem.Windows:
                // Windows may have a 32-bit pwsh.exe
                yield this.findPSCoreWindowsInstallation({ useAlternateBitness: true });
                // Also look for the MSIX/UWP installation
                yield this.findPSCoreMsix();
                break;
        }
        // Look for the .NET global tool
        // Some older versions of PowerShell have a bug in this where startup will fail,
        // but this is fixed in newer versions
        yield this.findPSCoreDotnetGlobalTool();
        // Look for PSCore preview
        yield this.findPSCorePreview();
        switch (this.platformDetails.operatingSystem) {
            // On Linux, there might be a preview snap
            case OperatingSystem.Linux:
                yield this.findPSCorePreviewSnap();
                break;
            case OperatingSystem.Windows:
                // Find a preview MSIX
                yield this.findPSCoreMsix({ findPreview: true });
                // Look for pwsh-preview with the opposite bitness
                yield this.findPSCoreWindowsInstallation({ useAlternateBitness: true, findPreview: true });
                // Finally, get Windows PowerShell
                // Get the natural Windows PowerShell for the process bitness
                yield this.findWinPS();
                // Get the alternate bitness Windows PowerShell
                yield this.findWinPS({ useAlternateBitness: true });
                break;
        }
    }
    /**
     * Iterates through the configured additonal PowerShell executable locations,
     * without checking for their existence.
     */
    *enumerateAdditionalPowerShellInstallations() {
        for (const additionalPwshSetting of this.additionalPSExeSettings) {
            yield new PossiblePowerShellExe(additionalPwshSetting.exePath, additionalPwshSetting.versionName);
        }
    }
    findPSCoreStable() {
        switch (this.platformDetails.operatingSystem) {
            case OperatingSystem.Linux:
                return new PossiblePowerShellExe(LinuxExePath, "PowerShell");
            case OperatingSystem.MacOS:
                return new PossiblePowerShellExe(MacOSExePath, "PowerShell");
            case OperatingSystem.Windows:
                return this.findPSCoreWindowsInstallation();
        }
    }
    findPSCorePreview() {
        switch (this.platformDetails.operatingSystem) {
            case OperatingSystem.Linux:
                return new PossiblePowerShellExe(LinuxPreviewExePath, "PowerShell Preview");
            case OperatingSystem.MacOS:
                return new PossiblePowerShellExe(MacOSPreviewExePath, "PowerShell Preview");
            case OperatingSystem.Windows:
                return this.findPSCoreWindowsInstallation({ findPreview: true });
        }
    }
    findPSCoreDotnetGlobalTool() {
        const exeName = this.platformDetails.operatingSystem === OperatingSystem.Windows
            ? "pwsh.exe"
            : "pwsh";
        const dotnetGlobalToolExePath = path.join(os.homedir(), ".dotnet", "tools", exeName);
        return new PossiblePowerShellExe(dotnetGlobalToolExePath, ".NET Core PowerShell Global Tool");
    }
    findPSCoreMsix({ findPreview } = {}) {
        // We can't proceed if there's no LOCALAPPDATA path
        if (!process.env.LOCALAPPDATA) {
            return null;
        }
        // Find the base directory for MSIX application exe shortcuts
        const msixAppDir = path.join(process.env.LOCALAPPDATA, "Microsoft", "WindowsApps");
        if (!fileExistsSync(msixAppDir)) {
            return null;
        }
        // Define whether we're looking for the preview or the stable
        const { pwshMsixDirRegex, pwshMsixName } = findPreview
            ? { pwshMsixDirRegex: PowerShellExeFinder.PwshPreviewMsixRegex, pwshMsixName: "PowerShell Preview (Store)" }
            : { pwshMsixDirRegex: PowerShellExeFinder.PwshMsixRegex, pwshMsixName: "PowerShell (Store)" };
        // We should find only one such application, so return on the first one
        for (const subdir of fs.readdirSync(msixAppDir)) {
            if (pwshMsixDirRegex.test(subdir)) {
                const pwshMsixPath = path.join(msixAppDir, subdir, "pwsh.exe");
                return new PossiblePowerShellExe(pwshMsixPath, pwshMsixName);
            }
        }
        // If we find nothing, return null
        return null;
    }
    findPSCoreStableSnap() {
        return new PossiblePowerShellExe(SnapExePath, "PowerShell Snap");
    }
    findPSCorePreviewSnap() {
        return new PossiblePowerShellExe(SnapPreviewExePath, "PowerShell Preview Snap");
    }
    findPSCoreWindowsInstallation({ useAlternateBitness = false, findPreview = false } = {}) {
        const programFilesPath = this.getProgramFilesPath({ useAlternateBitness });
        if (!programFilesPath) {
            return null;
        }
        const powerShellInstallBaseDir = path.join(programFilesPath, "PowerShell");
        // Ensure the base directory exists
        try {
            const powerShellInstallBaseDirLStat = fs.lstatSync(powerShellInstallBaseDir);
            if (!powerShellInstallBaseDirLStat.isDirectory()) {
                return null;
            }
        }
        catch (_a) {
            return null;
        }
        let highestSeenVersion = -1;
        let pwshExePath = null;
        for (const item of fs.readdirSync(powerShellInstallBaseDir)) {
            let currentVersion = -1;
            if (findPreview) {
                // We are looking for something like "7-preview"
                // Preview dirs all have dashes in them
                const dashIndex = item.indexOf("-");
                if (dashIndex < 0) {
                    continue;
                }
                // Verify that the part before the dash is an integer
                const intPart = item.substring(0, dashIndex);
                if (!PowerShellExeFinder.IntRegex.test(intPart)) {
                    continue;
                }
                // Verify that the part after the dash is "preview"
                if (item.substring(dashIndex + 1) !== "preview") {
                    continue;
                }
                currentVersion = parseInt(intPart, 10);
            }
            else {
                // Search for a directory like "6" or "7"
                if (!PowerShellExeFinder.IntRegex.test(item)) {
                    continue;
                }
                currentVersion = parseInt(item, 10);
            }
            // Ensure we haven't already seen a higher version
            if (currentVersion <= highestSeenVersion) {
                continue;
            }
            // Now look for the file
            const exePath = path.join(powerShellInstallBaseDir, item, "pwsh.exe");
            if (!fs.existsSync(exePath)) {
                continue;
            }
            pwshExePath = exePath;
            highestSeenVersion = currentVersion;
        }
        if (!pwshExePath) {
            return null;
        }
        const bitness = programFilesPath.includes("x86")
            ? "(x86)"
            : "(x64)";
        const preview = findPreview ? " Preview" : "";
        return new PossiblePowerShellExe(pwshExePath, `PowerShell${preview} ${bitness}`);
    }
    findWinPS({ useAlternateBitness = false } = {}) {
        // 32-bit OSes only have one WinPS on them
        if (!this.platformDetails.isOS64Bit && useAlternateBitness) {
            return null;
        }
        let winPS = useAlternateBitness ? this.alternateBitnessWinPS : this.winPS;
        if (winPS === undefined) {
            const systemFolderPath = this.getSystem32Path({ useAlternateBitness });
            const winPSPath = path.join(systemFolderPath, "WindowsPowerShell", "v1.0", "powershell.exe");
            let displayName;
            if (this.platformDetails.isProcess64Bit) {
                displayName = useAlternateBitness
                    ? WindowsPowerShell32BitLabel
                    : WindowsPowerShell64BitLabel;
            }
            else if (this.platformDetails.isOS64Bit) {
                displayName = useAlternateBitness
                    ? WindowsPowerShell64BitLabel
                    : WindowsPowerShell32BitLabel;
            }
            else {
                displayName = WindowsPowerShell32BitLabel;
            }
            winPS = new PossiblePowerShellExe(winPSPath, displayName, { knownToExist: true });
            if (useAlternateBitness) {
                this.alternateBitnessWinPS = winPS;
            }
            else {
                this.winPS = winPS;
            }
        }
        return winPS;
    }
    getProgramFilesPath({ useAlternateBitness = false } = {}) {
        if (!useAlternateBitness) {
            // Just use the native system bitness
            return process.env.ProgramFiles;
        }
        // We might be a 64-bit process looking for 32-bit program files
        if (this.platformDetails.isProcess64Bit) {
            return process.env["ProgramFiles(x86)"];
        }
        // We might be a 32-bit process looking for 64-bit program files
        if (this.platformDetails.isOS64Bit) {
            return process.env.ProgramW6432;
        }
        // We're a 32-bit process on 32-bit Windows, there is no other Program Files dir
        return null;
    }
    getSystem32Path({ useAlternateBitness = false } = {}) {
        const windir = process.env.windir;
        if (!useAlternateBitness) {
            // Just use the native system bitness
            return path.join(windir, "System32");
        }
        // We might be a 64-bit process looking for 32-bit system32
        if (this.platformDetails.isProcess64Bit) {
            return path.join(windir, "SysWOW64");
        }
        // We might be a 32-bit process looking for 64-bit system32
        if (this.platformDetails.isOS64Bit) {
            return path.join(windir, "Sysnative");
        }
        // We're on a 32-bit Windows, so no alternate bitness
        return null;
    }
}
exports.PowerShellExeFinder = PowerShellExeFinder;
// This is required, since parseInt("7-preview") will return 7.
PowerShellExeFinder.IntRegex = /^\d+$/;
PowerShellExeFinder.PwshMsixRegex = /^Microsoft.PowerShell_.*/;
PowerShellExeFinder.PwshPreviewMsixRegex = /^Microsoft.PowerShellPreview_.*/;
function getWindowsSystemPowerShellPath(systemFolderName) {
    return path.join(process.env.windir, systemFolderName, "WindowsPowerShell", "v1.0", "powershell.exe");
}
exports.getWindowsSystemPowerShellPath = getWindowsSystemPowerShellPath;
function fileExistsSync(filePath) {
    try {
        // This will throw if the path does not exist,
        // and otherwise returns a value that we don't care about
        fs.lstatSync(filePath);
        return true;
    }
    catch (_a) {
        return false;
    }
}
class PossiblePowerShellExe {
    constructor(pathToExe, installationName, { knownToExist = false } = {}) {
        this.exePath = pathToExe;
        this.displayName = installationName;
        this.knownToExist = knownToExist || undefined;
    }
    exists() {
        if (this.knownToExist === undefined) {
            this.knownToExist = fileExistsSync(this.exePath);
        }
        return this.knownToExist;
    }
}
//# sourceMappingURL=platform.js.map