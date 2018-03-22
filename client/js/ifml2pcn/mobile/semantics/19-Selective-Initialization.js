// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    almost = require('almost');

// Given a non XOR ViewContainer \ifml{\namevc}, each topmost XOR descendant
// \ifml{\namexorvc_i} of \ifml{\namevc} maps to:
// \begin{enumerate}
//   \item a place chart \pcninitialization{\namevc}{\namexorvc_i} enclosing the
//     place chart \pcn{\namevc};
//   \item An initialization arc from \pcninitialization{\namevc}{\namexorvc_i}
//     to \pcnview{\namevc};
//   \item For all the children \ifml{\namechild_j} of \ifml{\namevc}, such that
//     \ifml{\namechild_j \neq \namexorvc_i} and \ifml{\namechild_j} is not an
//     ancestor of \ifml{\namexorvc_i}, an initialization arc from
//     \pcninitialization{\namevc}{\namexorvc_i} to \pcn{\namechild_j};
//   \item If an ancestor \ifml{\nameancestor_{i}} of \ifml{\namexorvc_i} child
//     of \ifml{\namevc} exists, an initialization arc from
//     \pcninitialization{\namevc}{\namexorvc_i} to \pcn{\nameancestor_{i}};
// \end{enumerate}

var model = [];

var element = [almost.createRule(
    function (element, model) {
        // Given a non XOR ViewContainer \ifml{\namevc}
        return model.isViewContainer(element) && !model.isXOR(element); // Rule 2
    },
    function (container, model) {
        // each topmost XOR descendant \ifml{\namexorvc_i} of \ifml{\namevc} maps to:
        var id = container.id,
            vpid = id + '-View-p',
            topMostXORDescendants = model.getTopMostXORDescendants(container),
            prefix = container.attributes.name + '/',
            partials = _.map(topMostXORDescendants, function (xid) {
                var rid = id + '-Without-' + xid,
                    iid = rid + '->' + vpid,
                    name = model.toElement(xid).attributes.name;
                return {
                    elements: [
                        // a place chart \pcninitialization{\namevc}{\namexorvc_i}
                        {id: rid, type: 'pcn.PlaceChart', attributes: {name: prefix + name}},
                        // An initialization arc from \pcninitialization{\namevc}{\namexorvc_i} to \pcnview{\namevc}
                        {id: iid, type: 'pcn.Link', attributes: {tokens: 1}}
                    ],
                    relations: [
                        // An initialization arc from \pcninitialization{\namevc}{\namexorvc_i}
                        {type: 'pcn.Source', link: iid, source: rid},
                        // to \pcnview{\namevc}
                        {type: 'pcn.Target', link: iid, target: vpid}
                    ]
                };
            });
        return {
            elements: _.flatten(_.map(partials, 'elements')),
            relations: _.flatten(_.map(partials, 'relations')),
        };
    }
), almost.createRule(
    function (element, model) {
        // Given a non XOR ViewContainer \ifml{\namevc}
        return model.isViewContainer(element) && !model.isXOR(element); // Rule 2
    },
    function (container, model) {
        // each topmost XOR descendant \ifml{\namexorvc_i} of \ifml{\namevc} maps to:
        var id = container.id,
            topMostXORDescendants = model.getTopMostXORDescendants(container),
            children = model.getChildren(container),
            partials = _.flatten(_.map(topMostXORDescendants, function (xid) {
                // For all the children \ifml{\namechild_j} of \ifml{\namevc}, such that
                // \ifml{\namechild_j \neq \namexorvc_i} and \ifml{\namechild_j} is not an
                // ancestor of \ifml{\namexorvc_i},
                return _.map(_.difference(children, model.getAncestors(xid, true)), function (cid) {
                    var rid = id + '-Without-' + xid,
                        iid = rid + '->' + cid;
                    return {
                        elements: [
                            // an initialization arc from \pcninitialization{\namevc}{\namexorvc_i} to \pcn{\namechild_j};
                            {id: iid, type: 'pcn.Link', attributes: {tokens: 1}}
                        ],
                        relations: [
                            // an initialization arc from \pcninitialization{\namevc}{\namexorvc_i}
                            {type: 'pcn.Source', link: iid, source: rid},
                            // to \pcn{\namechild_j};
                            {type: 'pcn.Target', link: iid, target: cid}
                        ]
                    };
                });
            }));
        return {
            elements: _.flatten(_.map(partials, 'elements')),
            relations: _.flatten(_.map(partials, 'relations')),
        };
    }
), almost.createRule(
    function (element, model) {
        // Given a non XOR ViewContainer \ifml{\namevc}
        return model.isViewContainer(element) && !model.isXOR(element); // Rule 2
    },
    function (container, model) {
        // each topmost XOR descendant \ifml{\namexorvc_i} of \ifml{\namevc} maps to:
        var id = container.id,
            pid = model.getParentId(container, 'Application'),
            topMostXORDescendants = model.getTopMostXORDescendants(container),
            ringids = _.map(topMostXORDescendants, function (xid) {
                return id + '-Without-' + xid;
            }),
            pairs = _.unzip([
                _.flatten([pid, ringids]),
                _.flatten([ringids, id])
            ]),
            partials = _.map(pairs, function (pair) {
                return {
                    elements: [],
                    relations: [
                        {type: 'pcn.Hierarchy', parent: pair[0], child: pair[1]}
                    ]
                };
            });
        return {
            elements: _.flatten(_.map(partials, 'elements')),
            relations: _.flatten(_.map(partials, 'relations')),
        };
    }
), almost.createRule(
    function (element, model) {
        // \item If an ancestor \ifml{\nameancestor_{i}} of \ifml{\namexorvc_i} child of \ifml{\namevc} exists
        return model.isViewContainer(element) && !model.isXOR(element) &&
            !model.isXOR(model.getParent(element), true);
    },
    function (container, model) {
        var id = container.id,
            pid = model.getParentId(container),
            topMostXORDescendants = model.getTopMostXORDescendants(container),
            partials = _.map(topMostXORDescendants, function (xid) {
                var rid = id + '-Without-' + xid,
                    prid = pid + '-Without-' + xid,
                    iid = prid + '->' + rid;
                return {
                    elements: [
                        // an initialization arc from \pcninitialization{\namevc}{\namexorvc_i} to \pcn{\nameancestor_{i}};
                        {id: iid, type: 'pcn.Link', attributes: {tokens: 1}}
                    ],
                    relations: [
                        // an initialization arc from \pcninitialization{\namevc}{\namexorvc_i}
                        {type: 'pcn.Source', link: iid, source: prid},
                        // to \pcn{\nameancestor_{i}};
                        {type: 'pcn.Target', link: iid, target: rid}
                    ]
                };
            });
        return {
            elements: _.flatten(_.map(partials, 'elements')),
            relations: _.flatten(_.map(partials, 'relations')),
        };
    }
), almost.createRule(
    function (element, model) {
        return model.isViewContainer(element) && model.isXOR(element); // Rule 2
    },
    function (container, model) {
        var id = container.id,
            pid = model.getParentId(container);
        return {
            elements: [],
            relations: [
                {type: 'pcn.Hierarchy', parent: pid, child: id}
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
