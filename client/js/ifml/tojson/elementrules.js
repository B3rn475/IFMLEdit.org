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
            return model.isElement(element);
        },
        function (element) {
            var statistics = element.get('statistics');
            return {
                elements: {
                    id: element.id,
                    type: element.get('type'),
                    metadata: {
                        statistics: statistics && statistics.slice()
                    }
                }
            };
        }
    ),
    createRule(
        function (element, model) {
            return model.isElementWithPosition(element);
        },
        function (element) {
            return {
                elements: {
                    id: element.id,
                    metadata: {
                        graphics: {
                            position: {
                                x: element.prop('position/x'),
                                y: element.prop('position/y')
                            }
                        }
                    }
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
                    metadata: {
                        graphics: {
                            size: {
                                height: element.prop('size/height'),
                                width: element.prop('size/width')
                            }
                        }
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
                        parameters: (element.get('parameters') || []).slice(),
                        results: (element.get('results') || []).slice()
                    },
                    metadata: {
                        graphics: {
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
                        fields: (element.get('fields') || []).slice()
                    },
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
                        filters: (element.get('filters') || []).slice()
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
                }
            };
        }
    ),
    createRule(
        function (element, model) {
            return model.isFlow(element);
        },
        function (element) {
            var vertices = element.get('vertices');
            return {
                elements: {
                    id: element.id,
                    attributes: {
                        bindings: element.get('bindings').slice()
                    },
                    metadata: {
                        graphics: {
                            vertices: vertices && vertices.slice()
                        }
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
                    source: element.prop('source/id')
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
                    target: element.prop('target/id')
                }
            };
        }
    )
];
