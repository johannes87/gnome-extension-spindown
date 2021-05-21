const GObject = imports.gi.GObject;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

var HarddiskIndicator = GObject.registerClass(class HarddiskIndicator extends PanelMenu.Button {
  _init() {
    super._init(St.Align.START);

    this._settings = ExtensionUtils.getSettings(Me.metadata['settings-schema']);

    this._indicatorIcon = new St.Icon({
      icon_name: 'drive-harddisk',
      style_class: 'system-status-icon',
    });
    this.add_child(this._indicatorIcon);

    this._mountPoint = this._settings.get_string('mount-point');
    this._changedMountPointSignal = this._settings.connect('changed::mount-point', () => {
      this._mountPoint = this._settings.get_string('mount-point');
      this._updateUI();
    });

    this._updateUI();
  }

  destroy() {
    super.destroy();
    this._settings.disconnect(this._changedMountPointSignal);
  }

  _updateUI() {
    this.menu.removeAll();

    if (this._mountPoint.trim() === '') {
      const itemSetup = new PopupMenu.PopupMenuItem(_('Initial setup...'));
      itemSetup.connect('activate', () => { Util.spawn(['gnome-extensions', 'prefs', Me.metadata.uuid]) });
      this.menu.addMenuItem(itemSetup);
      return;
    }

    const isMounted = this._findDeviceFile(this._mountPoint);
    if (isMounted) {
      const itemSpindown = new PopupMenu.PopupMenuItem(_(`Spin down ${this._mountPoint}`));
      itemSpindown.connect('activate', () => { this._spindownDisk(); });
      this.menu.addMenuItem(itemSpindown);
      this._indicatorIcon.set_opacity(255);
    } else {
      const itemMount = new PopupMenu.PopupMenuItem(_(`Mount ${this._mountPoint}`));
      itemMount.connect('activate', () => { this._mountDisk(); });
      this.menu.addMenuItem(itemMount);
      this._indicatorIcon.set_opacity(80);
    }
  }

  async _spindownDisk() {
    const deviceFilePath = this._findDeviceFile(this._mountPoint);
    if (!deviceFilePath) {
      Main.notify(_(`Mount point ${this._mountPoint} not found`));
      return;
    }

    try {
      await this._shellExec(`fuser -k -M -m ${this._mountPoint} 2>/dev/null`);
    } catch (stderr) {
      log('No processes were killed');
    }

    const unmountSpindown = `
      umount ${deviceFilePath} \
      && sync \
      && sleep 1 \
      && smartctl -s standby,now ${deviceFilePath}`;

    try {
      await this._shellExec(unmountSpindown, true);
    } catch (stderr) {
      log(`unmount-and-spindown failed: ${stderr}`);
    }

    this._updateUI();
  }

  async _mountDisk() {
    await this._shellExec(`mount ${this._mountPoint}`, true);
    this._updateUI();
  }

  _findDeviceFile(mountPoint) {
    const mounts = ByteArray.toString(GLib.file_get_contents('/proc/mounts')[1]);
    const mountpointLines = mounts
        .split('\n')
        .filter((line) => new RegExp(`${mountPoint}`).test(line));

    if (mountpointLines.length != 1) {
      return null;
    }

    // first word in the found mounts line is the device file
    return mountpointLines[0].split(' ')[0];
  }

  _shellExec(shellCode, privileged=false) {
    return new Promise((resolve, reject) => {
      const args = ['sh', '-c'];
      if (privileged) {
        args.unshift('pkexec');
      }
      args.push(shellCode);

      const argsString = args.map((arg) => `'${arg}'`).join(' ');
      log(`Executing ${privileged ? '(privileged)' : ''} ${argsString}`);

      try {
        const proc = Gio.Subprocess.new(
            args,
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);

        proc.communicate_utf8_async(null, null, (proc, res) => {
          try {
            const [, stdout, stderr] = proc.communicate_utf8_finish(res);

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
});