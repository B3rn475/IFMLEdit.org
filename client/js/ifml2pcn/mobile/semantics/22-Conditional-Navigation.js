// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    almost = require('almost');

// Given a NavigationFlow \ifml{\namenavflow}, associated with an event
// \ifml{\nameevent} and with target \ifml{\nametarget}, whose interaction
// context \ifmlinteractioncontext is a non XOR ViewContainer,
// \ifml{\namenavflow} maps to:
// \begin{enumerate}
//  \item a transition \pcn{\nameevent} that removes/adds a token from/to
//        \pcn{\nametarget}, and for each ViewContainer \ifml{\nameancestor_i}
//        ancestor of \pcn{\nametarget} and child of an element in the
//        XOR targets set of \ifml{\namenavflow} inside
//        \ifmlinteractioncontext[], an arc from \pcnview{\nameancestor_i} to
//        \pcn{\nameevent}; and an arc from \pcn{\nameevent} to \pcnview{\nameancestor_i};
//        if \ifml{\nametarget} is child of an element in the XOR targets set
//        of \ifml{\namenavflow} inside \ifmlinteractioncontext[], an arc from
//        \pcnview{\nametarget} to \pcn{\nameevent};
//  \item For each ViewContainer \ifml{\namexorvc_i} in the XOR targets set of
//        \ifml{\namenavflow} inside \ifmlinteractioncontext:
//        \begin{enumerate}
//          \item a transition \pcnevent{\namexorvc_i} that removes a token from
//                \pcn{\namexorvc_i} and \pcnnotview{\nameancestor_{i}} and adds
//                a token to \pcn{\nameancestor_{i}}, where
//                \ifml{\nameancestor_{i}} is the co-displayed ancestor of
//                \ifml{\nametarget} inside \ifml{\namexorvc_i};
//          \item For each ViewContainer \ifml{\namexorvc_{i,j}} in the extended
//                XOR targets set of \ifml{\namenavflow} inside
//                \ifml{\namexorvc_i}, an arc from \pcnevent{\namexorvc_i}
//                to \pcnview{\namexorvc_{i,j}};
//          \item For each element \ifmldisplayitem{i,j} in the display set of
//                \ifml{\namenavflow} inside \ifml{\namexorvc_i} such that there
//                exists a ViewContainer \ifmldisplayitem{i,k} that is the
//                topmost XOR descendant of \ifmldisplayitem{i,j} and ancestor
//                of \ifml{\nametarget}, an arc from \pcnevent{\namexorvc_i} to
//                \pcninitialization{\formatdisplayitem{i,j}}{\formatdisplayitem{i,k}};
//                if such \ifmldisplayitem{i,k} does not exist, the arc goes
//                from \pcnevent{\namexorvc_i} to \pcndisplayitem{i,j};
//          \item For each element \ifmlhideitem{i,j} of the Hide Set of
//                \ifml{\namenavflow} inside \ifml{\namexorvc_i}, an arc from
//                \pcn{\namexorvc_i} to \pcnnotview{\formathideitem{i,j}};
//        \end{enumerate}
// \end{enumerate}
var model = [];

