// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    almost = require('almost'),
    rules = [
        require('./1-Application').rules,
        // Rule 2 is just a particular case of Rule 14
        // Rule 3 is just a particular case of Rule 16
        // Rule 4 is just a particular case of Rule 17
        // Rule 5 is just a particular case of Rules 20 & 21
        // Rule 6 is just a particular case of Rule 18
        require('./7-Base-ViewComponent').rules,
        require('./8-ViewComponent-Initialization-No-DataFlow').rules,
        // Rule 9 is just a particular case of Rules 22 & 23
        require('./10-ViewComponent-Initialization-DataFlow').rules,
        require('./11-Action-Execution').rules,
        require('./12-Action-Activation').rules,
        // Rule 13 is just a particular case of Rule 20
        require('./14-Nested-ViewContainer').rules,
        require('./15-NonXOR-Parent').rules,
        require('./16-XOR-Default-Child').rules,
        require('./17-XOR-NonDefault-Child').rules,
        require('./18-XOR-Landmark-Child').rules,
        require('./19-Selective-Initialization').rules,
        require('./20-Nested-Navigation').rules,
        require('./21-Nested-Navigation-From-ViewElement').rules,
        require('./22-Conditional-Navigation').rules,
        require('./23-Conditional-Navigation-From-ViewElement').rules,
        require('./24-Nested-Navigation-From-Action').rules,
        require('./25-Conditional-Navigation-From-Action').rules,
    ];

var rules = {
    model: _.flatten(_.map(rules, 'model')),
    element: _.flatten(_.map(rules, 'element')),
    relation: _.flatten(_.map(rules, 'relation'))
};

exports.semantics = {
    rules: rules
};
