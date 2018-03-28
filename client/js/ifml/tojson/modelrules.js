// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var almost = require('almost'),
    Rule = almost.Rule,
    createRule = almost.createRule;

module.exports = [
    createRule(
        Rule.always,
        function () {
            return {
                elements: [],
                relations: []
            };
        }
    )
];
