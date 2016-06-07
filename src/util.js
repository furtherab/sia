var _ = require('lodash');
var through = require('through2');
var path = require('path');
var cssPrefix = require('css-prefix');
var template = require('gulp-template');
var gutil = require('gulp-util');
var fs = require('fs');

module.exports = {
  mergeDemoManifests: mergeDemoManifests,
  getManifestMeta: getManifestMeta,
  filePathRenamer: filePathRenamer
};

/**
 * Renames files to make the last dirname in the path account for the module id
 */
function filePathRenamer(metaByFile) {
  return through.obj(function(file, enc, cb) {
    var self = this;
    var fileName = path.basename(file.path);
    var isCSS = /\.css$/.test(file.path);
    _.forEach(metaByFile[file.path], function(meta) {
      var newPathTokens = file.path.split(path.sep).slice(0, -1);
      newPathTokens.push(meta.moduleName, meta.demoId, fileName);
      var newPath = newPathTokens.join(path.sep);
      var nfile = new gutil.File({
        cwd: file.cwd,
        base: file.base,
        path: newPath,
        contents: file.contents
      });

      if(isCSS) {
        var css = file.contents.toString('utf8');
        var ncss = cssPrefix({parentClass: meta.ngModuleName, prefix: ''}, css);
        nfile.contents = new Buffer(ncss);
      }

      self.push(nfile);
    });
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
  var metaObj = {sources: [], byFile: {}};

  return _.reduce(masterManifest.DEMOS, function(meta, module) {
    var demos = module.demos || [];
    var full = module.manifest;

    _.forEach(demos, function(demo) {

      var files = [].concat(demo.js, demo.css, demo.html, [demo.index]);

      meta.sources = meta.sources.concat(files.map(function(file) {
        append(meta.byFile, file.inputPath, {
          moduleName: module.name,
          demoId: demo.id,
          ngModuleName: demo.ngModule.name
        });
        return file.inputPath;
      }));

    });

    return meta;
  }, metaObj);

  function append(obj, key, value) {
    if(!obj[key]) obj[key] = [];
    obj[key].push(value);
  }
}
