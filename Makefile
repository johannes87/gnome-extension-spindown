UUID = spindown-harddisk@johannes.bittner.gmail.com
VERSION = $(shell git rev-parse HEAD)
ZIP_FILES = schemas ui *.js *.json *.css LICENSE README.md

all: gschemas.compiled

gschemas.compiled:
	glib-compile-schemas schemas

zip: gschemas.compiled
	zip -qr "$(UUID)-$(VERSION).zip" $(ZIP_FILES)

clean:
	rm schemas/gschemas.compiled *.zip
