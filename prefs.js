const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

function init() {
}

function buildPrefsWidget() {
    ExtensionUtils.initTranslations();
    const settings = ExtensionUtils.getSettings(Me.metadata['settings-schema']);

    const uiFilePath = `${Me.path}/ui/prefs.ui`;
    const builder = new Gtk.Builder();
    if (builder.add_from_file(uiFilePath) === 0) {
        throw new Error(`Could not load ${uiFilePath}, please report a bug.`);
    }

    const mountPointEntry = builder.get_object('mount-point');
    settings.bind(
        'mount-point',
        mountPointEntry,
        'text',
        Gio.SettingsBindFlags.DEFAULT
    );

    const mainContainer = builder.get_object('main-container');
    return mainContainer;
}