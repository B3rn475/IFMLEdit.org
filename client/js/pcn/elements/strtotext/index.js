// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

function strToTree(str) {
    var tree = [],
        text = '',
        subtext,
        active,
        i;
    function doSubTree(func) {
        if (text !== '') {
            tree.push(text);
            text = '';
        }
        i += func.length;
        if (i === str.length) { return true; }
        if (str[i] !== '{') {
            subtext = str[i];
        } else {
            active = 1;
            subtext = '';
            i += 1;
            while (i < str.length && active) {
                if (str[i] === '{') {
                    active += 1;
                } else if (str[i] === '}') {
                    active -= 1;
                }
                if (active) {
                    subtext += str[i];
                    i += 1;
                }
            }
        }
        if (subtext && subtext.length) {
            tree.push({func: func, tree: strToTree(subtext)});
        }
        if (i === str.length) { return true; }
    }
    for (i = 0; i < str.length; i += 1) {
        if (str[i] === '\\') {
            if (i === str.length - 1) { break; }
            if (str.substring(i, i + '\\overline'.length) === '\\overline') {
                if (doSubTree('\\overline')) { break; }
            } else {
                i += 1;
                text += str[i];
            }
        } else if (str[i] === '_') {
            if (doSubTree('_')) { break; }
        } else {
            text += str[i];
        }
    }
    if (text !== '') {
        tree.push(text);
    }
    return tree;
}

function treeToText(tree) {
    return tree.map(function (item) {
        if (typeof item === 'string') {
            return item;
        }
        return treeToText(item.tree);
    }).join('');
}

function funcToAttrs(func) {
    switch (func) {
    case '\\overline':
        return {'text-decoration': 'overline'};
    case '_':
        return {'font-size': '75%'};
    default:
        return {};
    }
}

function treeToAnnotations(tree, offset) {
    offset = offset || 0;
    if (tree.length === 0) { return []; }
    var current = tree.shift(),
        start = offset,
        end = offset + treeToText([current]).length;
    if (typeof current === 'string') {
        return treeToAnnotations(tree, end);
    }
    return [{start: start, end: end, attrs: funcToAttrs(current.func)}].concat(treeToAnnotations(current.tree, offset)).concat(treeToAnnotations(tree, end));
}

function strToText(str) {
    var tree = strToTree(str);
    return {text: treeToText(tree), annotations: treeToAnnotations(tree)};
}

exports.strToText = strToText;
