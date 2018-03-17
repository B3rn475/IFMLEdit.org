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
            var statistics = element.get('statistics');
            return {
                elements: {
                    id: element.id,
                    type: element.get('type'),
                    metadata: {
                        graphics: {
                            position: element.get('position')
                        },
                        statistics: statistics && statistics.slice()
                    }
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
                    attributes: {
                        name: element.prop('name/text')
                    },
                    metadata: {
                        graphics: {
                            name: {
                                horizontal: element.prop('name/horizontal'),
                                vertical: element.prop('name/vertical')
                            }
                        }
                    }
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
                    attributes: {
                        name: element.get('name'),
                        parameters: (element.get('parameters') && element.get('parameters').slice()) || [],
                        results: (element.get('results') && element.get('results').slice()) || []
                    },
                    metadata: {
                        graphics: {
                            size: element.get('size'),
                            parent: element.get('parent')
                        }
                    }
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
                    attributes: {
                        name: element.get('name'),
                        stereotype: element.get('stereotype'),
                        fields: (element.get('fields') && element.get('fields').slice()) || []
                    },
                    metadata: {
                        graphics: {
                            size: element.get('size')
                        }
                    }
                }
            };
        }
    ),
    createRule(
        function (element, model) {
            return model.isListOrDetails(element);
        },
        function (element) {
            return {
                elements: {
                    id: element.id,
                    attributes: {
                        collection: element.get('collection') || ''
                    }
                }
            };
        }

    ),
    createRule(
        function (element, model) {
            return model.isList(element);
        },
        function (element) {
            return {
                elements: {
                    id: element.id,
                    attributes: {
                        filters: (element.get('filters') && element.get('filters').slice()) || []
                    }
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
                    attributes: {
                        name: element.get('name'),
                        default: element.get('default'),
                        landmark: element.get('landmark'),
                        xor: element.get('xor')
                    },
                    metadata: {
                        graphics: {
                            size: element.get('size')
                        }
                    }
                }
            };
        }
    ),
    createRule(
        function (element, model) {
            return model.isFlow(element);
        },
        function (element) {
            var vertices = element.get('vertices'),
                statistics = element.get('statistics');
            return {
                elements: {
                    id: element.id,
                    type: element.get('type'),
                    attributes: {
                        bindings: element.get('bindings').slice()
                    },
                    metadata: {
                        graphics: {
                            vertices: vertices && vertices.slice()
                        },
                        statistics: statistics && statistics.slice()
                    }
                }
            };
        }
    ),
    createRule(
        function (element, model) {
            return model.isChildElement(element);
        },
        function (element) {
            return {
                relations: {
                    type: 'hierarchy',
                    parent: element.get('parent'),
                    child: element.id
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
                relations: {
                    type: 'source',
                    flow: element.id,
                    source: element.get('source').id
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
                relations: {
                    type: 'target',
                    flow: element.id,
                    target: element.get('target').id
                }
            };
        }
    )
];
