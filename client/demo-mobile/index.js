// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var $ = require('jquery'),
    ko = require('knockout'),
    window = require('window'),
    createZip = require('jszip'),
    Promise = require('bluebird'),
    createNamespace = require('./datastore').Namespace,
    namespace = createNamespace(),
    requires = {
        jquery: $,
        knockout: ko,
        nedb: namespace.nedb,
        bluebird: Promise
    },
    createPanner = require('./panner').Panner;

Promise.config({cancellation: true});

var panner = createPanner({el: 'html'});

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
        (new Function('require', 'module', 'exports', folder.file(file).asText()))(r, module, module.exports);
        /*jslint evil: false */
    } else if (file.substr(-5) === '.json') {
        module.exports = JSON.parse(folder.file(file).asText());
    } else if (file.substr(-5) === '.html') {
        module.exports = folder.file(file).asText();
    }
    return module.exports;
}

function hotReload() {
    var app = window.document.body.getElementsByTagName('main-application')[0],
        viewmodel = ko.dataFor(app);
    Object.keys(viewmodel.context.vms).forEach(function (id) {
        var vm = viewmodel.context.vms[id],
            selected = vm.selected && vm.selected();
        function fixStatus() {
            vm.waitForStatusChange().then(function () {
                if (vm.status() === 'computed') {
                    var item = vm.items().filter(function (item) {
                        return item.id === selected;
                    })[0];
                    if (item) {
                        vm.selected(selected);
                        vm.output = item;
                    }
                } else {
                    fixStatus();
                }
            });
        }
        if (vm.output !== undefined) {
            vm.output = undefined;
            vm.init({
                filters: vm.filters
            });
            if (selected !== undefined) {
                fixStatus();
            }
        }
    });
}

function reload() {
    var app = window.document.body.getElementsByTagName('main-application')[0],
        viewmodel = ko.dataFor(app);
    ko.cleanNode(window.document.body);
    ko.applyBindings(viewmodel);
    viewmodel.context.top.init();
}

function receiveMessage(e) {
    var zip,
        collection;
    if (e.data.response) { return; }
    switch (e.data.command) {
    case 'load':
        if (!e.data.zip) { return; }
        zip = createZip(e.data.zip);
        load(zip.folder('mobileexample').folder('src').folder('js'), 'index.js');
        break;
    case 'reload':
        reload();
        break;
    case 'hot_reload':
        hotReload();
        break;
    case 'get_collection_names':
        window.postMessage({
            command: 'get_collection_names',
            collections: namespace.getCollectionNames(),
            response: true
        }, '*');
        break;
    case 'dump_collection':
        if (!e.data.collection) { return; }
        collection = namespace.getCollection(e.data.collection);
        if (collection) {
            collection.find({}, function (err, docs) {
                if (err) {
                    return window.postMessage({
                        command: 'dump_collection',
                        collection: e.data.collection,
                        error: err,
                        response: true
                    }, '*');
                }
                window.postMessage({
                    command: 'dump_collection',
                    collection: e.data.collection,
                    docs: docs,
                    response: true
                }, '*');
            });
        } else {
            window.postMessage({
                command: 'dump_collection',
                collection: e.data.collection,
                error: 'uknown collection "' + e.data.collection + '"',
                response: true
            }, '*');
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

(function () {
    var register = ko.components.register;
    ko.components.register = function (name, options) {
        var createViewModel = options.viewModel.createViewModel;
        options.viewModel.createViewModel = function () {
            setTimeout(function () {
                $(name + ' ul.tabs').each(function () {
                    if (!$(this).data('padding')) {
                        createPanner({el: this});
                        $(this).data('padding', 'true');
                    }
                });
            }, 1);
            return createViewModel.apply(this, arguments);
        };
        return register.apply(this, arguments);
    };
}());

window.addEventListener('message', receiveMessage, false);
