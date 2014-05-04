module.exports = function(grunt) {
    'use strict';

    grunt.initConfig({
        // Task to compile templates from `src` folder.
        conkitty: {
            compile: {
                src: ['src/*.ctpl'],
                dest: {
                    common: 'dst/common.js',
                    templates: 'dst/templates.js'
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


    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-conkitty');

    grunt.registerTask('default', ['conkitty']);
};
