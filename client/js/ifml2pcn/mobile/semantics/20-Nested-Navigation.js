// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    almost = require('almost');

// Given a NavigationFlow \ifml{\namenavflow} associated with an event
// \ifml{\nameevent} and with target \ifml{\nametarget}, whose interaction
// context \ifmlinteractioncontext[] is a XOR ViewContainer,
// \ifml{\namenavflow} maps to:
// \begin{enumerate}
//  \item A transition \pcn{\nameevent} that removes a token from the place
//        chart of the co-displayed ancestor of \ifml{\nametarget} child of
//        \ifmlinteractioncontext[]; this empties all the place charts contained
//        within \ifmlinteractioncontext[].
//  \item For each ViewContainer \ifml{\namexorvc_i} in the XOR targets set of
//        \ifml{\namenavflow} inside \ifmlinteractioncontext, an arc from
//        \pcn{\nameevent} to \pcnview{\namexorvc_i};
//  \item For each element \ifmlhideitem{i} in the hide set of
//        \ifml{\namenavflow} inside \ifmlinteractioncontext[], an arc from
//        \pcn{\nameevent} to \pcnnotview{\formathideitem{i}};
//  \item For each element \ifmldisplayitem{i} in the display set of
//        \ifml{\namenavflow} inside \ifmlinteractioncontext :
//      \begin{enumerate}
//          \item an arc from \pcn{\nameevent} to \pcndisplayitem{i}, if there
//                does not exist a ViewContainer topmost XOR descendant of
//                \ifmldisplayitem{i} and ancestor of \ifml{\nametarget};
//          \item An arc from \pcn{\nameevent} to
//                \pcninitialization{\ifmldisplayitem{i}}{\nameancestor_j}, if there
//                exists a ViewContainer \ifml{\nameancestor_j} topmost XOR
//                descendant of \ifmldisplayitem{i} and ancestor of
//                \ifml{\nametarget};
//      \end{enumerate}
// \end{enumerate}

var model = [];

