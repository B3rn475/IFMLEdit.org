// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    utils = require('almost-joint').utils,
    ifml = require('../ifml').ifml,
    pcn = require('../pcn').pcn,
    ifml2mobile = require('./mobile').transform,
    layout = require('./layout').layout;

function mobile(ifmlModel) {
    var pcnModel = ifml2mobile(ifml.extend(ifmlModel));
    layout(pcnModel);
    return pcnModel;
}

exports.ifml2pcn = {
    mobile: mobile
};
