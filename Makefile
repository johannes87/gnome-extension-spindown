all: gschemas.compiled

gschemas.compiled:
	glib-compile-schemas schemas

clean:
	rm schemas/gschemas.compiled
