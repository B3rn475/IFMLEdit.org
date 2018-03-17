// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var elementRules = require('./elementrules'),
    relationRules = require('./relationrules'),
    extender = require('../extender'),
    core = require('almost-core'),
    createTransformer = require('almost').createTransformer;

var transformer = createTransformer(
    {
        element: elementRules,
        relation: relationRules
    },
    core.merge(
        core.none(),
        {
            elements: core.reduceBy('id', core.merge(core.mergeOrSingle(), {
                id: core.first(),
                embeds: core.concat()
            }))
        }
    )
);

exports.transform = function (model) {
    return transformer(extender.extend(model));
};