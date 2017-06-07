// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    utils = require('almost-joint').utils,
    createModel = require('../ifml/model').createModel,
    layout = require('./layout').layout,
    transform = require('./mobile').transform,
    ifml2pcn = { };

exports.ifml2pcn = ifml2pcn;

ifml2pcn.mobile = function (ifml) {
    var transformed = transform(createModel(ifml));
    layout(transformed);
    return utils.sortCells(
        _.chain(transformed)
            .values()
            .map('cells')
            .flatten()
            .filter()
            .value()
    );
};
