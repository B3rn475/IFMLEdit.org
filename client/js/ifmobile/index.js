// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var $ = require('jquery'),
    URL = require('URL'),
    Worker = require('Worker'),
    document = require('document'),
    window = require('window');

function IFClient(options) {
    if (!(this instanceof IFClient)) { return new IFClient(options); }
    options = options || {};

    if (!options.el) { throw new Error('el option is mandatory'); }
    if ($(options.el).length === 0) { throw new Error('invalid el option'); }
    var el = $($(options.el)[0]),
        iframe = document.createElement('iframe');
    iframe.sandbox = 'allow-scripts allow-forms allow-same-origin allow-modals';
    iframe.scrolling = 'no';
    el.append(iframe);

    this.start = function (zip) {
        iframe.src = options.BASE_PATH;
        $(iframe).on('load', function load() {
            iframe.contentWindow.postMessage({
                command: 'load',
                zip: zip,
                BASE_PATH: options.BASE_PATH
            }, '*');
            $(iframe).off('load', load);
        });
    };

    this.getCollectionNames = function (cb) {
        function receiveMessage(e) {
            if (!e.data.response || e.data.command !== 'get_collection_names') { return; }
            iframe.contentWindow.removeEventListener('message', receiveMessage, false);
            cb(e.data.error, e.data.collections);
        }
        iframe.contentWindow.addEventListener('message', receiveMessage, false);
        iframe.contentWindow.postMessage({
            command: 'get_collection_names',
        }, '*');
    };

    this.dumpCollection = function (collection, cb) {
        function receiveMessage(e) {
            if (!e.data.response || e.data.command !== 'dump_collection' || e.data.collection !== collection) { return; }
            iframe.contentWindow.removeEventListener('message', receiveMessage, false);
            cb(e.data.error, e.data.docs);
        }
        iframe.contentWindow.addEventListener('message', receiveMessage, false);
        iframe.contentWindow.postMessage({
            command: 'dump_collection',
            collection: collection,
        }, '*');
    };

    this.restoreCollection = function (collection, documents) {
        iframe.contentWindow.postMessage({
            command: 'restore_collection',
            collection: collection,
            documents: documents
        }, '*');
    };

    this.reload = function () {
        iframe.contentWindow.postMessage({command: 'reload'}, '*');
    };

    this.hotReload = function () {
        iframe.contentWindow.postMessage({command: 'hot_reload'}, '*');
    };
}

exports.IFClient = IFClient;
