var _ = require('lodash');
var through = require('through2');
var path = require('path');
var cssPrefix = require('css-prefix');
var template = require('gulp-template');
var gutil = require('gulp-util');
var fs = require('fs');

module.exports = {
  prefixDemoCss: prefixDemoCss,
  mergeDemoManifests: mergeDemoManifests,
  getManifestMeta: getManifestMeta,
  filePathRenamer: filePathRenamer
};

/**
 * Renames files to make the last dirname in the path account for the module id
 */
function filePathRenamer(moduleNameByFile, demoIdByFile) {
  return through.obj(function(file, enc, cb) {
    var moduleName = moduleNameByFile[file.path];
    var demoId = demoIdByFile[file.path];
    var fileName = path.basename(file.path);
    var newPath = file.path.split(path.sep).slice(0, -1);
    newPath.push(moduleName, demoId, fileName);
    file.path = newPath.join(path.sep);
    this.push(file);
    cb();
  });
}

/**
 * Prefixes a demo CSS file with the demo ID as the parent class.
 */
function prefixDemoCss() {
  return through.obj(function(file, enc, cb) {
    var id = getDemoIdByPath(file.path);
    var css = file.contents.toString('utf8');
    css = cssPrefix({parentClass: id, prefix: ''}, css);
    file.contents = new Buffer(css);
    this.push(file);
    cb();
  });
}

function mergeDemoManifests(data, meta) {
  var modules = _.reduce(data, function(modules, file, name) {
    var fileMeta = meta[name];
    var manifestPath = path.dirname(fileMeta.path);
    var fileName = file.name;
    var moduleName = fileMeta.path;
    if(!fileName) return modules;
    if(!modules[moduleName]) modules[moduleName] = file;
    var module = modules[moduleName];

    module.url = 'demo/' + fileName;
    module.manifest = moduleName;
    module.demos = (module.demos || []).map(function(demo) {

      demo.js = processDemoFiles(demo.js || [], 'js');
      demo.css = processDemoFiles(demo.css || [], 'css');
      demo.html = _.compact(processDemoFiles(demo.html || [], 'html'));

      return demo;

      function processDemoFiles(files, fileType) {
        return files.map(function(file) {
          var baseFile = path.basename(file);
          var demoFile = {
            name: baseFile,
            fileType: fileType,
            inputPath: path.join(manifestPath, file),
            outputPath: 'demo-partials/' + module.name + '/' + demo.id + '/' + baseFile
          };
          if(baseFile === 'index.html') {
            demo.index = demoFile;
            return false;
          }
          return demoFile;
        });
      }

    });

    return modules;
  }, {});
  var str = JSON.stringify({DEMOS: _.values(modules)});
  return new Buffer(str);
}

function getManifestMeta(masterManifestPath) {
  var masterManifest = require(masterManifestPath);
  var metaObj = {sources: [], moduleNameByFile: {}, demoIdByFile: {}};

  return _.reduce(masterManifest.DEMOS, function(meta, module) {
    var demos = module.demos || [];
    var full = module.manifest;

    _.forEach(demos, function(demo) {

      var files = [].concat(demo.js, demo.css, demo.html, [demo.index]);

      meta.sources = meta.sources.concat(files.map(function(file) {
        meta.moduleNameByFile[file.inputPath] = module.name;
        meta.demoIdByFile[file.inputPath] = demo.id;
        return file.inputPath;
      }));

    });

    return meta;
  }, metaObj);
}

function getDemoIdByPath(filePath) {
  return filePath.split(path.sep).slice(-1)[0];
}

/**
 * Returns the ID for a demo file.
 * @private
 * @param {string} filePath
 * @returns {string}
 */
function getDemoIdByPath(filePath) {
  var pathParts = filePath.split(path.sep).slice(-3);
  return pathParts[0] + pathParts[1];
}
