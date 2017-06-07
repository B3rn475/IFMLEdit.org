// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    pcn = require('../../../pcn').pcn,
    createRule = require('almost').createRule;

exports.rules = [
    createRule( // common
        function (flow, model) { return model.isNavigationFlow(flow); },
        function (flow, model) {
            var id = flow.id,
                event = model.getSource(flow),
                cid = model.getFlowContextId(flow, 'application'),
                obj = {};
            obj[id + '-transitions'] = {children: id, position: {row: event.metadata.graphics.position.y / 5, col: event.metadata.graphics.position.x / 5}};
            obj[cid + '-content'] = {children: id + '-transitions'};
            return obj;
        }
    ),
    createRule( // fixed navigation
        function (flow, model) { return model.isNavigationFlow(flow) && model.isXOR(model.getFlowContext(flow), true); },
        function (flow, model) {
            var id = flow.id,
                event = model.getSource(flow),
                target = model.getTarget(flow),
                targetAncestors = model.getAncestors(target),
                context = model.getFlowContext(flow),
                atid = model.getCoDisplayedAncestorId(target, context),
                XORTargets = model.getXORTargets(flow, context),
                displaySet = model.getDisplaySet(flow, context),
                hideSet = model.getHideSet(flow, context),
                obj = {};
            obj[id] = {
                cells: _.chain([
                    new pcn.elements.Transition({id: id, name: {text: event.attributes.name}, priority: model.isAction(model.getParent(model.getSource(flow))) ? 2 : 1}),
                    new pcn.links.Link({id: atid + '->' + id, source: {id: atid}, target: {id: id}})
                ])
                    .concat(_.map(XORTargets, function (xid) { return new pcn.links.Link({id: id + '->' + xid + '-view-p', source: {id: id}, target: {id: xid + '-view-p'}}); }))
                    .concat(_.map(displaySet, function (xcid) {
                        var tid = _.intersection(model.getTopMostXORDescendants(xcid), targetAncestors)[0];
                        if (tid) {
                            return new pcn.links.Link({id: id + '->' + xcid + '-w-' + tid, source: {id: id}, target: {id: xcid + '-w-' + tid}});
                        }
                        return new pcn.links.Link({id: id + '->' + xcid, source: {id: id}, target: {id: xcid}});
                    }))
                    .concat(_.map(hideSet, function (xid) { return new pcn.links.Link({id: id + '->' + xid + '-view-n', source: {id: id}, target: {id: xid + '-view-n'}}); }))
                    .value(),
                position: {row: 0, col: 0}
            };
            return obj;
        }
    ),
    createRule( // fixed navigation from viewelement
        function (flow, model) { return model.isNavigationFlow(flow) && model.isXOR(model.getFlowContext(flow), true) && !model.isAction(model.getParent(model.getSource(flow))); },
        function (flow, model) {
            var id = flow.id,
                event = model.getSource(flow),
                source = model.getParent(event),
                target = model.getTarget(flow),
                sourceAncestor = model.getCoDisplayedAncestor(source, model.getFlowContext(flow)),
                obj = {};
            obj[id] = {
                cells: _.chain([
                    new pcn.links.Link({id: source.id + '-view-p->' + id, source: {id: source.id + '-view-p'}, target: {id: id}})
                ])
                    .concat((function () {
                        if (_.includes(model.getAncestors(source, true), target.id)) { return []; }
                        return [
                            new pcn.links.Link({id: sourceAncestor.id + '->' + id, source: {id: sourceAncestor.id}, target: {id: id}}),
                            new pcn.links.Link({id: id + '->' + sourceAncestor.id + '-view-n', source: {id: id}, target: {id: sourceAncestor.id + '-view-n'}})
                        ];
                    }()))
                    .value()
            };
            return obj;
        }
    ),
    createRule( // fixed navigation from action
        function (flow, model) { return model.isNavigationFlow(flow) && model.isXOR(model.getFlowContext(flow), true) && model.isAction(model.getParent(model.getSource(flow))); },
        function (flow, model) {
            var id = flow.id,
                event = model.getSource(flow),
                source = model.getParent(event),
                target = model.getTarget(flow),
                sourceAncestor = model.getCoDisplayedAncestor(source, model.getFlowContext(flow)),
                obj = {};
            obj[id] = {
                cells: _.chain([
                    new pcn.links.Link({id: source.id + '-running-p->' + id, source: {id: source.id + '-running-p'}, target: {id: id}})
                ])
                    .concat((function () {
                        if (_.includes(model.getAncestors(source, true), target.id)) { return []; }
                        return [
                            new pcn.links.Link({id: sourceAncestor.id + '->' + id, source: {id: sourceAncestor.id}, target: {id: id}}),
                            new pcn.links.Link({id: id + '->' + sourceAncestor.id + '-view-n', source: {id: id}, target: {id: sourceAncestor.id + '-view-n'}})
                        ];
                    }()))
                    .value()
            };
            return obj;
        }
    ),
    createRule( // conditional navigation
        function (flow, model) { return model.isNavigationFlow(flow) && !model.isXOR(model.getFlowContext(flow), true); },
        function (flow, model) {
            var id = flow.id,
                event = model.getSource(flow),
                context = model.getFlowContext(flow),
                target = model.getTarget(flow),
                targetAncestors = model.getAncestors(target, true),
                XORTargetsInContext = model.getXORTargets(flow, context),
                obj = {};
            obj[id] = {
                cells: _.chain([
                    new pcn.elements.Transition({id: id, name: {text: event.attributes.name}, priority: model.isAction(model.getParent(model.getSource(flow))) ? 2 : 1}),
                    new pcn.links.Link({id: target.id + '->' + id, source: {id: target.id}, target: {id: id}}),
                    new pcn.links.Link({id: id + '->' + target.id, source: {id: id}, target: {id: target.id}}),
                ])
                    .concat((function () {
                        if (XORTargetsInContext.length === 0) { return []; }
                        var targetAncestor = model.getCoDisplayedAncestor(target, _.last(XORTargetsInContext));
                        if (targetAncestor === target) {
                            return new pcn.links.Link({id: targetAncestor.id + '-view-p->' + id, source: {id: targetAncestor.id + '-view-p'}, target: {id: id}});
                        }
                        return [
                            new pcn.links.Link({id: targetAncestor.id + '-view-p->' + id, source: {id: targetAncestor.id + '-view-p'}, target: {id: id}}),
                            new pcn.links.Link({id: id + '->' + targetAncestor.id + '-view-p', source: {id: id}, target: {id: targetAncestor.id + '-view-p'}}),
                        ];
                    }()))
                    .value(),
                position: {row: 0, col: 0}
            };
            _.forEach(XORTargetsInContext, function (xid, index) {
                var tid = id + '-via-' + xid,
                    container = model.toElement(xid),
                    XORChildAncestor = model.getCoDisplayedAncestor(target, container),
                    XORTargets = model.getXORTargets(flow, container),
                    displaySet = model.getDisplaySet(flow, container),
                    hideSet = model.getHideSet(flow, container);
                obj[id + '-transitions'] = {children: tid};
                obj[tid] = {
                    cells: _.chain([
                        new pcn.elements.Transition({id: tid, name: {text: event.attributes.name + '▶' + container.attributes.name}, priority: model.isAction(model.getParent(model.getSource(flow))) ? 2 : 1}),
                        new pcn.links.Link({id: xid + '->' + tid, source: {id: xid}, target: {id: tid}}),
                        new pcn.links.Link({id: XORChildAncestor.id + '-view-n->' + tid, source: {id: XORChildAncestor.id + '-view-n'}, target: {id: tid}}),
                        new pcn.links.Link({id: tid + '->' + xid + '-view-p', source: {id: tid}, target: {id: xid + '-view-p'}}),
                    ])
                        .concat(_.map(XORTargets, function (xid) { return new pcn.links.Link({id: tid + '->' + xid + '-view-p', source: {id: tid}, target: {id: xid + '-view-p'}}); }))
                        .concat(_.map(displaySet, function (xcid) {
                            var txid = _.intersection(model.getTopMostXORDescendants(xcid), targetAncestors)[0];
                            if (txid) {
                                return new pcn.links.Link({id: tid + '->' + xcid + '-w-' + txid, source: {id: id}, target: {id: xcid + '-w-' + txid}});
                            }
                            return new pcn.links.Link({id: tid + '->' + xcid, source: {id: tid}, target: {id: xcid}});
                        }))
                        .concat(_.map(hideSet, function (xid) { return new pcn.links.Link({id: tid + '->' + xid + '-view-n', source: {id: tid}, target: {id: xid + '-view-n'}}); }))
                        .value(),
                    position: {row: index + 1, col: 0}
                };
            });
            return obj;
        }
    ),
    createRule( // conditional navigation from viewelement
        function (flow, model) { return model.isNavigationFlow(flow) && !model.isXOR(model.getFlowContext(flow), true) && !model.isAction(model.getParent(model.getSource(flow))); },
        function (flow, model) {
            var id = flow.id,
                event = model.getSource(flow),
                context = model.getFlowContext(flow),
                source = model.getParent(event),
                target = model.getTarget(flow),
                XORTargetsInContext = model.getXORTargets(flow, context),
                obj = {};
            if (_.includes(model.getAncestors(source, true), target.id)) {
                obj[id] = {
                    cells: new pcn.links.Link({id: source.id + '-view-p->' + id, source: {id: source.id + '-view-p'}, target: {id: id}})
                };
                _.forEach(XORTargetsInContext, function (xid) {
                    var tid = id + '-via-' + xid;
                    obj[tid] = {
                        cells: new pcn.links.Link({id: source.id + '-view-p->' + tid, source: {id: source.id + '-view-p'}, target: {id: tid}})
                    };
                });
            } else {
                obj[id] = {
                    cells: [
                        new pcn.links.Link({id: source.id + '-view-p->' + id, source: {id: source.id + '-view-p'}, target: {id: id}}),
                        new pcn.links.Link({id: id + '->' + source.id + '-view-p', source: {id: id}, target: {id: source.id + '-view-p'}}),
                    ]
                };
                _.forEach(XORTargetsInContext, function (xid) {
                    var tid = id + '-via-' + xid;
                    obj[tid] = {
                        cells: [
                            new pcn.links.Link({id: source.id + '-view-p->' + tid, source: {id: source.id + '-view-p'}, target: {id: tid}}),
                            new pcn.links.Link({id: tid + '->' + source.id + '-view-p', source: {id: tid}, target: {id: source.id + '-view-p'}}),
                        ]
                    };
                });
            }
            return obj;
        }
    ),
    createRule( // conditional navigation from action
        function (flow, model) { return model.isNavigationFlow(flow) && !model.isXOR(model.getFlowContext(flow), true) && model.isAction(model.getParent(model.getSource(flow))); },
        function (flow, model) {
            var id = flow.id,
                event = model.getSource(flow),
                context = model.getFlowContext(flow),
                source = model.getParent(event),
                target = model.getTarget(flow),
                XORTargetsInContext = model.getXORTargets(flow, context),
                obj = {};
            if (_.includes(model.getAncestors(source, true), target.id)) {
                obj[id] = {
                    cells: new pcn.links.Link({id: source.id + '-running-p->' + id, source: {id: source.id + '-running-p'}, target: {id: id}})
                };
                _.forEach(XORTargetsInContext, function (xid) {
                    var tid = id + '-via-' + xid;
                    obj[tid] = {
                        cells: new pcn.links.Link({id: source.id + '-running-p->' + tid, source: {id: source.id + '-running-p'}, target: {id: tid}})
                    };
                });
            } else {
                obj[id] = {
                    cells: [
                        new pcn.links.Link({id: source.id + '-running-p->' + id, source: {id: source.id + '-running-p'}, target: {id: id}}),
                        new pcn.links.Link({id: id + '->' + source.id + '-running-n', source: {id: id}, target: {id: source.id + '-running-n'}}),
                    ]
                };
                _.forEach(XORTargetsInContext, function (xid) {
                    var tid = id + '-via-' + xid;
                    obj[tid] = {
                        cells: [
                            new pcn.links.Link({id: source.id + '-running-p->' + tid, source: {id: source.id + '-running-p'}, target: {id: tid}}),
                            new pcn.links.Link({id: tid + '->' + source.id + '-running-n', source: {id: tid}, target: {id: source.id + '-running-n'}}),
                        ]
                    };
                });
            }
            return obj;
        }
    )
];
