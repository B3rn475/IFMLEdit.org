// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    almost = require('almost');

// Given a NavigationFlow \ifml{\namenavflow} from an Event \ifml{\nameevent}
// associated with an Action \ifml{\nameaction} and with target
// \ifml{\nametarget}, whose Interaction Context \ifmlinteractioncontext is a
// non XOR ViewContainer, let \ifmlactionorigin be the Origin of
// \ifml{\nameaction}.
// \ifml{\nameaction} maps to:
// \begin{enumerate}
//  \item an arc from \pcnrunning{\nameaction} to \pcn{\nameevent};
//  \item An arc from \pcn{\nameevent} to \pcnnotrunning{\nameaction}, if
//        \ifml{\nametarget} is not an ancestor of \ifmlactionorigin;
//  \item For each element \ifml{\namexorvc_i} in the XOR targets set of
//        \ifml{\namenavflow} inside \ifmlinteractioncontext,
//        \ifml{\namenavflow} also maps to:
//        \begin{enumerate}
//          \item an arc from \pcnrunning{\nameaction} to
//                \pcnevent{\namexorvc_i};
//          \item An arc from \pcnevent{\namexorvc_i} to
//                \pcnnotrunning{\nameaction}, if \ifml{\nametarget} is not an
//                ancestor of \ifmlactionorigin.
//        \end{enumerate}
// \end{enumerate}


var model = [];

var element = [almost.createRule(
    function (element, model) {
        // Given a NavigationFlow \ifml{\namenavflow} from an Event \ifml{\nameevent}
        // associated with an Action \ifml{\nameaction} and with target
        // \ifml{\nametarget}, whose Interaction Context \ifmlinteractioncontext is a
        // non XOR ViewContainer
        return model.isNavigationFlow(element) &&
            model.isAction(model.getParent(model.getSource(element))) &&
            model.isViewElement(model.getTarget(element)) &&
            !model.isXOR(model.getInteractionContext(element), true);
    },
    function (flow, model) {
        var event = model.getSource(flow),
            id = model.toId(event),
            sid = model.getParentId(event),
            rpid = sid + '-Running-p',
            rid = rpid + '->' + id;
        return {
            elements: [
                // an arc from \pcnrunning{\nameaction} to \pcn{\nameevent};
                {id: rid, type: 'pcn.Link', attributes: {tokens: 1}}
            ],
            relations: [
                // an arc from \pcnrunning{\nameaction};
                {type: 'pcn.Source', link: rid, source: rpid},
                // to \pcn{\nameevent};
                {type: 'pcn.Target', link: rid, target: id}
            ]
        };
    }
), almost.createRule(
    function (element, model) {
        // Given a NavigationFlow \ifml{\namenavflow} from an Event \ifml{\nameevent}
        // associated with an Action \ifml{\nameaction} and with target
        // \ifml{\nametarget}, whose Interaction Context \ifmlinteractioncontext is a
        // non XOR ViewContainer
        if (!model.isNavigationFlow(element)) {
            return false;
        }
        var event = model.getSource(element),
            source = model.getParent(event),
            target = model.getTarget(element),
            origin;
        if (!(model.isAction(source) &&
            model.isViewElement(target) &&
            !model.isXOR(model.getInteractionContext(element), true))) {
            return false;
        }
        origin = model.getActionOrigin(source);
        // if \ifml{\nametarget} is not an ancestor of \ifmlactionorigin;
        return !(_.intersection(model.getAncestors(origin), [model.toId(target)]).length);
    },
    function (flow, model) {
        var event = model.getSource(flow),
            id = model.toId(event),
            sid = model.getParentId(event),
            rnid = sid + '-Running-n',
            aid = id + '->' + rnid;
        return {
            elements: [
                // an arc from \pcn{\nameevent} to \pcnnotrunning{\nameaction}
                {id: aid, type: 'pcn.Link', attributes: {tokens: 1}}
            ],
            relations: [
                // an arc from \pcn{\nameevent}
                {type: 'pcn.Source', link: aid, source: id},
                // to \pcnnotrunning{\nameaction}
                {type: 'pcn.Target', link: aid, target: rnid}
            ]
        };
    }
), almost.createRule(
    function (element, model) {
        // Given a NavigationFlow \ifml{\namenavflow} from an Event \ifml{\nameevent}
        // associated with an Action \ifml{\nameaction} and with target
        // \ifml{\nametarget}, whose Interaction Context \ifmlinteractioncontext is a
        // non XOR ViewContainer
        return model.isNavigationFlow(element) &&
            model.isAction(model.getParent(model.getSource(element))) &&
            model.isViewElement(model.getTarget(element)) &&
            !model.isXOR(model.getInteractionContext(element), true);
    },
    function (flow, model) {
        var event = model.getSource(flow),
            id = model.toId(event),
            sid = model.getParentId(event),
            context = model.getInteractionContext(flow),
            xorTargetsSet = model.getXORTargetSet(flow, context),
            // For each element \ifml{\namexorvc_i} in the XOR targets set of
            // \ifml{\namenavflow} inside \ifmlinteractioncontext
            partials = _.map(xorTargetsSet, function (xid) {
                var tid = id + '-Via-' + xid,
                    rpid = sid + '-Running-p',
                    rid = rpid + '->' + tid;
                return {
                    elements: [
                        // an arc from \pcnrunning{\nameaction} to \pcnevent{\namexorvc_i};
                        {id: rid, type: 'pcn.Link', attributes: {tokens: 1}}
                    ],
                    relations: [
                        // an arc from \pcnrunning{\nameaction}
                        {type: 'pcn.Source', link: rid, source: rpid},
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
        // associated with an Action \ifml{\nameaction} and with target
        // \ifml{\nametarget}, whose Interaction Context \ifmlinteractioncontext is a
        // non XOR ViewContainer
        if (!model.isNavigationFlow(element)) {
            return false;
        }
        var event = model.getSource(element),
            source = model.getParent(event),
            target = model.getTarget(element),
            origin;
        if (!(model.isAction(source) &&
            model.isViewElement(target) &&
            !model.isXOR(model.getInteractionContext(element), true))) {
            return false;
        }
        origin = model.getActionOrigin(source);
        // if \ifml{\nametarget} is not an ancestor of \ifmlactionorigin;
        return !(_.intersection(model.getAncestors(origin), [model.toId(target)]).length);
    },
    function (flow, model) {
        var event = model.getSource(flow),
            id = model.toId(event),
            sid = model.getParentId(event),
            context = model.getInteractionContext(flow),
            xorTargetsSet = model.getXORTargetSet(flow, context),
            // For each element \ifml{\namexorvc_i} in the XOR targets set of
            // \ifml{\namenavflow} inside \ifmlinteractioncontext
            partials = _.map(xorTargetsSet, function (xid) {
                var tid = id + '-Via-' + xid,
                    rnid = sid + '-Running-n',
                    aid = tid + '->' + rnid;
                return {
                    elements: [
                        // An arc from \pcnevent{\namexorvc_i} to \pcnnotrunning{\nameaction}
                        {id: aid, type: 'pcn.Link', attributes: {tokens: 1}}
                    ],
                    relations: [
                        // an arc from \pcnevent{\namexorvc_i} to
                        {type: 'pcn.Source', link: aid, source: tid},
                        // \pcnnotrunning{\nameaction},
                        {type: 'pcn.Target', link: aid, target: rnid}
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
