// Copyright (c) 2017, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    modelRules = require('./modelrules').rules,
    elementRules = require('./elementrules').rules,
    createTransformer = require('almost').createTransformer;

exports.transform = createTransformer({
    model: modelRules,
    element: elementRules
}, 'm2t');