var element = [almost.createRule(
    function (element, model) {
        // Given a NavigationFlow \ifml{\namenavflow} associated with an event
        // \ifml{\nameevent} and with target \ifml{\nametarget}, whose interaction
        // context \ifmlinteractioncontext[] is a XOR ViewContainer, \ifml{\namenavflow} maps to:
        return model.isNavigationFlow(element) && model.isViewElement(model.getTarget(element)) &&
            model.isXOR(model.getInteractionContext(element), true);
    },
    function (flow, model) {
        var event = model.getSource(flow),
            id = event.id,
            target = model.getTarget(flow),
            context = model.getInteractionContext(flow),
            caid = model.getCoDisplayedAncestorId(target, context),
            rcaid = caid + '->' + id,
            name = event.attributes.name;
        return {
            elements: [
                // A transition \pcn{\nameevent}
                {id: id, type: 'pcn.Transition', attributes: {name: name}},
                // that removes a token from the place chart of the co-displayed
                // ancestor of \ifml{\nametarget} child of \ifmlinteractioncontext[];
                {id: rcaid, type: 'pcn.Link', attributes: {tokens: 1}}
            ],
            relations: [
                // that removes a token from the place chart of the co-displayed
                // ancestor of \ifml{\nametarget} child of \ifmlinteractioncontext[];
                {type: 'pcn.Source', link: rcaid, source: caid},
                {type: 'pcn.Target', link: rcaid, target: id},
            ]
        };
    }
), almost.createRule(
    function (element, model) {
        // Given a NavigationFlow \ifml{\namenavflow} associated with an event
        // \ifml{\nameevent} and with target \ifml{\nametarget}, whose interaction
        // context \ifmlinteractioncontext[] is a XOR ViewContainer, \ifml{\namenavflow} maps to:
        return model.isNavigationFlow(element) && model.isViewElement(model.getTarget(element)) &&
            model.isXOR(model.getInteractionContext(element), true);
    },
    function (flow, model) {
        var event = model.getSource(flow),
            id = event.id,
            context = model.getInteractionContext(flow),
            xorTargetsSet = model.getXORTargetSet(flow, context),
        // For each ViewContainer \ifml{\namexorvc_i} in the XOR targets set of \ifml{\namenavflow} inside \ifmlinteractioncontext
            partials = _.map(xorTargetsSet, function (xid) {
                var vpid = xid + '-View-p',
                    aid = id + '->' + vpid;
                return {
                    elements: [
                        // an arc from \pcn{\nameevent} to \pcnview{\namexorvc_i};
                        {id: aid, type: 'pcn.Link', attributes: {tokens: 1}}
                    ],
                    relations: [
                        // an arc from \pcn{\nameevent}
                        {type: 'pcn.Source', link: aid, source: id},
                        // to \pcnview{\namexorvc_i};
                        {type: 'pcn.Target', link: aid, target: vpid},
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
        // Given a NavigationFlow \ifml{\namenavflow} associated with an event
        // \ifml{\nameevent} and with target \ifml{\nametarget}, whose interaction
        // context \ifmlinteractioncontext[] is a XOR ViewContainer, \ifml{\namenavflow} maps to:
        return model.isNavigationFlow(element) && model.isViewElement(model.getTarget(element)) &&
            model.isXOR(model.getInteractionContext(element), true);
    },
    function (flow, model) {
        var event = model.getSource(flow),
            id = event.id,
            context = model.getInteractionContext(flow),
            hideSet = model.getHideSet(flow, context),
        // For each element \ifmlhideitem{i} in the hide set of \ifml{\namenavflow} inside \ifmlinteractioncontext[],
            partials = _.map(hideSet, function (hid) {
                var vnid = hid + '-View-n',
                    aid = id + '->' + vnid;
                return {
                    elements: [
                        // an arc from \pcn{\nameevent} to \pcnnotview{\formathideitem{i}};
                        {id: aid, type: 'pcn.Link', attributes: {tokens: 1}}
                    ],
                    relations: [
                        // an arc from \pcn{\nameevent}
                        {type: 'pcn.Source', link: aid, source: id},
                        // to \pcnnotview{\formathideitem{i}};
                        {type: 'pcn.Target', link: aid, target: vnid},
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
        // Given a NavigationFlow \ifml{\namenavflow} associated with an event
        // \ifml{\nameevent} and with target \ifml{\nametarget}, whose interaction
        // context \ifmlinteractioncontext[] is a XOR ViewContainer, \ifml{\namenavflow} maps to:
        return model.isNavigationFlow(element) && model.isViewElement(model.getTarget(element)) &&
            model.isXOR(model.getInteractionContext(element), true);
    },
    function (flow, model) {
        var event = model.getSource(flow),
            id = event.id,
            target = model.getTarget(flow),
            context = model.getInteractionContext(flow),
            displaySet = model.getDisplaySet(flow, context),
            // For each element \ifmldisplayitem{i} in the display set of \ifml{\namenavflow} inside \ifmlinteractioncontext
            targetAncestors = model.getAncestors(target),
            partials = _.map(displaySet, function (did) {
                // - an arc from \pcn{\nameevent} to \pcndisplayitem{i}, if
                // there does not exist a ViewContainer topmost XOR descendant
                // of \ifmldisplayitem{i} and ancestor of \ifml{\nametarget};
                // -  An arc from \pcn{\nameevent} to
                // \pcninitialization{\ifmldisplayitem{i}}{\nameancestor_j}, if there
                // exists a ViewContainer \ifml{\nameancestor_j} topmost XOR
                // descendant of \ifmldisplayitem{i} and ancestor of
                // \ifml{\nametarget};
                var topMostXORDescendants = model.getTopMostXORDescendants(did),
                    cid = _.first(_.intersection(topMostXORDescendants, targetAncestors)),
                    tid = cid ? (did + '-Without-' + cid) : did,
                    aid = id + '->' + tid;
                return {
                    elements: [
                        {id: aid, type: 'pcn.Link', attributes: {tokens: 1}}
                    ],
                    relations: [
                        {type: 'pcn.Source', link: aid, source: id},
                        {type: 'pcn.Target', link: aid, target: tid},
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
