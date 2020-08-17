const { ConcatSource } = require('webpack-sources');
const { RawSource } = require('webpack-sources');
const ModuleFilenameHelpers = require('webpack/lib/ModuleFilenameHelpers');
const adjustCss = require('./adjust-css');

const PluginName = 'MpPlugin';

process.env.isMiniprogram = true; // 设置环境变量

// 这里只需要给出小程序全局不存在或者需要修改实现的对象
const globalVars = [
  'CustomEvent', 'Element', 'Event', 'HTMLElement', 'Image', 'Node', 'SharedWorker', 'Storage', 'SVGElement', 'Worker', 'XMLHttpRequest',

  'addEventListener', 'alert', 'blur', 'cancelAnimationFrame', 'close', 'confirm', 'devicePixelRatio', 'dispatchEvent', 'document',
  'focus', 'frames', 'frameElement', 'getComputedStyle', 'getSelection', 'global', 'globalThis', 'history',
  'innerHeight', 'innerWidth', 'isSecureContext', 'length', 'localStorage', 'location', 'locationbar',
  'matchMedia', 'menubar', 'moveBy', 'moveTo', 'mqq', 'name', 'navigator', 'open', 'opener', 'outerHeight', 'outerWidth',
  'pageXOffset', 'pageYOffset', 'parent', 'performance', 'personalbar', 'postMessage', 'print', 'prompt',
  'releaseEvents', 'removeEventListener', 'requestAnimationFrame', 'resizeBy', 'resizeTo', 'root',
  'screen', 'screenLeft', 'screenTop', 'screenX', 'screenY', 'scroll', 'scrollbars', 'scrollBy', 'scrollTo', 'scrollX', 'scrollY',
  'self', 'sessionStorage', 'stop', 'setImmediate', 'status', 'statusbar', 'toolbar', 'top', '__wxjs_environment',
];

/**
 * 给 chunk 头尾追加内容
 */
function wrapChunks(compilation, chunks) {
  chunks.forEach((chunk) => {
    chunk.files.forEach((fileName) => {
      if (ModuleFilenameHelpers.matchObject({ test: /\.js$/ }, fileName)) {
        // 页面 js
        const headerContent = `module.exports = function(window, document) {var App = function(options) {window.appOptions = options};${globalVars.map(item => `try{var ${item} = window.${item}}catch(e){}`).join(';')};`;
        const footerContent = '}';
        compilation.assets[fileName] = new ConcatSource(headerContent, compilation.assets[fileName], footerContent);
      }
    });
  });
}

class MpPlugin {
  apply(compiler) {
    compiler.hooks.emit.tapAsync(PluginName, (compilation, callback) => {
      const entryNames = Array.from(compilation.entrypoints.keys());
      const assetsMap = {}; // 页面名-依赖
      const assetsReverseMap = {}; // 依赖-页面名

      // 收集依赖
      entryNames.forEach((entryName) => {
        const assets = { js: [], css: [] };
        const filePathMap = {};
        const extRegex = /\.(css|js|wxss)(\?|$)/;
        const entryFiles = compilation.entrypoints.get(entryName).getFiles();
        entryFiles.forEach((filePath) => {
          // 跳过非 css 和 js
          const extMatch = extRegex.exec(filePath);
          if (!extMatch) return;

          // 跳过已记录的
          if (filePathMap[filePath]) return;
          filePathMap[filePath] = true;

          // 记录
          let ext = extMatch[1];
          ext = ext === 'wxss' ? 'css' : ext;
          assets[ext].push(filePath);

          // 插入反查表
          assetsReverseMap[filePath] = assetsReverseMap[filePath] || [];
          if (assetsReverseMap[filePath].indexOf(entryName) === -1) assetsReverseMap[filePath].push(entryName);

          // 调整 css 内容
          if (ext === 'css') {
            compilation.assets[filePath] = new RawSource(adjustCss(compilation.assets[filePath].source()));
          }
        });

        assetsMap[entryName] = assets;
      });

      callback();
    });

    compiler.hooks.compilation.tap(PluginName, (compilation) => {
      // 处理头尾追加内容
      if (this.afterOptimizations) {
        compilation.hooks.afterOptimizeChunkAssets.tap(PluginName, chunks => wrapChunks(compilation, chunks));
      } else {
        compilation.hooks.optimizeChunkAssets.tapAsync(PluginName, (chunks, callback) => {
          wrapChunks(compilation, chunks);
          callback();
        });
      }
    });
  }
}

module.exports = MpPlugin;
