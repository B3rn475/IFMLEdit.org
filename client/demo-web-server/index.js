// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true*/
/*globals self */
"use strict";

var createZip = require('jszip'),
    createNamespace = require('./datastore').Namespace,
    namespace = createNamespace(),
    requires = {
        fs: require('fs'),
        jade: require('jade'),
        express: require('express'),
        'body-parser': require('body-parser'),
        bluebird: require('bluebird'),
        nedb: namespace.nedb,
        url: require('url'),
        merge: require('merge')
    },
    head,
    tail;

function load(folder, file) {
    var module = { exports: {} };
    function r(module) {
        if (requires[module]) { return requires[module]; }
        module = module.substr(2);
        if (folder.file(module)) {
            requires[folder.root + module] = load(folder, module);
            return requires[folder.root + module];
        }
        if (folder.file(module + '.js')) {
            requires[folder.root + module] = load(folder, module + '.js');
            return requires[folder.root + module];
        }
        if (folder.file(module + '.json')) {
            requires[folder.root + module] = load(folder, module + '.json');
            return requires[folder.root + module];
        }
        if (folder.folder(module).file('index.js')) {
            requires[folder.root + module] = load(folder.folder(module), 'index.js');
            return requires[folder.root + module];
        }
    }
    if (file.substr(-3) === '.js') {
        /*jslint evil: true */
        (new Function('require', 'module', 'exports', head + folder.file(file).asText() + tail))(r, module, module.exports);
        /*jslint evil: false */
    } else if (file.substr(-5) === '.json') {
        module.exports = JSON.parse(folder.file(file).asText());
    }
    return module.exports;
}

function onmessage(e) {
    var zip,
        collection;
    if (e.data.response) { return; }
    switch (e.data.command) {
    case 'load':
        zip = createZip(e.data.zip);
        requires.fs.init(zip.folder('/webexample'));
        head = 'var process = { env: { BASE_PATH: \'' + e.data.BASE_PATH + '\'}}; (function () {';
        tail = '}());';
        load(zip.folder('webexample'), 'index.js');
        break;
    case 'http':
        self.onhttp(e);
        break;
    case 'get_collection_names':
        self.postMessage({
            command: 'get_collection_names',
            collections: namespace.getCollectionNames(),
            response: true
        });
        break;
    case 'dump_collection':
        if (!e.data.collection) { return; }
        collection = namespace.getCollection(e.data.collection);
        if (collection) {
            collection.find({}, function (err, docs) {
                if (err) {
                    return self.postMessage({
                        command: 'dump_collection',
                        collection: e.data.collection,
                        error: err,
                        response: true
                    });
                }
                self.postMessage({
                    command: 'dump_collection',
                    collection: e.data.collection,
                    docs: docs,
                    response: true
                });
            });
        } else {
            self.postMessage({
                command: 'dump_collection',
                collection: e.data.collection,
                error: 'uknown collection "' + e.data.collection + '"',
                response: true
            });
        }
        break;
    case 'restore_collection':
        if (!e.data.collection) { return; }
        if (!e.data.documents) { return; }
        collection = namespace.getCollection(e.data.collection);
        if (!collection) { return; }
        collection.remove({}, {multi: true});
        collection.insert(e.data.documents);
        break;
    }
}

self.onmessage = onmessage;
