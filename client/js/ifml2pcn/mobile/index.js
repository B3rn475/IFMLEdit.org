// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    almost = require('almost'),
    semantics = require('./semantics').semantics,
    layout = require('./layout').layout;

var rules = [
    semantics.rules,
    layout.rules
];

var transform = almost.createTransformer({
    model: _.flatten(_.map(rules, 'model')),
    element: _.flatten(_.map(rules, 'element')),
    relations: _.flatten(_.map(rules, 'relation')),
}, 'm2a');

exports.transform = transform;
