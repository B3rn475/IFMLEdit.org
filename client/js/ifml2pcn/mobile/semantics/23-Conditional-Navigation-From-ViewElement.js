// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    almost = require('almost');

// Given a NavigationFlow \ifml{\namenavflow} from an Event \ifml{\nameevent}
// associated with a ViewElement \ifml{\namesource} and with target
// \ifml{\nametarget}, whose Interaction Context \ifmlinteractioncontext is not
// a XOR ViewContainer.
// \ifml{\namenavflow} maps to:
// \begin{enumerate}
//  \item an arc from \pcnview{\namesource} to \pcn{\nameevent}; this denotes
//        that the source must be in view;
//  \item an arc from \pcn{\nameevent} to \pcnview{\namesource},
//        if \ifml{\nametarget} is not an ancestor of \ifml{\namesource};
//  \item For each element \ifml{\namexorvc_i} in the XOR targets set of
//        \ifml{\namenavflow} inside \ifmlinteractioncontext,
//        \ifml{\namenavflow} also maps to:
//        \begin{enumerate}
//          \item an arc from \pcnview{\namesource} to \pcnevent{\namexorvc_i};
//          \item an arc from \pcnevent{\namexorvc_i} to \pcnview{\namesource},
//                if \ifml{\nametarget} is not an ancestor of \ifml{\namesource};
//        \end{enumerate}
// \end{enumerate}

var model = [];

var element = [almost.createRule(
    function (element, model) {
        // Given a NavigationFlow \ifml{\namenavflow} from an Event \ifml{\nameevent}
        // associated with a ViewElement \ifml{\namesource} and with target
        // \ifml{\nametarget}, whose Interaction Context \ifmlinteractioncontext is not
        // a XOR ViewContainer.
        return model.isNavigationFlow(element) &&
            model.isViewElement(model.getParent(model.getSource(element))) &&
            model.isViewElement(model.getTarget(element)) &&
            !model.isXOR(model.getInteractionContext(element), true);
    },
    function (flow, model) {
        var event = model.getSource(flow),
            id = event.id,
            sid = model.getParentId(event),
            vpid = sid + '-View-p',
            rid = vpid + '->' + id;
        return {
            elements: [
                // an arc from \pcnview{\namesource} to \pcn{\nameevent};
                {id: rid, type: 'pcn.Link', attributes: {tokens: 1}}
            ],
            relations: [
                // an arc from \pcnview{\namesource}
                {type: 'pcn.Source', link: rid, source: vpid},
                // to \pcn{\nameevent};
                {type: 'pcn.Target', link: rid, target: id}
            ]
        };
    }
), almost.createRule(
    function (element, model) {
        // Given a NavigationFlow \ifml{\namenavflow} from an Event \ifml{\nameevent}
        // associated with a ViewElement \ifml{\namesource} and with target
        // \ifml{\nametarget}, whose Interaction Context \ifmlinteractioncontext is not
        // a XOR ViewContainer.
        if (!model.isNavigationFlow(element)) {
            return false;
        }
        var event = model.getSource(element),
            source = model.getParent(event),
            target = model.getTarget(element);
        if (!(model.isViewElement(source) &&
            model.isViewElement(target) &&
            !model.isXOR(model.getInteractionContext(element), true))) {
            return false;
        }
        // if \ifml{\nametarget} is not an ancestor of \ifml{\namesource};
        return !(_.intersection(model.getAncestors(source), [target.id]).length);
    },
    function (flow, model) {
        var event = model.getSource(flow),
            id = event.id,
            sid = model.getParentId(event),
            vpid = sid + '-View-p',
            aid = id + '->' + vpid;
        return {
            elements: [
                // an arc from \pcn{\nameevent} to \pcnview{\namesource},
                {id: aid, type: 'pcn.Link', attributes: {tokens: 1}}
            ],
            relations: [
                // an arc from \pcn{\nameevent}
                {type: 'pcn.Source', link: aid, source: id},
                // to \pcnview{\namesource},
                {type: 'pcn.Target', link: aid, target: vpid}
            ]
        };
    }
), almost.createRule(
    function (element, model) {
        // Given a NavigationFlow \ifml{\namenavflow} from an Event \ifml{\nameevent}
        // associated with a ViewElement \ifml{\namesource} and with target
        // \ifml{\nametarget}, whose Interaction Context \ifmlinteractioncontext is not
        // a XOR ViewContainer.
        return model.isNavigationFlow(element) &&
            model.isViewElement(model.getParent(model.getSource(element))) &&
            model.isViewElement(model.getTarget(element)) &&
            !model.isXOR(model.getInteractionContext(element), true);
    },
    function (flow, model) {
        var event = model.getSource(flow),
            id = event.id,
            sid = model.getParentId(event),
            context = model.getInteractionContext(flow),
            xorTargetsSet = model.getXORTargetSet(flow, context),
            // For each element \ifml{\namexorvc_i} in the XOR targets set of
            // \ifml{\namenavflow} inside \ifmlinteractioncontext
            partials = _.map(xorTargetsSet, function (xid) {
                var tid = id + '-Via-' + xid,
                    vpid = sid + '-View-p',
                    rid = vpid + '->' + tid;
                return {
                    elements: [
                        //an arc from \pcnview{\namesource} to \pcnevent{\namexorvc_i};
                        {id: rid, type: 'pcn.Link', attributes: {tokens: 1}}
                    ],
                    relations: [
                        // an arc from \pcnview{\namesource}
                        {type: 'pcn.Source', link: rid, source: vpid},
                        // to \pcnevent{\namexorvc_i};
                        {type: 'pcn.Target', link: rid, target: tid}
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
        // Given a NavigationFlow \ifml{\namenavflow} from an Event \ifml{\nameevent}
        // associated with a ViewElement \ifml{\namesource} and with target
        // \ifml{\nametarget}, whose Interaction Context \ifmlinteractioncontext is not
        // a XOR ViewContainer.
        if (!model.isNavigationFlow(element)) {
            return false;
        }
        var event = model.getSource(element),
            source = model.getParent(event),
            target = model.getTarget(element);
        if (!(model.isViewElement(source) &&
            model.isViewElement(target) &&
            !model.isXOR(model.getInteractionContext(element), true))) {
            return false;
        }
        // if \ifml{\nametarget} is not an ancestor of \ifml{\namesource};
        return !(_.intersection(model.getAncestors(source), [target.id]).length);
    },
    function (flow, model) {
        var event = model.getSource(flow),
            id = event.id,
            sid = model.getParentId(event),
            context = model.getInteractionContext(flow),
            xorTargetsSet = model.getXORTargetSet(flow, context),
            // For each element \ifml{\namexorvc_i} in the XOR targets set of
            // \ifml{\namenavflow} inside \ifmlinteractioncontext
            partials = _.map(xorTargetsSet, function (xid) {
                var tid = id + '-Via-' + xid,
                    vpid = sid + '-View-p',
                    aid = tid + '->' + vpid;
                return {
                    elements: [
                        // an arc from \pcnevent{\namexorvc_i} to \pcnview{\namesource},
                        {id: aid, type: 'pcn.Link', attributes: {tokens: 1}}
                    ],
                    relations: [
                        // an arc from \pcnevent{\namexorvc_i} to
                        {type: 'pcn.Source', link: aid, source: tid},
                        // \pcnview{\namesource},
                        {type: 'pcn.Target', link: aid, target: vpid}
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
