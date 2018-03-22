// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    almost = require('almost');

var config = {
    type: {
        PlaceChart: 'pcn.PlaceChart',
        Transition: 'pcn.Transition',
        Link: 'pcn.Link'
    },
    relation: {
        Parent: {relation: 'pcn.Hierarchy', from: 'child', to: 'parent', single: true},
        Children: {relation: 'pcn.Hierarchy', from: 'parent', to: 'child'},
        Source: {relation: 'pcn.Source', from: 'link', to: 'element', single: true},
        Target: {relation: 'pcn.Target', from: 'link', to: 'element', single: true}
    }
};

var extend = almost.createExtender(config);

exports.extend = extend;
