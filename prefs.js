const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();


const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;


const SpindownPrefsWidget = new GObject.registerClass(class SpindownPrefsWidget extends Gtk.Grid {
    _init() {
        super._init();

        this.margin = this.row_spacing = this.column_spacing = 20;

        // TODO: put .xml schemas file in /schemas directory
        this._settings = ExtensionUtils.getSettings();

        this.attach(new Gtk.Label({ label: _('Hello')}, 0, 0, 1, 1));
        this.attach(new Gtk.Label({ label: _('World')}, 1, 0, 1, 1));
    }
});


function init() {
    ExtensionUtils.initTranslations();
    log("\n\n\n\n\n================\nhello prefs init");
    log(`extensionUtils == ${ExtensionUtils}\n===========================\n\n\n\n\n`);

}

function buildPrefsWidget() {
    let w = new SpindownPrefsWidget();
    w.show_all();
    return w;
}