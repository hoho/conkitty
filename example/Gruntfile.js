module.exports = function(grunt) {
    'use strict';

    grunt.initConfig({
        // Task to compile templates from `src` folder to `dst/templates.js`.
        conkitty: {
            templates: {
                files: {
                    'dst/templates.js': ['src/*.ctpl']
                }
            }
        },

        // Concat dependencies installed with Bower to `dst/deps.js`.
        concat: {
            resources: {
                files: {
                    'dst/deps.js': [
                        'bower_components/concat.js/concat.js',
                        'bower_components/conkitty/callTemplate/conkittyCallTemplate.js'
                    ]
                }
            }
        },

        // Recompile templates in case something's changed.
        watch: {
            scripts: {
                files: ['src/*.ctpl'],
                tasks: ['conkitty'],
                options: {spawn: false}
            }
        }
    });


    grunt.loadNpmTasks('grunt-contrib');
    grunt.loadNpmTasks('grunt-contrib-conkitty');

    grunt.registerTask('default', ['conkitty', 'concat']);
};
