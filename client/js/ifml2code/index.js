// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    compact = require('./compact').compact,
    createModel = require('../ifml/model').createModel,
    server = require('./server'),
    client = require('./client'),
    mobile = require('./mobile'),
    flutter = require('./flutter'),
    ifml2code = { };

exports.ifml2code = ifml2code;

ifml2code.server = function (ifml) {
    var transformed = server.transform(createModel(ifml));
    return compact(transformed);
};

ifml2code.client = function (ifml) {
    var transformed = client.transform(createModel(ifml));
    return compact(transformed);
};

ifml2code.mobile = function (ifml) {
    var transformed = mobile.transform(createModel(ifml));
    return compact(transformed);
};

ifml2code.flutter = function (ifml) {
    var transformed = flutter.transform(createModel(ifml));
    return compact(transformed);
};
