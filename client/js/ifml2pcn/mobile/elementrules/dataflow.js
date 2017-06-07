// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var pcn = require('../../../pcn').pcn,
    createRule = require('almost').createRule;

exports.rules = [
    createRule( // map Data Flow
        function (element, model) { return model.isDataFlow(element); },
        function (flow, model) {
            var id = flow.id,
                sid = model.getSourceId(id),
                tid = model.getTargetId(id),
                obj = {};
            obj[tid + '-propagate'] = { cells: [
                new pcn.links.Link({id: sid + '-view-p->' + tid + '-propagate', source: {id: sid + '-view-p'}, target: {id: tid + '-propagate'}}),
                new pcn.links.Link({id: tid + '-propagate->' + sid + '-view-p', source: {id: tid + '-propagate'}, target: {id: sid + '-view-p'}})
            ]};
            return obj;
        }
    )
];
