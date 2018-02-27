// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    utils = require('almost-joint').utils,
    ifml = require('./').ifml,
    almost = require('almost'),
    Rule = almost.Rule,
    createRule = almost.createRule,
    core = require('almost-core'),
    createTransformer = require('almost').createTransformer,
    AException = almost.Exception;

var elementRules = [
    createRule(
        function (element) {
            return ['ifml.ViewContainer', 'ifml.ViewComponent', 'ifml.Event', 'ifml.Action'].includes(element.type);
        },
        function (element) {
            return {
                id: element.id,
                position: element.metadata.graphics.position
            };
        }
    ),
    createRule(
        function (element) {
            return ['ifml.ViewContainer', 'ifml.ViewComponent', 'ifml.Action'].includes(element.type);
        },
        function (element) {
            return {
                id: element.id,
                size: element.metadata.graphics.size
            };
        }
    ),
    createRule(
        function (element) {
            return ['ifml.ViewContainer', 'ifml.ViewComponent', 'ifml.Event', 'ifml.Action', 'ifml.NavigationFlow', 'ifml.DataFlow'].includes(element.type) &&
                element.metadata.statistics;
        },
        function (element) {
            return {
                id: element.id,
                statistics: element.metadata.statistics.slice()
            };
        }
    ),
    createRule(
        function (element) {
            return ['ifml.NavigationFlow', 'ifml.DataFlow'].includes(element.type)
                && element.metadata.graphics && element.metadata.graphics.vertices;
        },
        function (element) {
            return {
                id: element.id,
                vertices: element.metadata.graphics.vertices
            };
        }
    ),
    createRule(
        function (element) {
            return element.type === 'ifml.Event';
        },
        function (element) {
            return {
                id: element.id,
                name: {
                    text: element.attributes.name,
                    horizontal: element.metadata.graphics.name.horizontal,
                    vertical: element.metadata.graphics.name.vertical
                }
            };
        }
    ),
    createRule(
        function (element) {
            return element.type === 'ifml.Action'
                && element.metadata.graphics.parent;
        },
        function (element) {
            return {
                id: element.metadata.graphics.parent,
                embeds: element.id
            };
        }
    ),
    createRule(
        function (element) {
            return element.type === 'ifml.ViewContainer';
        },
        function (element) {
            return {
                id: element.id,
                type: element.type,
                name: element.attributes.name,
                'default': element.attributes.default,
                landmark: element.attributes.landmark,
                xor: element.attributes.xor
            };
        }
    ),
    createRule(
        function (element) {
            return element.type === 'ifml.ViewComponent';
        },
        function (element) {
            return {
                id: element.id,
                type: element.type,
                name: element.attributes.name,
                stereotype: element.attributes.stereotype,
                size: element.metadata.graphics.size,
                fields: (element.attributes.fields && element.attributes.fields.slice()) || []
            };
        }
    ),
    createRule(
        function (element) {
            return element.type === 'ifml.ViewComponent' && ['list', 'details'].includes(element.attributes.stereotype);
        },
        function (element) {
            return {
                id: element.id,
                collection: element.attributes.collection || ''
            };
        }
    ),
    createRule(
        function (element) {
            return element.type === 'ifml.ViewComponent' && element.attributes.stereotype === 'list';
        },
        function (element) {
            return {
                id: element.id,
                filters: (element.attributes.filters && element.attributes.filters.slice()) || []
            };
        }
    ),
    createRule(
        function (element) {
            return element.type === 'ifml.Event';
        },
        function (element) {
            return {
                id: element.id,
                type: element.type
            };
        }
    ),
    createRule(
        function (element) {
            return element.type === 'ifml.Action';
        },
        function (element) {
            return {
                id: element.id,
                type: element.type,
                name: element.attributes.name,
                results: (element.attributes.results && element.attributes.results.slice()) || [],
                parameters: (element.attributes.parameters && element.attributes.parameters.slice()) || []
            };
        }
    ),
    createRule(
        function (element) {
            return ['ifml.DataFlow', 'ifml.NavigationFlow'].includes(element.type);
        },
        function (element) {
            return {
                id: element.id,
                type: element.type,
                bindings: element.attributes.bindings
            };
        }
    )
];

var relationRules = [
    createRule(
        function (relation) {
            return relation.type === 'hierarchy';
        },
        function (relation) {
            return {
                id: relation.child,
                parent: relation.parent
            };
        }
    ),
    createRule(
        function (relation) {
            return relation.type === 'hierarchy';
        },
        function (relation) {
            return {
                id: relation.parent,
                embeds: relation.child
            };
        }
    ),
    createRule(
        function (relation) {
            return relation.type === 'source';
        },
        function (relation) {
            return {
                id: relation.flow,
                source: {
                    id: relation.source
                }
            };
        }
    ),
    createRule(
        function (relation) {
            return relation.type === 'source';
        },
        function (relation) {
            return {
                id: relation.flow,
                parent: relation.source
            };
        }
    ),
    createRule(
        function (relation) {
            return relation.type === 'source';
        },
        function (relation) {
            return {
                id: relation.source,
                embeds: relation.flow
            };
        }
    ),
    createRule(
        function (relation) {
            return relation.type === 'target';
        },
        function (relation) {
            return {
                id: relation.flow,
                target: {
                    id: relation.target
                }
            };
        }
    )
];

var jointElementRules = [
    createRule(
        function (element) {
            return element.type === 'ifml.ViewContainer';
        },
        function (element) {
            return new ifml.elements.ViewContainer(element);
        }
    ),
    createRule(
        function (element) {
            return element.type === 'ifml.ViewComponent';
        },
        function (element) {
            return new ifml.elements.ViewComponent(element);
        }
    ),
    createRule(
        function (element) {
            return element.type === 'ifml.Event';
        },
        function (element) {
            return new ifml.elements.Event(element);
        }
    ),
    createRule(
        function (element) {
            return element.type === 'ifml.Action';
        },
        function (element) {
            return new ifml.elements.Action(element);
        }
    ),
    createRule(
        function (element) {
            return element.type === 'ifml.DataFlow';
        },
        function (element) {
            return new ifml.links.DataFlow(element);
        }
    ),
    createRule(
        function (element) {
            return element.type === 'ifml.NavigationFlow';
        },
        function (element) {
            return new ifml.links.NavigationFlow(element);
        }
    )
];

exports.fromJSON = function (model) {

    var trasformer = createTransformer({
            element: elementRules,
            relation: relationRules
        }, core.reduceBy('id', core.merge(core.last(), {embeds: core.concat()}))),
        cells = createTransformer({
            element: jointElementRules
        }, core.groupBy('id', core.last()))({
            elements: trasformer(model)
        });

    return utils.sortCells(_.values(cells));
};
