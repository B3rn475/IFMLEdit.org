// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    modelRules = require('./modelrules').rules,
    elementRules = require('./elementrules').rules,
    almost = require('almost');

exports.transform = almost.createTransformer({
    model: modelRules,
    element: elementRules,
}, almost.core.merge(
    almost.core.merge(
        almost.core.none(),
        {
            cells: almost.core.flatten(),
            children: almost.core.flatten(),
            position: almost.core.merge()
        }
    )
));
