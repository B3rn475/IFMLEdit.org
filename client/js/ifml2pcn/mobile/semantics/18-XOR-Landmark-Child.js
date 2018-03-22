// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    almost = require('almost');

// The presence of the \textit{landmark} property of a ViewContainer
// \ifml{\namechild} child of a XOR ViewContainer \ifml{\namexorvc} maps to a
// transition \pcnlandmark{\namechild1} that moves a token from \pcn{\namexorvc}
// and \pcnview{\namexorvc} to \pcnview{\namexorvc} and \pcn{\namechild}.
// For each ViewContainer \ifml{\namechild_i} child of \ifml{\namexorvc}
// different from \ifml{\namechild}, the \pcnlandmark{\namechild} transition
// adds a token to \pcnnotview{\namechild_i}.

var model = [];

var element = [almost.createRule(
    function (element, model) {
        // The presence of the \textit{landmark} property of a ViewContainer
        // \ifml{\namechild} child of a XOR ViewContainer \ifml{\namexorvc} maps to
        return model.isViewContainer(element) && model.isLandmark(element) && model.isXOR(model.getParent(element), true); // Rule 5
    },
    function (container, model) {
        var id = model.toId(container),
            tid = id + '-Landmark',
            pid = model.getParentId(element, 'Application'), // Rule 5
            vid = pid + '-View-p',
            rpid = pid + '->' + tid,
            rvid = vid + '->' + tid,
            avid = tid + '->' + vid,
            aid = tid + '->' + id,
            name = container.name,
            suffix = '_{' + name + '}';
        return {
            elements: [
                // a transition \pcnlandmark{\namechild1}
                {id: tid, type: 'pcn.Transition', attributes: {name: 'Landmark' + suffix}},
                // that moves a token from \pcn{\namexorvc}
                {id: rpid, type: 'pcn.Link', attributes: {tokens: 1}},
                // and \pcnview{\namexorvc}
                {id: rvid, type: 'pcn.Link', attributes: {tokens: 1}},
                // to \pcnview{\namexorvc}
                {id: avid, type: 'pcn.Link', attributes: {tokens: 1}},
                // and \pcn{\namechild}.
                {id: aid, type: 'pcn.Link', attributes: {tokens: 1}},
            ],
            relations: [
                // a transition \pcnlandmark{\namechild1}
                // that moves a token from \pcn{\namexorvc}
                {type: 'pcn.Source', link: rpid, source: pid},
                {type: 'pcn.Target', link: rpid, target: tid},
                // and \pcnview{\namexorvc}
                {type: 'pcn.Source', link: rvid, source: vid},
                {type: 'pcn.Target', link: rvid, target: tid},
                // to \pcnview{\namexorvc}
                {type: 'pcn.Source', link: avid, source: tid},
                {type: 'pcn.Target', link: avid, target: vid},
                // and \pcn{\namechild}.
                {type: 'pcn.Source', link: aid, source: tid},
                {type: 'pcn.Target', link: aid, target: id},
            ]
        };
    }
), almost.createRule(
    function (element, model) {
        // The presence of the \textit{landmark} property of a ViewContainer
        // \ifml{\namechild} child of a XOR ViewContainer \ifml{\namexorvc} maps to
        return model.isViewContainer(element) && model.isLandmark(element) && model.isXOR(model.getParent(element));
    },
    function (container, model) {
        var id = model.toId(container),
            tid = id + '-Landmark',
            parent = model.getParent(element),
            // For each ViewContainer \ifml{\namechild_i} child of \ifml{\namexorvc}
            // different from \ifml{\namechild}
            siblings = _.without(model.getChildren(parent), id);
        return _.map(siblings, function (sid) {
            var vid = sid + '-View-p',
                lid = tid + '->' + vid;
            return {
                elements: [
                    // the \pcnlandmark{\namechild} transition adds a token to \pcnnotview{\namechild_i}.
                    {id: lid, type: 'pcn.Link', attributes: {tokens: 1}}
                ],
                relations: [
                    {type: 'pcn.Source', link: lid, source: tid},
                    {type: 'pcn.Target', link: lid, target: vid}
                ]
            };
        });
    }
)];

var relation = [];

exports.rules = {
    model: model,
    element: element,
    relation: relation
};
