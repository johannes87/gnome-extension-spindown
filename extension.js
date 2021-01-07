/* extension.js
 *
 * License: MIT
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
const GLib = imports.gi.GLib;

const ByteArray = imports.byteArray;

const HarddiskIndicator = GObject.registerClass(
class HarddiskIndicator extends PanelMenu.Button {
    _init({mountPoint}) {
        super._init(0.0, _('Spindown Harddisk'));

        this.indicatorIcon = new St.Icon({
            icon_name: 'drive-harddisk',
            style_class: 'system-status-icon',
        });
        this.add_child(this.indicatorIcon);

        this.itemSpindown = new PopupMenu.PopupMenuItem(_(`Spin down ${mountPoint}`));
        this.itemSpindown.connect('activate', () => {
            this.spindownDisk(mountPoint);
        });
        this.menu.addMenuItem(this.itemSpindown);

        this.itemMount = new PopupMenu.PopupMenuItem(_(`Mount ${mountPoint}`));
        this.itemMount.connect('activate', () => {
            this.mountDisk(mountPoint);
        });
        this.menu.addMenuItem(this.itemMount);

        this.mountPoint = mountPoint;

        this.updateUI();
    }

    updateUI() {
        if (findDeviceFile(this.mountPoint)) {
            this.itemSpindown.show();
            this.itemMount.hide();
            this.indicatorIcon.set_opacity(255);
        } else {
            this.itemMount.show();
            this.itemSpindown.hide();
            this.indicatorIcon.set_opacity(80);
        }
    }

    // TODO: use /dev/sda instead of /mnt/Data as input; this is what the user can configure (together with mountpoint)
    async spindownDisk(mountPoint) {
        const deviceFilePath = findDeviceFile(mountPoint);
        if (!deviceFilePath) {
            Main.notify(_(`Mount point ${mountPoint} not found`));
            return;
        }

        try {
            await exec(`fuser -k -M -m ${mountPoint} 2>/dev/null`);
        } catch(stderr) {
            log("No processes were killed");
        }

        const unmount_spindown = `umount ${deviceFilePath} && sync && sleep 1 && smartctl -s standby,now ${deviceFilePath}`;

        try {
            await exec(unmount_spindown, true);
        } catch(stderr) {
            log(`unmount-and-spindown failed: ${stderr}`);
        }

        this.updateUI();
    }

    async mountDisk(mountPoint) {
        await exec(`mount ${mountPoint}`, true);
        this.updateUI();
    }
});


function findDeviceFile(mountPoint) {
    const mounts = ByteArray.toString(GLib.file_get_contents("/proc/mounts")[1]);
    const mountpointLines = mounts.split("\n").filter(line => new RegExp(`${mountPoint}`).test(line));

    if (mountpointLines.length != 1) {
        return null;
    }

    // first word in the found mounts line is the device file
    return mountpointLines[0].split(" ")[0];
}



function exec(shell_code, privileged=false) {
    return new Promise((resolve, reject) => {
        let args = ['sh', '-c'];
        if (privileged) {
            args.unshift('pkexec');
        }
        args.push(shell_code);

        const args_string = args.map(arg => `'${arg}'`).join(' ');
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

class Extension {
    constructor(uuid) {
        this._uuid = uuid;
        ExtensionUtils.initTranslations();
    }

    enable() {
        this._indicator = new HarddiskIndicator({mountPoint: "/mnt/Data"});
        Main.panel.addToStatusArea(this._uuid, this._indicator);
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}

function init(meta) {
    extension = new Extension(meta.uuid);
    return extension;
}
