// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var elementRules = require('./elementrules'),
    extender = require('../extender'),
    core = require('almost-core'),
    createTransformer = require('almost').createTransformer;

var transformer = createTransformer({
        element: elementRules
    }, core.concat());

exports.toJoint = function (model) {
    return transformer(extender.extend(model));
};
