// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var nedb = require('nedb');

function Namespace(options) {
    if (!(this instanceof Namespace)) {
        return new Namespace(options);
    }
    var collections = {};
    this.getCollection = function (name) {
        return collections[name];
    };
    this.getCollectionNames = function () {
        return Object.keys(collections);
    };
    function Collection(options) {
        if (!(this instanceof Collection)) {
            return new Collection(options);
        }
        nedb.apply(this);
        collections[options.filename] = this;
    }
    Collection.prototype = nedb.prototype;
    this.nedb = Collection;
}

exports.Namespace = Namespace;
