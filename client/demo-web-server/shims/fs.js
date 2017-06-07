// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true */
/*globals self */
"use strict";

var root;

exports.init = function (folder) {
    root = folder;
};

function Stats(path) {
    this.path = path;
    this.mtime = new Date();
    if (root.files['webexample' + path].options.dir) {
        this.size = 0;
    } else {
        this.size = root.files['webexample' + path].asUint8Array().length;
    }
}
Stats.prototype.isDirectory = function () {
    return root.files['webexample' + this.path].options.dir;
};
Stats.prototype.isFile = function () {
    return !root.files['webexample' + this.path].options.dir;
};

exports.Stats = Stats;

exports.stat = function (path, cb) {
    setImmediate(function () {
        if (root.files['webexample' + path] === undefined) {
            return cb(new Error('No such file or directory'));
        }
        cb(null, new Stats(path));
    });
};

exports.statSync = function (path) {
    if (root.files['webexample' + path] === undefined) {
        throw new Error('No such file or directory');
    }
    return new Stats(path);
};

exports.readFileSync = function (path) {
    if (root.files['webexample' + path] === undefined) {
        throw new Error('No such file or directory');
    }
    return root.files['webexample' + path].asText();
};
