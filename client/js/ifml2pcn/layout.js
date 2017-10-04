// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    joint = require('joint');

function getBBox(cells) {
    return _.reduce(
        cells || [],
        function (result, cell) {
            if (cell.isLink()) { return result; }
            if (result) { return result.union(cell.getBBox({useModelGeometry: true})); }
            return cell.getBBox({useModelGeometry: true});
        },
        undefined
    ) || joint.g.rect(0, 0, 0, 0);
}

function minus(a, b) { return a - b; }

function gridBy(objs, row, col) {
    return {
        rows: _.chain(objs).map(row).sort(minus).uniq().value(),
        cols: _.chain(objs).map(col).sort(minus).uniq().value(),
        cell: _.chain(objs).groupBy(row).mapValues(function (row) { return _.groupBy(row, col); }).value(),
    };
}

function deepTranslate(objs, x, y, transformed) {
    _.each(objs || [], function (obj) {
        deepTranslate(_.map(obj.children, _.partial(_.get, transformed)), x, y, transformed);
        _.each(obj.cells || [], function (cell) { cell.translate(x, y); });
    });
}

function deepParent(objs, parent, transformed) {
    _.each(objs || [], function (obj) {
        deepParent(_.map(obj.children, _.partial(_.get, transformed)), parent, transformed);
        _.each(obj.cells || [], function (cell) { if (!cell.get('parent')) { parent.embed(cell); } });
    });
}

function length(array) {
    return array && array.length;
}

function layout(transformed, id) {
    id = id || 'Model';
    if (!transformed[id]) { return; }
    var padding = 20,
        current = transformed[id],
        grid,
        maxcol,
        mincol,
        maxrow,
        minrow,
        ws,
        hs,
        xs,
        ys,
        bbox;
    if (length(current.children)) {
        _.each(current.children, function (id) { layout(transformed, id); });
        grid = gridBy(_.map(current.children, function (id) { return transformed[id]; }), 'position.row', 'position.col');
        maxcol = _.max(grid.cols);
        maxrow = _.max(grid.rows);
        mincol = _.min(grid.cols);
        minrow = _.min(grid.rows);
        ws = _.range(0, maxcol - mincol + 1, 0);
        hs = _.range(0, maxrow - minrow + 1, 0);
        _.each(grid.rows, function (row) {
            _.each(grid.cols, function (col) {
                _.each(grid.cell[row][col], function (cell) {
                    ws[col - mincol] = Math.max(ws[col - mincol], cell.size.width);
                    hs[row - minrow] = Math.max(hs[row - minrow], cell.size.height);
                });
            });
        });
        current.size = {width: _.sum(ws), height: _.sum(hs)};
        xs = _.reduce(ws, function (xs, w) { return _(xs).concat(_.last(xs) + (w ? w + padding : 0)).value(); }, [length(current.cells) ? padding : 0]);
        ys = _.reduce(hs, function (ys, h) { return _(ys).concat(_.last(ys) + (h ? h + padding : 0)).value(); }, [length(current.cells) ? padding : 0]);
        _.each(grid.rows, function (row) {
            _.each(grid.cols, function (col) {
                var objs = grid.cell[row][col];
                if (length(objs)) {
                    _.each(objs, function (obj) {
                        deepTranslate([obj], xs[col - mincol] + (ws[col - mincol] - obj.size.width) / 2, ys[row - minrow] + (hs[row - minrow] - obj.size.height) / 2, transformed);
                    });
                    if (length(current.cells)) {
                        deepParent(objs, current.cells[0], transformed);
                    }
                }
            });
        });
        if (length(current.cells)) {
            current.cells[0].resize(_.last(xs), _.last(ys));
            current.size = {width: _.last(xs), height: _.last(ys)};
        } else {
            current.size = {width: _.last(xs) - padding, height: _.last(ys) - padding};
        }
    } else {
        bbox = getBBox(current.cells);
        current.size = {width: bbox.width, height: bbox.height};
    }
}

exports.layout = layout;
