// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash');

exports.rules = _([])
                .concat(require('./viewcontainer').rules)
                .concat(require('./viewcomponent').rules)
                .concat(require('./navigationflow').rules)
                .concat(require('./action').rules)
                .value();
