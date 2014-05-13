'use strict';

var gulp = require('gulp');

var conkitty = require('gulp-conkitty');
var gulpFilter = require('gulp-filter');
var concat = require('gulp-concat');
var clean = require('gulp-clean');


gulp.task('conkitty', ['clean'], function() {
    var cssFilter = gulpFilter('**/*.css');
    var jsFilter = gulpFilter(['**/*.js', '!tpl.js']); // Everything except tpl.js.

    return gulp.src(['./src/**/*.ctpl'])
        .pipe(conkitty({
            common: 'common.js', // Filename for templates commons.
            templates: 'tpl.js', // Filename for compiled templates.
            sourcemap: 'tpl.map', // Filename for source map.
            deps: true // Append external templates dependencies to the result.
        }))

        // As the result of Conkitty plugin we get templates commons
        // (in common.js), compiled templates themselves (in tpl.js), and
        // declared in templates (because deps setting is true) dependencies.
        .pipe(cssFilter)
        .pipe(concat('deps.css')) // Concat all css files to bundle deps.css.
        .pipe(cssFilter.restore())

        .pipe(jsFilter)
        .pipe(concat('deps.js')) // Concat all js files except for tpl.js to bundle deps.js.
        .pipe(jsFilter.restore())

        .pipe(gulp.dest('./dst')); // Copy deps.css, deps.js, tpl.js and tpl.map to dst.
});


gulp.task('copy-index-html', ['clean'], function() {
    return gulp.src('./src/index.html')
        .pipe(gulp.dest('./dst'));
});


gulp.task('clean', function() {
    gulp.src('./dst')
        .pipe(clean());
});


gulp.task('watch', function() {
    gulp.watch('./src/**/*', ['clean', 'copy-index-html', 'conkitty']);
});


gulp.task('default', ['clean', 'copy-index-html', 'conkitty']);