var element = [almost.createRule(
    function (element, model) {
        // Given a NavigationFlow \ifml{\namenavflow}, associated with an event
        // \ifml{\nameevent} and with target \ifml{\nametarget}, whose interaction
        // context \ifmlinteractioncontext is a non XOR ViewContainer,
        return model.isNavigationFlow(element) &&
            model.isViewElement(model.getTarget(element)) &&
            !model.isXOR(model.getInteractionContext(element), true);
    },
    function (flow, model) {
        var event = model.getSource(flow),
            id = model.toId(event),
            name = event.attributes.name,
            tid = model.getTargetId(flow),
            rtid = tid + '->' + id,
            atid = id + '->' + tid;
        return {
            elements: [
                // a transition \pcn{\nameevent}
                {id: id, type: 'pcn.Transition', attributes: {name: name}},
                // that removes/adds a token from/to \pcn{\nametarget}
                {id: rtid, type: 'pcn.Link', attributes: {tokens: 1}},
                {id: atid, type: 'pcn.Link', attributes: {tokens: 1}}
            ],
            relations: [
                // that removes/adds a token from/to \pcn{\nametarget}
                {type: 'pcn.Source', link: rtid, source: tid},
                {type: 'pcn.Target', link: rtid, target: id},
                {type: 'pcn.Source', link: atid, source: id},
                {type: 'pcn.Target', link: atid, target: tid}
            ]
        };
    }
), almost.createRule(
    function (element, model) {
        // Given a NavigationFlow \ifml{\namenavflow}, associated with an event
        // \ifml{\nameevent} and with target \ifml{\nametarget}, whose interaction
        // context \ifmlinteractioncontext is a non XOR ViewContainer,
        return model.isNavigationFlow(element) &&
            model.isViewElement(model.getTarget(element)) &&
            !model.isXOR(model.getInteractionContext(element), true);
    },
    function (flow, model) {
        var event = model.getSource(flow),
            id = model.toId(event),
            context = model.getInteractionContext(flow),
            target = model.getTarget(flow),
            targetId = model.toId(target),
            ancestors = model.getAncestors(target),
            xorTargetsSet = model.getXORTargetSet(flow, context),
            xorTargetsSetChildren = _.flatten(_.map(xorTargetsSet, function (xid) {
                return model.getChildren(xid);
            })),
            intersection = _.intersection(ancestors, xorTargetsSetChildren),
            // for each ViewContainer \ifml{\nameancestor_i} ancestor of
            // \pcn{\nametarget} and child of an element in the XOR targets set of
            // \ifml{\namenavflow} inside \ifmlinteractioncontext[]
            partials = _.map(intersection, function (aid) {
                var vpid = aid + '-View-p',
                    rvpid = vpid + '->' + id,
                    avpid = id + '->' + vpid;
                return {
                    elements: [
                        // an arc from \pcnview{\nameancestor_i} to \pcn{\nameevent}
                        {id: rvpid, type: 'pcn.Link', attributes: {tokens: 1}},
                        // an arc from \pcn{\nameevent} to \pcnview{\nameancestor_i};
                        {id: avpid, type: 'pcn.Link', attributes: {tokens: 1}}
                    ],
                    relations: [
                        // an arc from \pcnview{\nameancestor_i}
                        {type: 'pcn.Source', link: rvpid, source: vpid},
                        // to \pcn{\nameevent}
                        {type: 'pcn.Target', link: rvpid, target: id},
                        // an arc from \pcn{\nameevent}
                        {type: 'pcn.Source', link: avpid, source: id},
                        // to \pcnview{\nameancestor_i};
                        {type: 'pcn.Target', link: avpid, target: vpid}
                    ]
                };
            });
        // if \ifml{\nametarget} is child of an element in the XOR targets set
        // of \ifml{\namenavflow} inside \ifmlinteractioncontext[]
        if (_.includes(xorTargetsSetChildren, targetId)) {
            var vpid = targetId + '-View-p',
                rvpid = vpid + id;
            // an arc from \pcnview{\nametarget} to \pcn{\nameevent}
            partials.push({
                elements: [
                    {id: rvpid, type: 'pcn.Link', attributes: {tokens: 1}},
                ],
                relations: [
                    {type: 'pcn.Source', link: rvpid, source: vpid},
                    {type: 'pcn.Target', link: rvpid, target: id},
                ]
            });
        }
        return {
            elements: _.flatten(_.map(partials, 'elements')),
            relations: _.flatten(_.map(partials, 'relations')),
        };
    }
), almost.createRule(
    function (element, model) {
        // Given a NavigationFlow \ifml{\namenavflow}, associated with an event
        // \ifml{\nameevent} and with target \ifml{\nametarget}, whose interaction
        // context \ifmlinteractioncontext is a non XOR ViewContainer,
        return model.isNavigationFlow(element) &&
            model.isViewElement(model.getTarget(element)) &&
            !model.isXOR(model.getInteractionContext(element), true);
    },
    function (flow, model) {
        var event = model.getSource(flow),
            id = model.toId(event),
            target = model.getTarget(flow),
            context = model.getInteractionContext(flow),
            xorTargetsSet = model.getXORTargetSet(flow, context),
            // For each ViewContainer \ifml{\namexorvc_i} in the XOR targets set
            // of \ifml{\namenavflow} inside \ifmlinteractioncontext:
            partials = _.map(xorTargetsSet, function (xid) {
                // where \ifml{\nameancestor_{i}} is the co-displayed ancestor of
                // \ifml{\nametarget} inside \ifml{\namexorvc_i};
                var ancestor = model.getCoDisplayedAncestor(target, xid),
                    aid = model.toId(ancestor),
                    vnid = aid + '-View-n',
                    tid = id + '-Via-' + xid,
                    rxid = xid + '->' + tid,
                    rvnid = vnid + '->' + tid,
                    aaid = tid + '->' + aid,
                    name = event.attributes.name + '▶' + ancestor.attributes.name;
                return {
                    elements: [
                        // a transition \pcnevent{\namexorvc_i}
                        {id: tid, type: 'pcn.Transition', attributes: {name: name}},
                        // that removes a token from \pcn{\namexorvc_i}
                        {id: rxid, type: 'pcn.Link', attributes: {tokens: 1}},
                        // and \pcnnotview{\nameancestor_{i}}
                        {id: rvnid, type: 'pcn.Link', attributes: {tokens: 1}},
                        // and adds a token to \pcn{\nameancestor_{i}}
                        {id: aaid, type: 'pcn.Link', attributes: {tokens: 1}}
                    ],
                    relations: [
                        // that removes a token from \pcn{\namexorvc_i}
                        {type: 'pcn.Source', link: rxid, source: xid},
                        {type: 'pcn.Target', link: rxid, target: tid},
                        // and \pcnnotview{\nameancestor_{i}}
                        {type: 'pcn.Source', link: rvnid, source: vnid},
                        {type: 'pcn.Target', link: rvnid, target: tid},
                        // and adds a token to \pcn{\nameancestor_{i}}
                        {type: 'pcn.Source', link: aaid, source: tid},
                        {type: 'pcn.Target', link: aaid, target: aid}
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
        // Given a NavigationFlow \ifml{\namenavflow}, associated with an event
        // \ifml{\nameevent} and with target \ifml{\nametarget}, whose interaction
        // context \ifmlinteractioncontext is a non XOR ViewContainer,
        return model.isNavigationFlow(element) &&
            model.isViewElement(model.getTarget(element)) &&
            !model.isXOR(model.getInteractionContext(element), true);
    },
    function (flow, model) {
        var event = model.getSource(flow),
            id = model.toId(event),
            context = model.getInteractionContext(flow),
            xorTargetsSet = model.getXORTargetSet(flow, context),
            // For each ViewContainer \ifml{\namexorvc_i} in the XOR targets set
            // of \ifml{\namenavflow} inside \ifmlinteractioncontext:
            partials = _.flatten(_.map(xorTargetsSet, function (xid) {
                var extendedXORTargetsSet = model.getExtendedXORTargetSet(flow, xid),
                    tid = id + '-Via-' + xid;
                // For each ViewContainer \ifml{\namexorvc_{i,j}} in the extended
                // XOR targets set of \ifml{\namenavflow} inside \ifml{\namexorvc_i}
                return _.map(extendedXORTargetsSet, function (cid) {
                    var vpid = cid + '-View-p',
                        avpid = tid + '->' + vpid;
                    return {
                        elements: [
                            // an arc from \pcnevent{\namexorvc_i} to \pcnview{\namexorvc_{i,j}};
                            {id: avpid, type: 'pcn.Link', attributes: {tokens: 1}}
                        ],
                        relations: [
                            // an arc from \pcnevent{\namexorvc_i}
                            {type: 'pcn.Source', link: avpid, source: tid},
                            // to \pcnview{\namexorvc_{i,j}};
                            {type: 'pcn.Target', link: avpid, target: vpid}
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
        // Given a NavigationFlow \ifml{\namenavflow}, associated with an event
        // \ifml{\nameevent} and with target \ifml{\nametarget}, whose interaction
        // context \ifmlinteractioncontext is a non XOR ViewContainer,
        return model.isNavigationFlow(element) &&
            model.isViewElement(model.getTarget(element)) &&
            !model.isXOR(model.getInteractionContext(element), true);
    },
    function (flow, model) {
        var event = model.getSource(flow),
            id = model.toId(event),
            context = model.getInteractionContext(flow),
            target = model.getTarget(flow),
            ancestors = model.getAncestors(target),
            xorTargetsSet = model.getXORTargetSet(flow, context),
            // For each ViewContainer \ifml{\namexorvc_i} in the XOR targets set
            // of \ifml{\namenavflow} inside \ifmlinteractioncontext:
            partials = _.flatten(_.map(xorTargetsSet, function (xid) {
                var tid = id + '-Via-' + xid,
                    displaySet = model.getDisplaySet(flow, xid),
                    dids = _(displaySet).map(function (did) {
                        var topMostXORDescendants = model.getTopMostXORDescendants(did);
                        return _.first(_.intersection(topMostXORDescendants, ancestors));
                    }).filter().value();
                // For each element \ifmldisplayitem{i,j} in the display set of
                // \ifml{\namenavflow} inside \ifml{\namexorvc_i} such that there
                // exists a ViewContainer \ifmldisplayitem{i,k} that is the
                // topmost XOR descendant of \ifmldisplayitem{i,j} and ancestor
                // of \ifml{\nametarget}
                return _.map(dids, function (did) {
                    // an arc from \pcnevent{\namexorvc_i} to
                    // \pcninitialization{\formatdisplayitem{i,j}}{\formatdisplayitem{i,k}};
                    var cid = xid + '-Without-' + did,
                        aid = tid + '->' + cid;
                    return {
                        elements: [
                            {id: aid, type: 'pcn.Link', attributes: {tokens: 1}}
                        ],
                        relations: [
                            {type: 'pcn.Source', link: aid, source: tid},
                            {type: 'pcn.Target', link: aid, target: cid}
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
        // Given a NavigationFlow \ifml{\namenavflow}, associated with an event
        // \ifml{\nameevent} and with target \ifml{\nametarget}, whose interaction
        // context \ifmlinteractioncontext is a non XOR ViewContainer,
        return model.isNavigationFlow(element) &&
            model.isViewElement(model.getTarget(element)) &&
            !model.isXOR(model.getInteractionContext(element), true);
    },
    function (flow, model) {
        var event = model.getSource(flow),
            id = model.toId(event),
            context = model.getInteractionContext(flow),
            xorTargetsSet = model.getXORTargetSet(flow, context),
            // For each ViewContainer \ifml{\namexorvc_i} in the XOR targets set
            // of \ifml{\namenavflow} inside \ifmlinteractioncontext:
            partials = _.flatten(_.map(xorTargetsSet, function (xid) {
                var hideSet = model.getHideSet(flow, xid),
                    tid = id + '-Via-' + xid;
                // For each element \ifmlhideitem{i,j} of the Hide Set of
                // \ifml{\namenavflow} inside \ifml{\namexorvc_i},
                return _.map(hideSet, function (hid) {
                    var vnid = hid + '-View-n',
                        aid = tid + '->' + vnid;
                    return {
                        elements: [
                            // an arc from \pcnevent{\namexorvc_i} to \pcnnotview{\formathideitem{i,j}};
                            {id: aid, type: 'pcn.Link', attributes: {tokens: 1}}
                        ],
                        relations: [
                            // an arc from \pcnevent{\namexorvc_i}
                            {type: 'pcn.Source', link: aid, source: tid},
                            // to \pcnnotview{\formathideitem{i,j}};
                            {type: 'pcn.Target', link: aid, target: vnid}
                        ]
                    };
                });
            }));
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
