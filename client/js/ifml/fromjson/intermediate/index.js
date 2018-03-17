// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var elementRules = require('./elementrules'),
    relationRules = require('./relationrules'),
    extender = require('../extender'),
    almost = require('almost');

var transformer = almost.createTransformer(
    {
        element: elementRules,
        relation: relationRules
    },
    almost.core.merge(
        almost.core.none(),
        {
            elements: almost.core.reduceBy('id', almost.core.merge(
                almost.core.mergeOrSingle(),
                {
                    id: almost.core.first(),
                    embeds: almost.core.concat()
                }
            ))
        }
    )
);

exports.transform = function (model) {
    return transformer(extender.extend(model));
};
