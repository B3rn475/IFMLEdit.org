// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    almost = require('almost');

// Given a NavigationFlow \ifml{\namenavflow} from an event \ifml{\nameevent}
// with target \ifml{\nametarget} associated with a ViewElement
// \ifml{\namesource}, whose interaction context \ifmlinteractioncontext[] is a
// XOR ViewContainer, let \ifml{\nameancestor} be the co-displayed ancestor of
// \ifml{\namesource} inside \ifmlinteractioncontext.
// Then \ifml{\nameevent} (additionally) maps to:
// \begin{enumerate}
//  \item An arc from \pcnview{\namesource} to \pcn{\nameevent};
//  \item An arc from \pcn{\nameancestor} to \pcn{\nameevent};
//  \item An arc from \pcn{\nameevent} to \pcnnotview{\nameancestor}, if \ifml{\nametarget} is not an ancestor of \ifml{\namesource};
// \end{enumerate}

var model = [];

var element = [almost.createRule(
    function (element, model) {
        // Given a NavigationFlow \ifml{\namenavflow} from an event \ifml{\nameevent}
        // with target \ifml{\nametarget} associated with a ViewElement
        // \ifml{\namesource}, whose interaction context \ifmlinteractioncontext[] is a
        // XOR ViewContainer
        return model.isNavigationFlow(element) &&
            model.isViewElement(model.getParent(model.getSource(element))) && // source
            model.isViewElement(model.getTarget(element)) && // target
            model.isXOR(model.getInteractionContext(element), true);
    },
    function (flow, model) {
        var event = model.getSource(flow),
            id = event.id,
            sid = model.getParentId(event),
            // let \ifml{\nameancestor} be the co-displayed ancestor of \ifml{\namesource} inside \ifmlinteractioncontext.
            context = model.getInteractionContext(flow),
            aid = model.getCoDisplayedAncestorId(sid, context),
            vpid = sid + '-View-p',
            rvpid = vpid + '->' + id,
            raid = aid + '->' + id;
        return {
            elements: [
                // An arc from \pcnview{\namesource} to \pcn{\nameevent};
                {id: rvpid, type: 'pcn.Link', attributes: {tokens: 1}},
                // An arc from \pcn{\nameancestor} to \pcn{\nameevent};
                {id: raid, type: 'pcn.Link', attributes: {tokens: 1}}
            ],
            relations: [
                // An arc from \pcnview{\namesource}
                {type: 'pcn.Source', link: rvpid, source: vpid},
                // to \pcn{\nameevent};
                {type: 'pcn.Target', link: rvpid, target: id},
                // An arc from \pcn{\nameancestor}
                {type: 'pcn.Source', link: raid, source: aid},
                // to \pcn{\nameevent};
                {type: 'pcn.Target', link: raid, target: id}
            ]
        };
    }
), almost.createRule(
    function (element, model) {
        // Given a NavigationFlow \ifml{\namenavflow} from an event \ifml{\nameevent}
        // with target \ifml{\nametarget} associated with a ViewElement
        // \ifml{\namesource}, whose interaction context \ifmlinteractioncontext[] is a
        // XOR ViewContainer
        if (!model.isNavigationFlow(element)) {
            return false;
        }
        var eid = model.getSource(element),
            sid = model.getParent(eid),
            tid = model.getTarget(element);
        if (!(model.isViewElement(sid) && model.isViewElement(tid) &&
            model.isXOR(model.getInteractionContext(element), true))) {
            return false;
        }
        // if \ifml{\nametarget} is not an ancestor of \ifml{\namesource};
        return _.intersection(model.getAncestors(sid), [tid]).length;
    },
    function (flow, model) {
        var event = model.getSource(flow),
            id = event.id,
            sid = model.getParentId(model.getParent(event)),
            // let \ifml{\nameancestor} be the co-displayed ancestor of \ifml{\namesource} inside \ifmlinteractioncontext.
            context = model.getInteractionContext(flow),
            aid = model.getCoDisplayedAncestorId(sid, context),
            vnid = aid + '-View-n',
            avnid = id + '->' + vnid;
        return {
            elements: [
                // An arc from \pcn{\nameevent} to \pcnnotview{\nameancestor}
                {id: avnid, type: 'pcn.Link', attributes: {tokens: 1}},
            ],
            relations: [
                // An arc from \pcn{\nameevent}
                {type: 'pcn.Source', link: avnid, source: id},
                // to \pcnnotview{\nameancestor}
                {type: 'pcn.Target', link: avnid, target: avnid}
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
