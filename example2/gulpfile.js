'use strict';

var gulp = require('gulp');

var rename = require('gulp-rename');
var conkitty = require('gulp-conkitty');
var gulpFilter = require('gulp-filter');
var concat = require('gulp-concat');

var cssFilter = gulpFilter('**/*.css');
var jsFilter = gulpFilter('**/!(tpl).js'); // Everything except tpl.js.


gulp.task('conkitty', function() {
    return gulp.src(['./src/**/*.ctpl'])
        //.pipe(rename('babydom.min.js'))
        .pipe(conkitty({
            common: 'common.js', // Filename for templates commons.
            templates: 'tpl.js', // Filename for compiled templates.
            deps: true // Append external templates dependencies to the result.
        }))
        .pipe(cssFilter)// Concat all css files to bundle deps.css.
        .pipe(concat('deps.css'))
        .pipe(cssFilter.restore())
        .pipe(jsFilter)
        .pipe(concat('deps.js')) // Concat all js files except for tpl.js to
                                 // bundle deps.js
        .pipe(jsFilter.restore())
        .pipe(gulp.dest('./dst'));
});


gulp.task('default', ['conkitty']);
