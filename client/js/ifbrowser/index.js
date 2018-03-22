// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var $ = require('jquery'),
    URL = require('URL'),
    Worker = require('Worker'),
    document = require('document'),
    window = require('window');

var inject = "(function inject() {\
    function toArray(collection) {\
        var i,\
            array = [];\
        for (i = 0; i < collection.length; i += 1) {\
            array.push(collection[i]);\
        }\
        return array;\
    }\
    function onclick(link) {\
        link.addEventListener('click', function (event) {\
            var url = new URL(link.href);\
            window.postMessage({method: 'GET',\
                                headers: {\
                                    'Referer': toURL('').href,\
                                },\
                                url: url.pathname + url.search}, '*');\
            event.preventDefault();\
        });\
    }\
    function toURL(href) {\
        if (href === '') {\
            href = 'http://localhost' + document.body.attributes['data-url'];\
        }\
        return new URL(href);\
    }\
    function onsubmit(form) {\
        form.addEventListener('submit', function (event) {\
            var url = toURL(form.action),\
                fields;\
            if (form.method.toLowerCase() === 'get') {\
                toArray(form).forEach(function (field) {\
                    if (field.name) {\
                        url.searchParams.set(field.name, field.value);\
                    }\
                });\
                window.postMessage({method: 'GET',\
                                    headers: {\
                                        'Referer': toURL('').href,\
                                    },\
                                    url: url.pathname + url.search}, '*');\
            } else {\
                var body = new URL('http://localhost?');\
                toArray(form).map(function (field) {\
                    if (field.name) {\
                        body.searchParams.set(field.name, field.value);\
                    }\
                });\
                body = body.search.substr(1);\
                window.postMessage({method: 'POST',\
                                    url: url.pathname + url.search,\
                                    headers: {\
                                        'Referer': toURL('').href,\
                                        'Content-Type': 'application/x-www-form-urlencoded',\
                                        'Transfer-Encoding': 'utf-16',\
                                        'Content-Length': body.length\
                                    },\
                                    body: body}, '*');\
            }\
            event.preventDefault();\
        });\
    }\
    function getElementsByTagName(tagname) {\
        return toArray(document.getElementsByTagName(tagname));\
    }\
    getElementsByTagName('a').forEach(onclick);\
    getElementsByTagName('form').forEach(onsubmit);\
}())";

function IFBrowser(options) {
    if (!(this instanceof IFBrowser)) { return new IFBrowser(options); }
    options = options || {};

    if (!options.el) { throw new Error('el option is mandatory'); }
    if ($(options.el).length === 0) { throw new Error('invalid el option'); }
    if (!options.address) { throw new Error('address option is mandatory'); }
    if ($(options.address).length === 0) { throw new Error('invalid address option'); }
    if (!options.back) { throw new Error('back option is mandatory'); }
    if ($(options.back).length === 0) { throw new Error('invalid back option'); }
    if (!options.forward) { throw new Error('forward option is mandatory'); }
    if ($(options.forward).length === 0) { throw new Error('invalid forward option'); }
    if (!options.repeat) { throw new Error('repeat option is mandatory'); }
    if ($(options.repeat).length === 0) { throw new Error('invalid repeat option'); }
    if (!options.go) { throw new Error('go option is mandatory'); }
    if ($(options.go).length === 0) { throw new Error('invalid go option'); }

    var el = $($(options.el)[0]),
        address = $($(options.address)[0]),
        back = $($(options.back)[0]),
        forward = $($(options.forward)[0]),
        repeat = $($(options.repeat)[0]),
        go = $($(options.go)[0]),
        iframe = document.createElement('iframe'),
        BASE_PATH = options.BASE_PATH || '',
        history = [],
        rhistory = [],
        worker;
    iframe.sandbox = 'allow-scripts allow-forms allow-same-origin';
    iframe.src = BASE_PATH;
    el.append(iframe);
    iframe.contentDocument.write('<html><body></body></html>');
    iframe.contentDocument.close();

    back.click(function () {
        if (history.length <= 1 || !worker) { return false; }
        rhistory.push(history.pop());
        worker.postMessage(history[history.length - 1]);
        address.val(history[history.length - 1].url.substr(BASE_PATH.length));
        return false;
    });

    forward.click(function () {
        if (!rhistory.length || !worker) { return false; }
        history.push(rhistory.pop());
        worker.postMessage(history[history.length - 1]);
        address.val(history[history.length - 1].url.substr(BASE_PATH.length));
        return false;
    });

    repeat.click(function () {
        if (!history.length || !worker) { return false; }
        worker.postMessage(history[history.length - 1]);
        address.val(history[history.length - 1].url.substr(BASE_PATH.length));
        return false;
    });

    function navigateToAddress(options) {
        options = options || {};
        options.headers = options.headers || {};
        var data = {
            command: 'http',
            method: 'GET',
            headers: options.headers,
            url: BASE_PATH + address.val()
        };
        worker.postMessage(data);
        rhistory = [];
        history.push(data);
    }

    go.click(function () {
        navigateToAddress();
        return false;
    });

    address.on('keypress', function (e) {
        if (e.keyCode === 13) {
            navigateToAddress();
            return false;
        }
    });

    function receiveMessage(event) {
        event.data.command = 'http';
        worker.postMessage(event.data);
        address.val(event.data.url.substr(BASE_PATH.length));
        rhistory = [];
        history.push(event.data);
    }

    iframe.addEventListener('load', function () {
        var s = document.createElement("script");
        s.type = 'text/javascript';
        s.text = inject;
        iframe.contentDocument.body.attributes['data-url'] = history[history.length - 1].url;
        iframe.contentDocument.body.appendChild(s);
        iframe.contentWindow.addEventListener('message', receiveMessage, false);
    });

    this.start = function (zip) {
        if (worker) { worker.terminate(); }
        worker = new Worker('./js/demo-web-server.js');
        worker.postMessage({command: 'load', zip: zip, BASE_PATH: BASE_PATH});
        worker.onmessage = function (e) {
            if (Math.floor(e.data.statusCode / 100) === 3) {
                if (typeof e.data.headers.Location === 'string') {
                    address.val(e.data.headers.Location);
                    return navigateToAddress({
                        headers: {
                            'Referer': 'http://localhost' + history[history.length - 1].url
                        }
                    });
                }
            }
            iframe.contentDocument.write(e.data.content);
            iframe.contentDocument.close();
        };
    };

    this.getCollectionNames = function (cb) {
        var onmessage = worker.onmessage;
        worker.onmessage = function (e) {
            if (!e.data.response || e.data.command !== 'get_collection_names') { return; }
            worker.onmessage = onmessage;
            cb(e.data.error, e.data.collections);
        };
        worker.postMessage({
            command: 'get_collection_names'
        });
    };

    this.dumpCollection = function (collection, cb) {
        var onmessage = worker.onmessage;
        worker.onmessage = function (e) {
            if (!e.data.response || e.data.command !== 'dump_collection' || e.data.collection !== collection) { return; }
            worker.onmessage = onmessage;
            cb(e.data.error, e.data.docs);
        };
        worker.postMessage({
            command: 'dump_collection',
            collection: collection,
        });
    };

    this.restoreCollection = function (collection, documents) {
        worker.postMessage({
            command: 'restore_collection',
            collection: collection,
            documents: documents
        });
    };

    this.reload = function () {
        var link = {command: 'http', method: 'GET', url: BASE_PATH};
        worker.postMessage(link);
        address.val('');
        history = [link];
        rhistory = [];
    };

    this.hotReload = function () {
        repeat.click();
    };
}

exports.IFBrowser = IFBrowser;
