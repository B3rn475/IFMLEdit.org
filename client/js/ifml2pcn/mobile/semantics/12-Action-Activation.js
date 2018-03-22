// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var almost = require('almost');

// Given an Action \ifml{\nameaction}, a NavigationFlow \ifml{\namenavflow}
// targeting \ifml{\nameaction} and starting from an Event \ifml{\nameevent}
// related to the ViewElement \ifml{\namevc}.
// \ifml{\namenavflow} maps to a transition \pcn{\nameevent} which removes and
// adds a token from \pcn{\nameaction} and \pcnview{\namevc}.

var model = [];

var element = [almost.createRule(
    function (element, model) {
        // Given an Action \ifml{\nameaction}, a NavigationFlow \ifml{\namenavflow} targeting \ifml{\nameaction}
        return model.isNavigationFlow(element) && model.isAction(model.getTarget(element));
    },
    function (flow, model) {
        // Given an Action \ifml{\nameaction}, a NavigationFlow \ifml{\namenavflow} targeting \ifml{\nameaction}
        // and starting from an Event \ifml{\nameevent}
        var event = model.getSource(flow),
            id = event.id,
            aid = model.getTargetId(flow),
            name = event.attributes.name,
        // related to the ViewElement \ifml{\namevc}.
            vid = model.getParentId(event) + '-View-p',
            raid = aid + '->' + id,
            aaid = id + '->' + aid,
            rvid = vid + '->' + id,
            avid = id + '->' + vid;
        return {
            elements: [
                // a transition \pcn{\nameevent}
                {id: id, type: 'pcn.Transition', attributes: {name: name}},
                // which removes and adds a token from \pcn{\nameaction}
                {id: raid, type: 'pcn.Link', attributes: {tokens: 1}},
                {id: aaid, type: 'pcn.Link', attributes: {tokens: 1}},
                // and \pcnview{\namevc}.
                {id: rvid, type: 'pcn.Link', attributes: {tokens: 1}},
                {id: avid, type: 'pcn.Link', attributes: {tokens: 1}}
            ],
            relations: [
                // a transition \pcn{\nameevent} which removes and adds a token from \pcn{\nameaction}
                {type: 'pcn.Source', link: raid, source: aid},
                {type: 'pcn.Target', link: raid, target: id},
                {type: 'pcn.Source', link: aaid, source: id},
                {type: 'pcn.Target', link: aaid, target: aid},
                // and \pcnview{\namevc}.
                {type: 'pcn.Source', link: rvid, source: vid},
                {type: 'pcn.Target', link: rvid, target: id},
                {type: 'pcn.Source', link: avid, source: id},
                {type: 'pcn.Target', link: avid, target: vid}
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
