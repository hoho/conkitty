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
        }
    });

    grunt.loadNpmTasks('grunt-contrib-jshint');

    grunt.registerTask('default', ['jshint']);
};
