const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Main = imports.ui.main;

const HarddiskIndicator = Me.imports.harddiskIndicator.HarddiskIndicator;

class Extension {
  constructor(uuid) {
    this._uuid = uuid;
    ExtensionUtils.initTranslations();
  }

  enable() {
    this._harddisk_indicator = new HarddiskIndicator();
    Main.panel.addToStatusArea(this._uuid, this._harddisk_indicator);
  }

  disable() {
    this._harddisk_indicator.destroy();
    this._harddisk_indicator = null;
  }
}

function init(meta) {
  return new Extension(meta.uuid);
}
