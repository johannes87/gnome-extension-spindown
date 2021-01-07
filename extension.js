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


const { GObject, St } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Gio = imports.gi.Gio;

// TODO: fix warning, use ByteArray
// const ByteArray = imports.byteArray;

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, _('Spindown Harddisk'));

        this.indicatorIcon = new St.Icon({
            icon_name: 'drive-harddisk',
            style_class: 'system-status-icon',
        });
        this.add_child(this.indicatorIcon);

        this.itemSpindown = new PopupMenu.PopupMenuItem(_(`Spin down ${extension.mountPoint}`));
        this.itemSpindown.connect('activate', () => {
            spindownDisk(extension.mountPoint);
        });
        this.menu.addMenuItem(this.itemSpindown);

        this.itemMount = new PopupMenu.PopupMenuItem(_(`Mount ${extension.mountPoint}`));
        this.itemMount.connect('activate', () => {
            mountDisk(extension.mountPoint);
        });
        this.menu.addMenuItem(this.itemMount);

        this.updateUI();
    }

    updateUI() {
        if (findDeviceFile(extension.mountPoint)) {
            this.itemSpindown.show();
            this.itemMount.hide();
            this.indicatorIcon.set_opacity(255);
        } else {
            this.itemMount.show();
            this.itemSpindown.hide();
            this.indicatorIcon.set_opacity(80);
        }
    }
});

class Extension {
    constructor(uuid) {
        this._uuid = uuid;
        ExtensionUtils.initTranslations();
        this.mountPoint = "/mnt/Data";
    }

    enable() {
        this._indicator = new Indicator();
        Main.panel.addToStatusArea(this._uuid, this._indicator);
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }

    updateUI() {
        this._indicator.updateUI();
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

// TODO: use /dev/sda instead of /mnt/Data as input; this is what the user can configure (together with mountpoint)
async function spindownDisk(mountPoint) {
    const deviceFilePath = findDeviceFile(mountPoint);
    if (!deviceFilePath) {
        Main.notify(_(`Mount point ${mountPoint} not found`));
        return;
    }

    try {
        await exec(`fuser -k -M -m ${mountPoint} 2>/dev/null`);
    } catch(stderr) {
        log(`fuser kill failed: ${stderr || '(empty)'}`);
    }
    
    const unmount_spindown = `umount ${deviceFilePath} && sync && sleep 1 && smartctl -s standby,now ${deviceFilePath}`;

    try {
        await exec(unmount_spindown, privileged=true);
    } catch(stderr) {
        log(`unmount-and-spindown failed: ${stderr}`);
    }

    extension.updateUI();
}

async function mountDisk(mountPoint) {
    await exec(`mount ${mountPoint}`, privileged=true);
    extension.updateUI();
}


function exec(shell_code, privileged=false) {
    return new Promise((resolve, reject) => {
        let args = ['sh', '-c'];
        if (privileged) {
            args.unshift('pkexec');
        }
        args.push(shell_code);

        const args_string = args.map(arg => `"${arg}"`).join(' ');
        log(`Executing ${privileged ? '(privileged)' : ''} ${args_string}`);

        try {
            let proc = Gio.Subprocess.new(
                args,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);

            proc.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    let [, stdout, stderr] = proc.communicate_utf8_finish(res);

                    if (!proc.get_successful()) {
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
