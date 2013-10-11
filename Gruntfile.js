module.exports = function(grunt) {
    'use strict';

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        jshint: {
            all: {
                src: ['conkitty.js', 'browser.js', 'bin/conkitty', 'Gruntfile.js'],
                options: {
                    jshintrc: '.jshintrc'
                }
            }
        },

        qunit: {
            all: ['test/**/*.html']
        }
    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-qunit');

    grunt.registerTask('default', ['jshint', 'qunit']);
};
