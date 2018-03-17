// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var almost = require('almost'),
    createRule = almost.createRule;

module.exports = [
    createRule(
        function (element, model) {
            return model.isPositionedElement(element);
        },
        function (element) {
            return {
                elements: {
                    id: element.id,
                    position: element.metadata.graphics.position
                }
            };
        }
    ),
    createRule(
        function (element, model) {
            return model.isSizedElement(element);
        },
        function (element) {
            return {
                elements: {
                    id: element.id,
                    size: element.metadata.graphics.size
                }
            };
        }
    ),
    createRule(
        function (element, model) {
            return model.isElementWithStats(element) &&
                element.metadata.statistics;
        },
        function (element) {
            return {
                elements: {
                    id: element.id,
                    statistics: element.metadata.statistics.slice()
                }
            };
        }
    ),
    createRule(
        function (element, model) {
            return model.isFlow(element) &&
                element.metadata.graphics && element.metadata.graphics.vertices;
        },
        function (element) {
            return {
                elements: {
                    id: element.id,
                    vertices: element.metadata.graphics.vertices
                }
            };
        }
    ),
    createRule(
        function (element, model) {
            return model.isEvent(element);
        },
        function (element) {
            return {
                elements: {
                    id: element.id,
                    name: {
                        text: element.attributes.name,
                        horizontal: element.metadata.graphics.name.horizontal,
                        vertical: element.metadata.graphics.name.vertical
                    }
                }
            };
        }
    ),
    createRule(
        function (element, model) {
            return model.isAction(element) &&
                element.metadata.graphics.parent;
        },
        function (element) {
            return {
                elements: {
                    id: element.metadata.graphics.parent,
                    embeds: element.id
                }
            };
        }
    ),
    createRule(
        function (element, model) {
            return model.isViewContainer(element);
        },
        function (element) {
            return {
                elements: {
                    id: element.id,
                    type: element.type,
                    name: element.attributes.name,
                    'default': element.attributes.default,
                    landmark: element.attributes.landmark,
                    xor: element.attributes.xor
                }
            };
        }
    ),
    createRule(
        function (element, model) {
            return model.isViewComponent(element);
        },
        function (element) {
            return {
                elements: {
                    id: element.id,
                    type: element.type,
                    name: element.attributes.name,
                    stereotype: element.attributes.stereotype,
                    fields: (element.attributes.fields && element.attributes.fields.slice()) || []
                }
            };
        }
    ),
    createRule(
        function (element, model) {
            return model.isViewComponent(element) && ['list', 'details'].includes(element.attributes.stereotype);
        },
        function (element) {
            return {
                elements: {
                    id: element.id,
                    collection: element.attributes.collection || ''
                }
            };
        }
    ),
    createRule(
        function (element, model) {
            return model.isViewComponent(element) &&
                element.attributes.stereotype === 'list';
        },
        function (element) {
            return {
                elements: {
                    id: element.id,
                    filters: (element.attributes.filters && element.attributes.filters.slice()) || []
                }
            };
        }
    ),
    createRule(
        function (element, model) {
            return model.isEvent(element);
        },
        function (element) {
            return {
                elements: {
                    id: element.id,
                    type: element.type
                }
            };
        }
    ),
    createRule(
        function (element, model) {
            return model.isAction(element);
        },
        function (element) {
            return {
                elements: {
                    id: element.id,
                    type: element.type,
                    name: element.attributes.name,
                    results: (element.attributes.results && element.attributes.results.slice()) || [],
                    parameters: (element.attributes.parameters && element.attributes.parameters.slice()) || []
                }
            };
        }
    ),
    createRule(
        function (element, model) {
            return model.isFlow(element);
        },
        function (element) {
            return {
                elements: {
                    id: element.id,
                    type: element.type,
                    bindings: element.attributes.bindings
                }
            };
        }
    )
];
