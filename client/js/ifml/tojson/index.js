// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var elementRules = require('./elementrules'),
    extender = require('./extender'),
    createTransformer = require('almost').createTransformer;

var transformer = createTransformer({
        element: elementRules
    }, 'm2a');

exports.toJSON = function (graph) {
    return transformer(extender.extend({
        elements: graph.getCells()
    }));
};
