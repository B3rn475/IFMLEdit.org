// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
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
            elements: almost.core.flatten(
                almost.core.reduceBy('id', almost.core.merge(
                    almost.core.mergeOrSingle(),
                    {
                        id: almost.core.first(),
                        embeds: almost.core.flatten()
                    }
                ))
            )
        }
    )
);

exports.transform = function (model) {
    var result = transformer(extender.extend(model));
    result.elements = result.elements || [];
    result.relations = result.relations || [];
    return result;
};
