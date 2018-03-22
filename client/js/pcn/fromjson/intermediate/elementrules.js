// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var almost = require('almost'),
    createRule = almost.createRule;

module.exports = [
    createRule(
        function (element, model) {
            return model.isElementWithPosition(element);
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
            return model.isElementWithSize(element);
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
            return model.isElementWithRotation(element);
        },
        function (element) {
            return {
                elements: {
                    id: element.id,
                    angle: element.metadata.graphics.angle
                }
            };
        }
    ),
    createRule(
        function (element, model) {
            return model.isElementWithTokens(element);
        },
        function (element) {
            return {
                elements: {
                    id: element.id,
                    tokens: element.attributes.tokens || 0
                }
            };
        }
    ),
    createRule(
        function (element, model) {
            return model.isElementWithName(element);
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
            return model.isElementWithPriority(element);
        },
        function (element) {
            return {
                elements: {
                    id: element.id,
                    priority: element.metadata.execution.priority
                }
            };
        }
    ),
    createRule(
        function (element, model) {
            return model.isElement(element);
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
            return model.isTransition(element) &&
                element.metadata.graphics.parent;
        },
        function (element) {
            return {
                elements: [{
                    id: element.id,
                    parent: element.metadata.graphics.parent
                }, {
                    id: element.metadata.graphics.parent,
                    embeds: element.id
                }]
            };
        }
    ),
];
