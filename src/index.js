var _ = require('lodash');
var argv = require('yargs').argv;
var del = require('del');
var Dgeni = require('dgeni');
var path = require('canonical-path');
var runSequence = require('run-sequence');

var concat = require('gulp-concat');
var gulpif = require('gulp-if');
var ngAnnotate = require('gulp-ng-annotate');
var combine = require('gulp-jsoncombine');
var ngConstant = require('gulp-ng-constant');
var ngHtml2js = require('gulp-ng-html2js');
var rename = require('gulp-rename');
var template = require('gulp-template');
var uglify = require('gulp-uglify');
var debug = require('gulp-debug');
var gutil = require('gulp-util');

var util = require('./util');

var appDir = path.join(__dirname, 'app');

/**
 * Adds gulp documentation tasks.
 * @param {object} gulp
 * @param {object} config
 * @param {string} config.basePath Base path where `src` and `docs` folders are located
 * @param {string} config.moduleTitle Title displayed in docs.
 * @param {string} config.modulePrefix Module prefix (used when determining module ids from folder structure)
 * @param {string} config.ngVersion AngularJS version to load
 * (*angular*, *angular-animate*, *angular-route*, *angular-aria*, and *angular-messages* are automatically loaded)
 * @param {Array}  config.moduleJs Module JavaScript files
 * @param {Array}  config.moduleCss Module CSS files
 * @param {boolean} [config.codepen=false] Show codepen links
 * @param {string} [config.demoPath] Path where demos are stored. Default is a subdirectory "demo" of basePath
 * @param {string} [config.urlPath="/docs"] URL path with leading slash that serves the generated documents
 * @param {string} [config.outPath="dist/docs"] Output path where generated docs are located
 * @param {string} [config.sourceRepositoryBaseUrl] Base URL for linking to individual source files
 * @param {boolean} [config.debug=false] Debug mode
 */
module.exports = function (gulp, config) {
  config.outPath = config.outPath || 'dist/docs';
  config.urlPath = config.urlPath || '/docs';
  config.demoPath = config.demoPath || config.basePath + '/demo';

  gulp = require('gulp-help')(gulp);

  gulp.task('docs', 'Generates docs', function (cb) {
    runSequence('docs:clean', [
      'docs:index',
      'docs:dgeni',
      'docs:js',
      'docs:css',
      'docs:demos:manifest',
      'docs:demos:data',
      'docs:demos:copy',
      'docs:demos:scripts'
    ], cb);
  });

  gulp.task('docs:clean', false, function () {
    return del(config.outPath);
  });

  // Parses ngDocs
  gulp.task('docs:dgeni', false, function() {
    var dgeniPackage = require('./dgeni-package')
      .config(function(log, readFilesProcessor, writeFilesProcessor) {
        log.level = config.debug ? 'info' : 'error';
        readFilesProcessor.basePath = config.basePath;
        writeFilesProcessor.outputFolder = config.outPath;
      })
      .config(function (componentDataProcessor) {
        componentDataProcessor.sourceRepositoryBaseUrl = config.sourceRepositoryBaseUrl;
      });
    var dgeni = new Dgeni([dgeniPackage]);
    return dgeni.generate();
  });

  // Copies app files
  gulp.task('docs:app', false, function() {
    return gulp.src([
      appDir + '/**/*',
      '!' + appDir + '/partials/**/*.html',
      '!' + appDir + '/index.html'
    ])
    .pipe(gulp.dest(config.outPath));
  });

  // Generates AngularJS config constants
  gulp.task('docs:config', false, function () {
    var ngConstantOptions = {
      name: 'docsApp.config-data',
      constants: {CONFIG: config},
      stream: true
    };
    return ngConstant(ngConstantOptions)
      .pipe(rename('config-data.js'))
      .pipe(gulp.dest(config.outPath + '/js'));
  });

  // Concatenates and uglifies JS
  gulp.task('docs:js', false, ['docs:app', 'docs:config', 'docs:html2js', 'docs:dgeni', 'docs:demos:data'], function() {
    return gulp.src(config.outPath + '/js/**/*.js')
      .pipe(ngAnnotate())
      .pipe(concat('docs.js'))
      .pipe(gulpif(!config.debug, uglify()))
      .pipe(gulp.dest(config.outPath));
  });

  // Concatenates CSS
  gulp.task('docs:css', false, ['docs:app'], function() {
    return gulp.src(appDir + '/css/**/*.css')
      .pipe(concat('docs.css'))
      .pipe(gulp.dest(config.outPath));
  });

  // Converts HTML to JS
  gulp.task('docs:html2js', false, function() {
    return gulp.src(appDir + '/partials/**/*.html')
      .pipe(ngHtml2js({
        moduleName: 'docsApp.templates',
        prefix: 'partials/'
      }))
      .pipe(concat('templates.js'))
      .pipe(gulp.dest(config.outPath + '/js'));
  });

  // Compiles index template
  gulp.task('docs:index', false, function() {
    return gulp.src(appDir + '/index.html')
      .pipe(template({config: config}))
      .pipe(gulp.dest(config.outPath));
  });

  // Generates demo data manifest json by merging all found manifest files
  gulp.task('docs:demos:manifest', false, function() {
    return gulp.src(config.demoPath + '/**/*.demo.json')
      .pipe(combine('demo-data.json', util.mergeDemoManifests))
      .pipe(gulp.dest(config.outPath + '/js'));
  });

  // Generates a angular constant module using the demo manifest
  gulp.task('docs:demos:data', false, ['docs:demos:manifest'], function() {
    return gulp.src(config.outPath + '/js/demo-data.json')
      .pipe(ngConstant({name: 'docsApp.demo-data'}))
      .pipe(rename('demo-data.js'))
      .pipe(gulp.dest(config.outPath + '/js'));
  });

  // Copies all files in the demo manifest to their respective folder, and prefixes CSS files
  gulp.task('docs:demos:copy', false, ['docs:demos:manifest'], function() {
    var through = require('through2');
    var meta = util.getManifestMeta(config.outPath + '/js/demo-data.json');
    return gulp.src(meta.sources)
      .pipe(util.filePathRenamer(meta.byFile))
      .pipe(gulp.dest(config.outPath + '/demo-partials'));
  });

  // Concatenates demo scripts
  gulp.task('docs:demos:scripts', false, ['docs:demos:copy'], function() {
    return gulp.src(config.outPath + '/demo-partials/**/*.js')
      .pipe(concat('docs-demo-scripts.js'))
      .pipe(gulp.dest(config.outPath));
  });

};
