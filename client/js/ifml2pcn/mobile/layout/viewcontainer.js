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
        return model.isViewContainer(element);
    },
    function (container, model) {
        var id = model.toId(container),
            vpid = id + '-View-p',
            vnid = id + '-View-n',
            lid = 'L-' + id,
            lgid = 'L-' + id + '-Group',
            llid = 'L-' + id + '-Landmarks',
            lvid = lid + '-View',
            lvpid = lid + '-View-p',
            lvnid = lid + '-View-n',
            lcid = lid + '-Content';
        return {
            elements: [
                {id: llid, type: 'layout.Node', attributes: {row: 0, column: 0}},
                {id: lid, type: 'layout.Node', attributes: {row: 1, column: 0, padding: 20, spacing: 20}},
                {id: lvid, type: 'layout.Node', attributes: {row: 0, column: 0, spacing: 20}},
                {id: lvpid, type: 'layout.Leaf', attributes: {row: 0, column: 0, width: 40, height: 40}},
                {id: lvnid, type: 'layout.Leaf', attributes: {row: 1, column: 0, width: 40, height: 40}},
                {id: lcid, type: 'layout.Node', attributes: {row: 0, column: 1, spacing: 20}}
            ],
            relations: [
                {type: 'layout.Hierarchy', parent: lgid, child: llid},
                {type: 'layout.Hierarchy', parent: lgid, child: lid},
                {type: 'layout.Hierarchy', parent: lid, child: lvid},
                {type: 'layout.Hierarchy', parent: lvid, child: lvpid},
                {type: 'layout.Hierarchy', parent: lvid, child: lvnid},
                {type: 'layout.Hierarchy', parent: lid, child: lcid},
                {type: 'layout.For', layout: lid, pcn: id},
                {type: 'layout.For', layout: lvpid, pcn: vpid},
                {type: 'layout.For', layout: lvnid, pcn: vnid}
            ]
        };
    }
), almost.createRule(
    function (element, model) {
        return model.isViewContainer(element) && model.isXOR(element);
    },
    function (container, model) {
        var id = model.toId(container),
            pid = model.getParentId(container),
            lgid = 'L-' + id + '-Group',
            lpcid = 'L-' + pid + '-Content',
            column = container.metadata.graphics.position.x,
            row = container.metadata.graphics.position.y;
        return {
            elements: [
                {id: lgid, type: 'layout.Node', attributes: {row: row, column: column}},
            ],
            relations: [
                {type: 'layout.Hierarchy', parent: lpcid, child: lgid},
            ]
        };
    }
), almost.createRule(
    function (element, model) {
        return model.isViewContainer(element) && !model.isXOR(element);
    },
    function (container, model) {
        var id = model.toId(container),
            pid = model.getParentId(id, 'Application'),
            topMostXORDescendants = model.getTopMostXORDescendants(container),
            lgid = 'L-' + id + '-Group',
            lpcid = 'L-' + pid + '-Content',
            ringids = _.map(topMostXORDescendants, function (xid) {
                return id + '-Without-' + xid;
            }),
            ringlids = _.map(topMostXORDescendants, function (xid) {
                return 'L-' + id + '-Without-' + xid;
            }),
            rings = _.map(
                _.unzip([
                    _.flatten([ringlids]),
                    _.flatten([ringids])
                ]),
                function (pack) {
                    var lrid = pack[0],
                        rid = pack[1];
                    return {
                        elements: [
                            {id: lrid, type: 'layout.Node', attributes: {padding: 20}}
                        ],
                        relations: [
                            {type: 'layout.For', layout: lrid, pcn: rid}
                        ]
                    };
                }
            ),
            hierarchy = _.map(
                _.unzip([
                    _.flatten([lpcid, ringlids]),
                    _.flatten([ringlids, lgid]),
                    [container.metadata.graphics.position.y],
                    [container.metadata.graphics.position.x]
                ]),
                function (pack) {
                    var lprid = pack[0],
                        lrid = pack[1],
                        row = pack[2] || 0,
                        columns = pack[3] || 0;
                    return {
                        elements: [
                            {id: lrid, attributes: {row: row, column: columns}}
                        ],
                        relations: [
                            {type: 'layout.Hierarchy', parent: lprid, child: lrid}
                        ]
                    };
                }
            ),
            partials = _.flatten([rings, hierarchy]);
        return {
            elements: _.flatten(_.map(partials, 'elements')),
            relations: _.flatten(_.map(partials, 'relations'))
        };
    }
), almost.createRule(
    function (element, model) {
        // The presence of the \textit{landmark} property of a ViewContainer
        // \ifml{\namechild} child of a XOR ViewContainer \ifml{\namexorvc} maps to
        return model.isViewContainer(element) && model.isLandmark(element) && model.isXOR(model.getParent(element), true); // Rule 5
    },
    function (container, model) {
        var id = model.toId(container),
            tid = id + '-Landmark',
            pid = model.getParentId(container, 'Application'),
            ltid = 'L-' + id + '-Landmark',
            lplid = 'L-' + pid + '-Landmarks',
            column = container.metadata.graphics.position.x,
            row = container.metadata.graphics.position.y;
        return {
            elements: [
                {id: ltid, type: 'layout.Leaf', attributes: {row: row, column: column, width: 40, height: 40}},
                {id: tid, metadata: {graphics: {angle: 90, name: {vertical: 'top'}}, execution: {priority: 1}}}
            ],
            relations: [
                {type: 'layout.Hierarchy', parent: lplid, child: ltid},
                {type: 'layout.For', layout: ltid, pcn: tid}
            ]
        };
    }
), almost.createRule(
    function (element, model) {
        // The presence of the \textit{landmark} property of a ViewContainer
        // \ifml{\namechild} child of a XOR ViewContainer \ifml{\namexorvc} maps to
        return model.isViewContainer(element) && model.isLandmark(element) && model.isXOR(model.getParent(element)); // Rule 5
    },
    function (container, model) {
        var id = model.toId(container),
            tid = id + '-Landmark',
            pid = model.getParentId(container);
        return {
            elements: [
                {id: tid, metadata: {graphics: {parent: pid}}}
            ],
            relations: []
        };
    }
)];

var relation = [];

exports.rules = {
    model: model,
    element: element,
    relation: relation
};
