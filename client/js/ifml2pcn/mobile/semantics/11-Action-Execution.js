// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var almost = require('almost');

// Given an Action \ifml{\nameaction}, with an incoming NavigationFlow
// \ifml{\namenavflow}, let \ifmlactionorigin be the Origin of
// \ifml{\nameaction}.
// \ifml{\nameaction} maps to:
// \begin{enumerate}
//   \item a place chart \pcn{\nameaction} child of \pcnactionorigin.
//   \item Two place charts \pcnrunning{\nameaction} and
//     \pcnnotrunning{\nameaction} children of \pcn{\nameaction}.
//     \pcnrunning{\nameaction} is initialized by default from the parent.
//   \item An initialization arc from \pcnactionorigin to \pcnnotrunning{\nameaction}.
// \end{enumerate}

var model = [];

var element = [almost.createRule(
    function (element, model) {
        // Given an Action \ifml{\nameaction}, with an incoming NavigationFlow
        return model.isAction(element) && model.getInbounds(element).length;
    },
    function (action, model) {
        var id = action.id,
            // let \ifmlactionorigin be the Origin of \ifml{\nameaction}.
            oid = model.getActionOriginId(action),
            rpid = id + '-Running-p',
            rnid = id + '-Running-n',
            riid = id + '->' + rnid,
            aiid = oid + '->' + id,
            name = action.attributes.name,
            suffix = '_{' + name + '}';
        return {
            elements: [
                // a place chart \pcn{\nameaction} child of \pcnactionorigin.
                {id: id, type: 'pcn.PlaceChart', attributes: {name: name}},
                // Two place charts \pcnrunning{\nameaction}
                {id: rpid, type: 'pcn.PlaceChart', attributes: {name: 'Running' + suffix}},
                // and \pcnnotrunning{\nameaction} children of \pcn{\nameaction}.
                {id: rnid, type: 'pcn.PlaceChart', attributes: {name: '\\overline{Running}' + suffix}},
                // \pcnrunning{\nameaction} is initialized by default from the parent.
                {id: riid, type: 'pcn.Link', attributes: {tokens: 1}},
                // An initialization arc from \pcnactionorigin to \pcnnotrunning{\nameaction}.
                {id: aiid, type: 'pcn.Link', attributes: {tokens: 1}}
            ],
            relations: [
                // a place chart \pcn{\nameaction} child of \pcnactionorigin.
                {type: 'pcn.Hierarchy', parent: oid, child: id},
                // Two place charts \pcnrunning{\nameaction} and \pcnnotrunning{\nameaction} children of \pcn{\nameaction}.
                {type: 'pcn.Hierarchy', parent: id, child: rpid},
                {type: 'pcn.Hierarchy', parent: id, child: rnid},
                // \pcnrunning{\nameaction} is initialized by default from the parent.
                {type: 'pcn.Source', link: riid, source: id},
                {type: 'pcn.Target', link: riid, target: rpid},
                // An initialization arc from \pcnactionorigin to \pcnnotrunning{\nameaction}.
                {type: 'pcn.Source', link: aiid, source: oid},
                {type: 'pcn.Target', link: aiid, target: rnid},
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
