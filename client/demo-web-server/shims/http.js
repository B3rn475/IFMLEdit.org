// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true */
/*globals self */
"use strict";

var merge = require('merge');

var defaultHeaders = {
    host: 'localhost',
    accept: 'text/html'
};

function toLower(object) {
    object = object || {};
    var result = {};
    Object.keys(object).forEach(function (key) {
        result[key.toLowerCase()] = object[key];
    });
    return result;
}

function IncomingMessage(e) {
    if (!(this instanceof IncomingMessage)) { return new IncomingMessage(e); }
    this.method = e.data.method;
    this.url = e.data.url;
    this.headers = merge(defaultHeaders, toLower(e.data.headers));
    this.on = function (event, cb) {
        switch (event) {
        case 'data':
            return setTimeout(function () { cb(e.data.body); }, 1);
        case 'end':
            return setTimeout(function () { cb(); }, 10);
        }
    };
    this.removeListener = function () { return undefined; };
}
IncomingMessage.prototype.httpVersion = '1.1';
IncomingMessage.prototype.listeners = function () { return []; };
IncomingMessage.prototype.resume = function () { return undefined; };

exports.IncomingMessage = IncomingMessage;

function ServerResponse(e) {
    if (!(this instanceof ServerResponse)) { return new ServerResponse(e); }
    this.headers = {};
    this.statusCode = 200;
}
ServerResponse.prototype.end = function (data) {
    var content = data;
    if (typeof data !== 'string') {
        content = String.fromCharCode.apply(null, data);
    }
    self.postMessage({command: 'http', statusCode: this.statusCode, headers: this.headers, content: content });
};
ServerResponse.prototype.listeners = function () { return []; };
ServerResponse.prototype.setHeader = function (name, value) {
    this.headers[name] = value;
};
ServerResponse.prototype.getHeader = function (name) {
    return this.headers[name];
};



exports.ServerResponse = ServerResponse;

var createIncomingMessage = IncomingMessage;
var createServerResponse = ServerResponse;

function Server(handler) {
    if (!(this instanceof Server)) { return new Server(handler); }
    this.listen = function () {
        self.onhttp = function (e) {
            handler(createIncomingMessage(e), createServerResponse(e));
        };
    };
}

exports.createServer = Server;

exports.STATUS_CODES = {
    '100': 'Continue',
    '101': 'Switching Protocols',
    '102': 'Processing',
    '200': 'OK',
    '201': 'Created',
    '202': 'Accepted',
    '203': 'Non-Authoritative Information',
    '204': 'No Content',
    '205': 'Reset Content',
    '206': 'Partial Content',
    '207': 'Multi-Status',
    '208': 'Already Reported',
    '226': 'IM Used',
    '300': 'Multiple Choices',
    '301': 'Moved Permanently',
    '302': 'Found',
    '303': 'See Other',
    '304': 'Not Modified',
    '305': 'Use Proxy',
    '307': 'Temporary Redirect',
    '308': 'Permanent Redirect',
    '400': 'Bad Request',
    '401': 'Unauthorized',
    '402': 'Payment Required',
    '403': 'Forbidden',
    '404': 'Not Found',
    '405': 'Method Not Allowed',
    '406': 'Not Acceptable',
    '407': 'Proxy Authentication Required',
    '408': 'Request Timeout',
    '409': 'Conflict',
    '410': 'Gone',
    '411': 'Length Required',
    '412': 'Precondition Failed',
    '413': 'Payload Too Large',
    '414': 'URI Too Long',
    '415': 'Unsupported Media Type',
    '416': 'Range Not Satisfiable',
    '417': 'Expectation Failed',
    '418': 'I\'m a teapot',
    '421': 'Misdirected Request',
    '422': 'Unprocessable Entity',
    '423': 'Locked',
    '424': 'Failed Dependency',
    '425': 'Unordered Collection',
    '426': 'Upgrade Required',
    '428': 'Precondition Required',
    '429': 'Too Many Requests',
    '431': 'Request Header Fields Too Large',
    '451': 'Unavailable For Legal Reasons',
    '500': 'Internal Server Error',
    '501': 'Not Implemented',
    '502': 'Bad Gateway',
    '503': 'Service Unavailable',
    '504': 'Gateway Timeout',
    '505': 'HTTP Version Not Supported',
    '506': 'Variant Also Negotiates',
    '507': 'Insufficient Storage',
    '508': 'Loop Detected',
    '509': 'Bandwidth Limit Exceeded',
    '510': 'Not Extended',
    '511': 'Network Authentication Required'
};
