// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    almost = require('almost'),
    rules = [
        require('./action').rules,
        require('./application').rules,
        require('./navigationflow').rules,
        require('./viewcomponent').rules,
        require('./viewcontainer').rules,
    ];

var rules = {
    model: _.flatten(_.map(rules, 'model')),
    element: _.flatten(_.map(rules, 'element')),
    relation: _.flatten(_.map(rules, 'relation'))
};

exports.layout = {
    rules: rules
};
