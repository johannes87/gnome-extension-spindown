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
    this.settings = ExtensionUtils.getSettings(Me.metadata['settings-schema']);

    let prefsWidget = new Gtk.Grid();

    let title = new Gtk.Label({
        label: `<b>${Me.metadata.name} Preferences</b>`,
        halign: Gtk.Align.START,
        use_markup: true,
        visible: true
    });
    prefsWidget.attach(title, 1, 1, 1, 1);

    let labelMountPoint = new Gtk.Label({
        label: `Mount point`
    });
    prefsWidget.attach(labelMountPoint, 1, 2, 1, 1);

    let entryMountPoint = new Gtk.Entry();
    entryMountPoint.set_placeholder_text(_('e.g. /mnt/Data'));
    prefsWidget.attach(entryMountPoint, 2, 2, 1, 1);

    this.settings.bind(
        'mount-point',
        entryMountPoint,
        'text',
        Gio.SettingsBindFlags.DEFAULT
    );

    return prefsWidget;
}