// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var almost = require('almost');

// A ViewContainer \ifml{\namechild} child of another ViewContainer \ifml{\nameparent} maps to:
// \begin{enumerate}
//   \item A place chart \pcn{\namechild} child of the place chart \pcn{\nameparent}.
//   \item Two bottom place charts \pcnview{\namechild} and \pcnnotview{\namechild} within \pcn{\namechild}.
//   \item An initialization arc from \pcn{\namechild} to \pcnview{\namechild}.
// \end{enumerate}

var model = [];

var element = [almost.createRule(
    function (element, model) {
        // A ViewContainer \ifml{\namechild} child of another ViewContainer \ifml{\nameparent} maps to:
        return model.isViewContainer(element); // Rule 2
    },
    function (container) {
        var id = container.id,
            vpid = id + '-View-p',
            vnid = id + '-View-n',
            iid = id + '->' + vpid,
            name = container.attributes.name,
            suffix = '_{' + name + '}';
        return {
            elements: [
                // A place chart \pcn{\namechild} child of the place chart \pcn{\nameparent}.
                {id: id, type: 'pcn.PlaceChart', attributes: {name: name}},
                // Two bottom place charts \pcnview{\namechild}
                {id: vpid, type: 'pcn.PlaceChart', attributes: {name: 'View' + suffix}},
                // and \pcnnotview{\namechild} within \pcn{\namechild}.
                {id: vnid, type: 'pcn.PlaceChart', attributes: {name: '\\overline{View}' + suffix}},
                // An initialization arc from \pcn{\namechild} to \pcnview{\namechild}.
                {id: iid, type: 'pcn.Link', attributes: {tokens: 1}}
            ],
            relations: [
                // A place chart \pcn{\namechild} child of the place chart \pcn{\nameparent}.
                // {type: 'pcn.Hierarchy', parent: pid, child: id}, // See 19
                // Two bottom place charts \pcnview{\namechild} and \pcnnotview{\namechild} within \pcn{\namechild}.
                {type: 'pcn.Hierarchy', parent: id, child: vpid},
                {type: 'pcn.Hierarchy', parent: id, child: vnid},
                // An initialization arc from \pcn{\namechild} to \pcnview{\namechild}.
                {type: 'pcn.Source', link: iid, source: id},
                {type: 'pcn.Target', link: iid, target: vpid}
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
