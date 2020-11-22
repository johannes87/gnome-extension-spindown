/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* exported init */

const GETTEXT_DOMAIN = 'my-indicator-extension';

const { GObject, St } = imports.gi;

const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, _('Spin down hard disk'));

        this.add_child(new St.Icon({
            icon_name: 'drive-harddisk',
            style_class: 'system-status-icon',
        }));

        this.updateMenu(); 
    }

    updateMenu() {
        const mountPoint = "/mnt/Data";

        this.menu.removeAll();
        if (findDeviceFile(mountPoint)) {
            this.itemSpindown = new PopupMenu.PopupMenuItem(_(`Spin down ${mountPoint}`));
            this.itemSpindown.connect('activate', () => { 
                spindownDisk(mountPoint);
            });
            this.menu.addMenuItem(this.itemSpindown);
        } else {
            this.itemMount = new PopupMenu.PopupMenuItem(_(`Mount ${mountPoint}`));
            this.itemMount.connect('activate', () => { 
                mountDisk(mountPoint);
            });
            this.menu.addMenuItem(this.itemMount);
        }
    }
});

class Extension {
    constructor(uuid) {
        this._uuid = uuid;
        ExtensionUtils.initTranslations(GETTEXT_DOMAIN);
    }

    enable() {
        this._indicator = new Indicator();
        Main.panel.addToStatusArea(this._uuid, this._indicator);
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }

    updateIndicatorMenu() {
        this._indicator.updateMenu();
    }
}

let extension = null;

function init(meta) {
    extension = new Extension(meta.uuid);
    return extension;
}

function findDeviceFile(mountPoint) {
    const mounts = new String(Gio.File.new_for_path("/proc/mounts").load_contents(null));
    const mountpointLines = mounts.split("\n").filter(line => new RegExp(`${mountPoint}`).test(line));

    if (mountpointLines.length != 1) {
        return null;
    }

    // first word in the found mounts line is the device file
    return mountpointLines[0].split(" ")[0];
}

async function spindownDisk(mountPoint) {
    const deviceFilePath = findDeviceFile(mountPoint);
    if (!deviceFilePath) {
        Main.notify(_(`Mount point ${mountPoint} not found`));
        return;
    }

    // send SIGKILL to all processes using the mount point
    await exec(['sh', '-c', `fuser -k -M -m ${mountPoint} 2>/dev/null`]);
    await exec(
        ['sh', '-c', `umount ${deviceFilePath} && sync && sleep 1 && smartctl -s standby,now ${deviceFilePath}`],
        privileged=true)

    extension.updateIndicatorMenu();
}

async function mountDisk(mountPoint) {
    await exec(["mount", mountPoint], privileged=true);
    extension.updateIndicatorMenu();
}


function exec(args, privileged=false) {
    return new Promise((resolve, reject) => {
        try {
            log(`Executing ${privileged ? '(privileged)' : ''} ${args.join(',')}`);

            if (privileged) {
                args = ['pkexec'].concat(args);
            }
            let proc = Gio.Subprocess.new(
                args,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
    
            proc.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    let [, stdout, stderr] = proc.communicate_utf8_finish(res);
    
                    if (!proc.get_successful()) {
                        logError(`Non-Successful return code. Stderr: ${stderr}`);
                        reject(stderr);
                    }
    
                    resolve(stdout);
                } catch (e) {
                    logError(e);
                    reject(e);
                }
            });
        } catch (e) {
            logError(e);
            reject(e);
        }
    });
}   