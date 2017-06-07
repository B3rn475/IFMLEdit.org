// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    $ = require('jquery'),
    ko = require('knockout'),
    Blob = require('Blob'),
    FileReader = require('FileReader'),
    saveAs = require('FileSaver'),
    document = require('document');

function FieldViewModel(value) {
    var self = this;
    value = String(value);
    self.multiline = ko.observable(value.split('\n').length > 1);
    self.value = value;
    self.expand = function () {
        self.multiline(true);
    };
}

function DocumentViewModel(fields, doc) {
    var self = this;
    self._id = doc._id;
    fields.forEach(function (field) {
        self[field] = new FieldViewModel(doc[field]);
    });
    self.toJSON = function (options) {
        options = options || {};
        var obj = {};
        if (options.internalId !== false) {
            obj._id = doc._id;
        }
        fields.forEach(function (field) {
            obj[field] = self[field].value;
        });
        return obj;
    };
}

function CollectionViewModel(options) {
    var self = this,
        emulator = options.emulator;
    self.name = options.name;
    self.loaded = ko.observable(false);
    self.documents = ko.observableArray();
    self.fields = ko.observableArray();
    self.load = function () {
        emulator.dumpCollection(self.name, function (err, docs) {
            if (err) { return; }
            var fields = Object.keys(docs[0]);
            fields.splice(fields.indexOf('_id'), 1);
            self.fields(fields);
            self.documents(docs.map(function (doc) {
                return new DocumentViewModel(fields, doc);
            }));
            self.loaded(true);
        });
    };
    self.save = function () {
        if (self.loaded()) {
            emulator.restoreCollection(self.name, self.documents().map(function (document) {
                return document.toJSON();
            }));
        }
    };
    self.remove = function () {
        self.documents.splice(self.documents.indexOf(this), 1);
    };
    self.add = function () {
        var id = self.documents()[self.documents().length - 1]._id + 1;
        self.documents.push(new DocumentViewModel(self.fields(), {_id: id, id: id.toString()}));
    };
    self.download = function () {
        var collection = self.documents().map(function (document) {
            return document.toJSON({internalId: false});
        });
        saveAs(new Blob([JSON.stringify(collection)], {type: 'application/json'}), self.name + '.json');
    };
    self.upload = function (file) {
        var reader = new FileReader();

        reader.onload = function (e) {
            try {
                var start = new Date(),
                    documents = JSON.parse(e.target.result),
                    fields;
                if (!_.isArray(documents)) {
                    throw new Error('Input should be an array');
                }
                fields = self.fields();
                self.documents(_.map(documents, function (data, id) {
                    var document = {_id: id};
                    fields.forEach(function (field) {
                        var value = data[field];
                        if (value === undefined) { value = ''; }
                        document[field] = value;
                    });
                    return new DocumentViewModel(fields, document);
                }));
                $.notify({message: 'File loaded in ' + (Math.floor((new Date() - start) / 10) / 100) + ' seconds!'}, {allow_dismiss: true, type: 'success'});
            } catch (exception) {
                $.notify({message: 'Invalid input file!'}, {allow_dismiss: true, type: 'danger'});
            }
        };

        reader.onerror = function () {
            $.notify({message: 'Error loading file!'}, {allow_dismiss: true, type: 'danger'});
        };

        reader.readAsText(file);
    };
}

function DBViewModel(options) {
    var self = this,
        emulator = options.emulator;
    self.current = ko.observable();
    self.collections = ko.observableArray();
    self.setCurrent = function () {
        self.current(this);
    };
    self.save = function () {
        self.collections().forEach(function (vm) {
            vm.save();
        });
    };
    self.saveAndReload = function () {
        self.save();
        emulator.reload();
    };
    self.saveAndHotReload = function () {
        self.save();
        emulator.hotReload();
    };

    emulator.getCollectionNames(function (err, names) {
        if (err) { return; }
        self.collections(names.map(function (name) {
            return new CollectionViewModel({
                name: name,
                emulator: emulator
            });
        }));
        self.current(self.collections()[0]);
    });
}

function ModalDB(options) {
    if (!(this instanceof ModalDB)) { return new ModalDB(options); }
    options = options || {};

    if (typeof options.emulator !== 'object') { throw new Error('Missing emulator'); }

    var emulator = options.emulator,
        el = $(require('./modal.html'));

    $(document.body).append(el);

    function tearDown() {
        el.remove();
    }

    ko.applyBindings(new DBViewModel({emulator: emulator}), el.find('.modal-content')[0]);

    el.modal('show').on('hidden.bs.modal', tearDown);
}

exports.ModalDB = ModalDB;
