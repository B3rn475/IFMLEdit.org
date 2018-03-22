// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var almost = require('almost');

var model = [];

var element = [almost.createRule(
    function (element, model) {
        return model.isAction(element) && model.getInbounds(element).length;
    },
    function (action, model) {
        var id = model.toId(action),
            oid = model.getActionOriginId(action),
            rpid = id + '-Running-p',
            rnid = id + '-Running-n',
            locid = 'L-' + oid + '-Content',
            lid = 'L-' + id,
            lrpid = lid + '-Running-p',
            lrnid = lid + '-Running-n',
            column = action.metadata.graphics.position.x,
            row = action.metadata.graphics.position.y;
        return {
            elements: [
                {id: lid, type: 'layout.Node', attributes: {row: row, column: column, padding: 20, spacing: 20}},
                {id: lrpid, type: 'layout.Leaf', attributes: {row: 0, column: 0, width: 40, height: 40}},
                {id: lrnid, type: 'layout.Leaf', attributes: {row: 1, column: 0, width: 40, height: 40}}
            ],
            relations: [
                {type: 'layout.Hierarchy', parent: locid, child: lid},
                {type: 'layout.Hierarchy', parent: lid, child: lrpid},
                {type: 'layout.Hierarchy', parent: lid, child: lrnid},
                {type: 'layout.For', layout: lid, pcn: id},
                {type: 'layout.For', layout: lrpid, pcn: rpid},
                {type: 'layout.For', layout: lrnid, pcn: rnid},
            ]
        };
    }
)];

var relation = [];

exports.rules = {
    model: model,
    element: element,
    relation: relation
};
