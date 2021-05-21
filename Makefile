UUID = spindown-harddisk@johannes.bittner.gmail.com
VERSION = $(shell git rev-parse HEAD)
ZIP_FILES = schemas ui *.js *.json *.css LICENSE

all: gschemas.compiled

gschemas.compiled:
	glib-compile-schemas schemas

zip:
	zip -qr "$(UUID)-$(VERSION).zip" $(ZIP_FILES)

clean:
	rm schemas/gschemas.compiled
