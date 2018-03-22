// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    almost = require('almost');

// Given a NavigationFlow \ifml{\namenavflow}, from an Event \ifml{\nameevent}
// associated with an Action \ifml{\nameaction} and with target \ifml{\nametarget},
// whose Interaction Context is a XOR ViewContainer \ifmlinteractioncontext;
// let \ifmlactionorigin be the Origin of the Action \ifml{\nameaction} and
// \ifml{\namechild} be the child of \ifmlinteractioncontext that is
// co-displayed ancestor of \ifmlactionorigin inside \ifmlinteractioncontext;
// \ifml{\namenavflow} maps to:
// \begin{enumerate}
//  \item an arc from \pcnrunning{\nameaction} to \pcn{\nameevent}.
//  \item An arc from \pcn{\namechild} to \pcn{\nameevent} and from
//        \pcn{\nameevent} to \pcnnotview{\namechild}, if \pcn{\nametarget} is
//        not an ancestor of \pcnactionorigin;
// \end{enumerate}

var model = [];

var element = [almost.createRule(
    function (element, model) {
        // Given a NavigationFlow \ifml{\namenavflow}, from an Event \ifml{\nameevent}
        // associated with an Action \ifml{\nameaction} and with target \ifml{\nametarget},
        // whose Interaction Context is a XOR ViewContainer \ifmlinteractioncontext;
        return model.isNavigationFlow(element) &&
            model.isAction(model.getParent(model.getSource(element))) && // source
            model.isViewElement(model.getTarget(element)) && // target
            model.isXOR(model.getInteractionContext(element), true);
    },
    function (flow, model) {
        var event = model.getSource(flow),
            id = event.id,
            aid = model.getParentId(event),
            rpid = aid + '-Running-p',
            rid = rpid + '->' + id;
        return {
            elements: [
                // an arc from \pcnrunning{\nameaction} to \pcn{\nameevent}.
                {id: rid, type: 'pcn.Link', attributes: {tokens: 1}}
            ],
            relations: [
                // an arc from \pcnrunning{\nameaction}
                {type: 'pcn.Source', link: rid, source: rpid},
                // to \pcn{\nameevent}.
                {type: 'pcn.Target', link: rid, target: id}
            ]
        };
    }
), almost.createRule(
    function (element, model) {
        // Given a NavigationFlow \ifml{\namenavflow}, from an Event \ifml{\nameevent}
        // associated with an Action \ifml{\nameaction} and with target \ifml{\nametarget},
        // whose Interaction Context is a XOR ViewContainer \ifmlinteractioncontext;
        if (!model.isNavigationFlow(element)) {
            return false;
        }
        var event = model.getSource(element),
            source = model.getParentId(event),
            target = model.getTargetId(element);
        if (!(model.isAction(source) && model.isViewElement(target) &&
            model.isXOR(model.getInteractionContext(element), true))) {
            return false;
        }
        // if \pcn{\nametarget} is not an ancestor of \pcnactionorigin;
        return _.intersection(model.getAncestors(model.getActionOrigin(source)), [target.id]).length;
    },
    function (flow, model) {
        var event = model.getSource(flow),
            id = event.id,
            action = model.getParent(event),
            context = model.getInteractionContext(flow),
            // let \ifmlactionorigin be the Origin of the Action \ifml{\nameaction}
            origin = model.getActionOrigin(action),
            // and \ifml{\namechild} be the child of \ifmlinteractioncontext that is
            // co-displayed ancestor of \ifmlactionorigin inside \ifmlinteractioncontext;
            cid = model.getCoDisplayedAncestorId(origin, context),
            vnid = cid + '-View-n',
            rcid = cid + '->' + id,
            avnid = id + '->' + vnid;
        return {
            elements: [
                // An arc from \pcn{\namechild} to \pcn{\nameevent}
                {id: rcid, type: 'pcn.Link', attributes: {tokens: 1}},
                // and from \pcn{\nameevent} to \pcnnotview{\namechild}
                {id: avnid, type: 'pcn.Link', attributes: {tokens: 1}}
            ],
            relations: [
                // An arc from \pcn{\namechild}
                {type: 'pcn.Source', link: rcid, source: cid},
                // to \pcn{\nameevent}
                {type: 'pcn.Target', link: rcid, target: id},
                // and from \pcn{\nameevent}
                {type: 'pcn.Source', link: avnid, source: id},
                // to \pcnnotview{\namechild}
                {type: 'pcn.Target', link: avnid, target: vnid},
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
