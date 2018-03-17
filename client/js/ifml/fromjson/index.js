// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    transform = require('./intermediate').transform,
    toJoint = require('./tojoint').toJoint,
    utils = require('almost-joint').utils;

exports.fromJSON = function (model) {
    return utils.sortCells(toJoint(transform(model)));
};
