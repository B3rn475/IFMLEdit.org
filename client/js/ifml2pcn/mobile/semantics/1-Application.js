// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var almost = require('almost');

// The mapping of an IFML model produces a PCN that contains a \pcn{Waiting}
// and a \pcnnot{Waiting} place, an \pcn{Application} top place chart with two
// children \pcnview{Application} and \pcnnotview{Application}.
// \pcnview{Application} is initialized by default from the parent.
// The PCN also contains an \pcn{open} transition, which moves a token from
// \pcn{Waiting} and \pcn{Application} to \pcnnot{Waiting} and
// \pcn{Application}, and a \pcn{close} transition, which moves a token from
// \pcnnot{Waiting} and \pcn{Application} to \pcn{Waiting} and
// \pcnnotview{Application}.

var model = [almost.createRule(
    almost.Rule.always,
    function () {
        return {
            elements: [
                // The mapping of an IFML model produces a PCN that contains a \pcn{Waiting}
                {id: 'Waiting-p', type: 'pcn.PlaceChart', attributes: {name: 'Waiting'}},
                // and a \pcnnot{Waiting} place,
                {id: 'Waiting-n', type: 'pcn.PlaceChart', attributes: {name: '\\overline{Waiting}'}},
                // an \pcn{Application} top place chart
                {id: 'Application', type: 'pcn.PlaceChart', attributes: {name: 'Application'}},
                // with two children \pcnview{Application} and \pcnnotview{Application}.
                {id: 'Application-View-p', type: 'pcn.PlaceChart', attributes: {name: 'View_{Application}'}},
                {id: 'Application-View-n', type: 'pcn.PlaceChart', attributes: {name: '\\overline{View}_{Application}'}},
                // \pcnview{Application} is initialized by default from the parent.
                {id: 'Application->Application-View-p', type: 'pcn.Link', attributes: {tokens: 1}},
                // The PCN also contains an \pcn{open} transition,
                {id: 'Open', type: 'pcn.Transition', attributes: {name: 'open'}},
                // which moves a token from \pcn{Waiting} and \pcn{Application}
                {id: 'Waiting-p->Open', type: 'pcn.Link', attributes: {tokens: 1}},
                {id: 'Application->Open', type: 'pcn.Link', attributes: {tokens: 1}},
                // to \pcnnot{Waiting} and \pcn{Application},
                {id: 'Open->Waiting-n', type: 'pcn.Link', attributes: {tokens: 1}},
                {id: 'Open->Application', type: 'pcn.Link', attributes: {tokens: 1}},
                // and a \pcn{close} transition,
                {id: 'Close', type: 'pcn.Transition', attributes: {name: 'close'}},
                // which moves a token from \pcnnot{Waiting} and \pcn{Application}
                {id: 'Waiting-n->Close', type: 'pcn.Link', attributes: {tokens: 1}},
                {id: 'Application->Close', type: 'pcn.Link', attributes: {tokens: 1}},
                // to \pcn{Waiting} and \pcnnotview{Application}.
                {id: 'Close->Waiting-p', type: 'pcn.Link', attributes: {tokens: 1}},
                {id: 'Close->Application-View-n', type: 'pcn.Link', attributes: {tokens: 1}}
            ],
            relations: [
                // The mapping of an IFML model produces a PCN that contains a \pcn{Waiting}
                // and a \pcnnot{Waiting} place, an \pcn{Application} top place chart
                // with two children \pcnview{Application} and \pcnnotview{Application}.
                {type: 'pcn.Hierarchy', parent: 'Application', child: 'Application-View-p'},
                {type: 'pcn.Hierarchy', parent: 'Application', child: 'Application-View-n'},
                // \pcnview{Application} is initialized by default from the parent.
                {type: 'pcn.Source', link: 'Application->Application-View-p', source: 'Application'},
                {type: 'pcn.Target', link: 'Application->Application-View-p', target: 'Application-View-p'},
                // The PCN also contains an \pcn{open} transition, which moves
                // a token from \pcn{Waiting}
                {type: 'pcn.Source', link: 'Waiting-p->Open', source: 'Waiting-p'},
                {type: 'pcn.Target', link: 'Waiting-p->Open', target: 'Open'},
                // and \pcn{Application}
                {type: 'pcn.Source', link: 'Application->Open', source: 'Application'},
                {type: 'pcn.Target', link: 'Application->Open', target: 'Open'},
                // to \pcnnot{Waiting}
                {type: 'pcn.Source', link: 'Open->Waiting-n', source: 'Open'},
                {type: 'pcn.Target', link: 'Open->Waiting-n', target: 'Waiting-n'},
                //and \pcn{Application},
                {type: 'pcn.Source', link: 'Open->Application', source: 'Open'},
                {type: 'pcn.Target', link: 'Open->Application', target: 'Application'},
                // and a \pcn{close} transition, which moves a token from
                // \pcnnot{Waiting}
                {type: 'pcn.Source', link: 'Waiting-n->Close', source: 'Waiting-n'},
                {type: 'pcn.Target', link: 'Waiting-n->Close', target: 'Close'},
                // and \pcn{Application}
                {type: 'pcn.Source', link: 'Application->Close', source: 'Application'},
                {type: 'pcn.Target', link: 'Application->Close', target: 'Close'},
                // to \pcn{Waiting}
                {type: 'pcn.Source', link: 'Close->Waiting-p', source: 'Close'},
                {type: 'pcn.Target', link: 'Close->Waiting-p', target: 'Waiting-p'},
                // and \pcnnotview{Application}.
                {type: 'pcn.Source', link: 'Close->Application-View-n', source: 'Close'},
                {type: 'pcn.Target', link: 'Close->Application-View-n', target: 'Application-View-n'},
            ]
        };
    }
), almost.createRule( // Default Marking
    almost.Rule.always,
    function () {
        return {
            elements: [
                {id: 'Waiting-p', attributes: {tokens: 1}},
                {id: 'Application-View-n', attributes: {tokens: 1}}
            ]
        };
    }
)];

var element = [];

var relation = [];

exports.rules = {
    model: model,
    element: element,
    relation: relation
};
