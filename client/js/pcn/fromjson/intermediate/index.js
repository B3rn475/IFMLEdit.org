// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var elementRules = require('./elementrules'),
    relationRules = require('./relationrules'),
    extender = require('../extender'),
    almost = require('almost'),
    core = almost.core,
    createTransformer = almost.createTransformer;

var transformer = createTransformer(
    {
        element: elementRules,
        relation: relationRules
    },
    core.merge(
        core.none(),
        {
            elements: core.flatten(
                core.reduceBy('id', core.merge(
                    core.mergeOrSingle(),
                    {
                        id: core.first(),
                        embeds: core.lazy(core.flatten())
                    }
                ))
            ),
            relations: core.flatten()
        }
    )
);

exports.transform = function (model) {
    return transformer(extender.extend(model));
};
