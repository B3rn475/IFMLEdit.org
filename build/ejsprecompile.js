/*jslint node: true, nomen: true */
"use strict";
var path = require('path'),
    through2 = require('through2'),
    ejs = require('ejs');

function toExtensions(extensions) {
    if (Array.isArray(extensions)) {
        return extensions;
    }
    if (typeof extensions === 'string') {
        return [extensions];
    }
    throw new Error('Invalid ejs extensions');
}

function ejsprecompile(file, options) {
    options = options || {};

    var extensions = toExtensions(options.extensions || '.ejs'),
        chunks = [];

    if (extensions.indexOf(path.extname(file)) === -1) {
        return through2();
    }

    return through2(function (chunk, enc, cb) {
        chunks.push(chunk);
        return cb();
    }, function (cb) {
        var compiled = ejs.compile(chunks.join(), {
            filename: file,
            client: true,
            compileDebug: options.compileDebug,
        });

        this.push('module.exports = (' + compiled + ')');
        return cb();
    });
}

module.exports = ejsprecompile;
