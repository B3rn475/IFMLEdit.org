// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    almost = require('almost');

var model = [];

var element = [almost.createRule(
    function (element, model) {
        return model.isNavigationFlow(element);
    },
    function (flow, model) {
        var event = model.getSource(flow),
            id = model.toId(event),
            lid = 'L-' + id,
            lgid = lid + '-Group',
            column = event.metadata.graphics.position.x,
            row = event.metadata.graphics.position.y;
        return {
            elements: [
                {id: lgid, type: 'layout.Node', attributes: {row: row, column: column, spacing: 20}},
                {id: lid, type: 'layout.Leaf', attributes: {row: 0, column: 0, width: 40, height: 40}},
                {id: id, metadata: {execution: {priority: 1}}}
            ],
            relations: [
                {type: 'layout.Hierarchy', parent: lgid, child: lid},
                {type: 'layout.For', layout: lid, pcn: id},
            ]
        };
    }
), almost.createRule(
    function (element, model) {
        return model.isNavigationFlow(element) && model.isAction(model.getTarget(element));
    },
    function (flow, model) {
        var event = model.getSource(flow),
            id = model.toId(event),
            target = model.getTarget(flow),
            oid = model.getActionOriginId(target),
            lgid = 'L-' + id + '-Group',
            locid = 'L-' + oid + '-Content';
        return {
            elements: [
                {id: id, metadata: {graphics: {parent: oid}}}
            ],
            relations: [
                {type: 'layout.Hierarchy', parent: locid, child: lgid},
            ]
        };
    }
), almost.createRule(
    function (element, model) {
        return model.isNavigationFlow(element) && !model.isAction(model.getTarget(element));
    },
    function (flow, model) {
        var event = model.getSource(flow),
            id = model.toId(event),
            cid = model.getInteractionContextId(flow, 'Application'),
            lgid = 'L-' + id + '-Group',
            lccid = 'L-' + cid + '-Content';
        return {
            elements: [
                {id: id, metadata: {graphics: {parent: cid}}}
            ],
            relations: [
                {type: 'layout.Hierarchy', parent: lccid, child: lgid},
            ]
        };
    }
), almost.createRule(
    function (element, model) {
        return model.isNavigationFlow(element) &&
            model.isViewElement(model.getTarget(element)) &&
            !model.isXOR(model.getInteractionContext(element), true);
    },
    function (flow, model) {
        var event = model.getSource(flow),
            id = model.toId(event),
            cid = model.getInteractionContextId(flow, 'Application'),
            lgid = 'L-' + id + '-Group',
            xorTargetsSet = model.getXORTargetSet(flow, cid),
            partials = _.map(xorTargetsSet, function (xid, index) {
                var tid = id + '-Via-' + xid,
                    ltid = 'L' + tid,
                    row = index + 1;
                return {
                    elements: [
                        {id: ltid, type: 'layout.Leaf', attributes: {row: row, column: 0, width: 40, height: 40}},
                        {id: tid, metadata: {graphics: {parent: cid}, execution: {priority: 1}}},
                    ],
                    relations: [
                        {type: 'layout.Hierarchy', parent: lgid, child: ltid},
                        {type: 'layout.For', layout: ltid, pcn: tid}
                    ]
                };
            });
        return {
            elements: _.flatten(_.map(partials, 'elements')),
            relations: _.flatten(_.map(partials, 'relations')),
        };
    }
)];

var relation = [];

exports.rules = {
    model: model,
    element: element,
    relation: relation
};
