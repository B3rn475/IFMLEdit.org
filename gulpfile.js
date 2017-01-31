// Copyright (c) 2016, the webratio-web project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var gulp = require('gulp'),
    path = require('path'),
    gulpif = require('gulp-if'),
    rimraf = require('gulp-rimraf'),
    rename = require('gulp-rename'),
    sass = require('gulp-sass'),
    minifyCss = require('gulp-cssnano'),
    sourcemaps = require('gulp-sourcemaps'),
    browserify = require('browserify'),
    source = require('vinyl-source-stream'),
    buffer = require('vinyl-buffer'),
    extractor = require('gulp-extract-sourcemap'),
    minifyjs = require('gulp-uglify'),
    minifyjson = require('gulp-json-minify'),
    merge = require('merge-stream'),
    jade = require('gulp-jade'),
    icongen = require('icon-gen');

gulp.task('clean', function () {
    return gulp.src('./dist/*', {read: false, dot: true}).pipe(rimraf({ force: true }));
});

gulp.task('html', function () {
    return gulp.src('./src/index.jade')
        .pipe(jade({
            pretty: false
        }))
        .pipe(gulp.dest('./dist'));
});

gulp.task('images', function () {
    return gulp.src('./src/img/*').pipe(gulp.dest('./dist/img'));
});

gulp.task('examples', function () {
    return merge(
        gulp.src('./src/examples/*.png').pipe(gulp.dest('./dist/examples')),
        gulp.src('./src/examples/*.json').pipe(minifyjson()).pipe(gulp.dest('./dist/examples'))
    );
});

gulp.task('favicon', function () {
    return icongen('./src/favicon.svg', './dist');
});

gulp.task('vendor', function () {
    return merge(
        gulp.src(['./node_modules/jquery/dist/jquery.js',
                './node_modules/jquery-mousewheel/jquery.mousewheel.js',
                './node_modules/backbone/backbone.js',
                './node_modules/jointjs/dist/joint.js',
                './node_modules/bootstrap/dist/js/bootstrap.js',
                './node_modules/bootstrap-notify/bootstrap-notify.js',
                './node_modules/filesaver.js/FileSaver.js',
                './node_modules/m-transform.js.joint/dist/m-transform.joint.js'])
                .pipe(sourcemaps.init())
                .pipe(minifyjs())
                .pipe(rename({suffix: '.min'}))
                .pipe(sourcemaps.write('./'))
                .pipe(gulp.dest('./dist/js')),
        gulp.src('./node_modules/lodash/index.js')
                .pipe(rename('lodash.js'))
                .pipe(sourcemaps.init())
                .pipe(minifyjs())
                .pipe(rename({suffix: '.min'}))
                .pipe(sourcemaps.write('./'))
                .pipe(gulp.dest('./dist/js')),
        gulp.src('./node_modules/knockout/build/output/knockout-latest.debug.js')
                .pipe(rename('knockout.js'))
                .pipe(sourcemaps.init())
                .pipe(minifyjs())
                .pipe(rename({suffix: '.min'}))
                .pipe(sourcemaps.write('./'))
                .pipe(gulp.dest('./dist/js')),
        gulp.src(['./node_modules/jointjs/dist/joint.css',
                './node_modules/bootstrap/dist/css/bootstrap.css',
                './node_modules/m-transform.js.joint/dist/m-transform.joint.css'])
                .pipe(sourcemaps.init())
                .pipe(minifyCss({compatibility: 'ie8'}))
                .pipe(rename({suffix: '.min'}))
                .pipe(sourcemaps.write('./'))
                .pipe(gulp.dest('./dist/css')),
        gulp.src('./node_modules/bootstrap/dist/fonts/**').pipe(gulp.dest('./dist/fonts'))
    );
});

gulp.task('index', function () {
    return browserify({
        entries: './src/js/index.js',
        debug: true,
    })
        .transform('exposify', {
            expose: {
                'jquery': '$',
                'lodash': '_',
                'backbone': 'Backbone',
                'knockout': 'ko',
                'joint': 'joint',
                'window': 'window',
                'navigator': 'navigator',
                'document': 'document',
                'atob': 'atob',
                'Uint8Array': 'Uint8Array',
                'Blob': 'Blob',
                'FileSaver': 'saveAs',
                'FileReader': 'FileReader',
                'm-transform.js.joint': 'mtjoint'
            }
        })
        .transform('stringify', {
            extensions: ['.svg', '.html'],
            minify: true,
            minifyOptions: {
                removeComments: false
            }
        })
        .bundle()
        .pipe(source('index.js'))
        .pipe(buffer())
        .pipe(extractor({
            basedir: path.join(__dirname, './src/js/'),
            fakeFix: true
        }))
        .pipe(gulp.dest('./dist/js'));
});

gulp.task('sass', function () {
    return gulp.src('./src/index.scss')
        .pipe(sourcemaps.init())
        .pipe(sass().on('error', sass.logError))
        .pipe(minifyCss({compatibility: 'ie8'}))
        .pipe(rename('editor.min.css'))
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest('./dist/css'));
});

gulp.task('build', ['html', 'index', 'vendor', 'sass', 'images', 'favicon', 'examples']);

gulp.task('default', ['clean'], function () {
    return gulp.start('build');
});
