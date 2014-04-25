module.exports = function(grunt) {
    'use strict';

    grunt.initConfig({
        clean: {
            tmp: ['tmp']
        },

        // Task to compile templates from `src` folder.
        conkitty: {
            compile: {
                src: ['src/*.ctpl'],
                dest: {
                    common: 'dst/common.js',
                    templates: 'dst/templates.js',
                    deps: 'tmp'
                }
            }
        },

        concat: {
            deps: {
                files: {
                    'dst/styles.css': ['tmp/*.css']
                }
            }
        },

        // Recompile templates in case something's changed.
        watch: {
            scripts: {
                files: ['src/*.ctpl'],
                tasks: ['default'],
                options: {spawn: false}
            }
        }
    });


    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-conkitty');

    grunt.registerTask('default', ['clean', 'conkitty', 'concat']);
};
